/**
 * Phase 2 — source-code harvest.
 *
 * Reads the repository and writes the component registry to docs/data/source/<module>.json, plus
 * schema history to docs/data/source/_migrations.json and stable identity to
 * docs/data/component-id-ledger.json.
 *
 * FOUR PROPERTIES THIS SCRIPT MUST HAVE, AND WHY:
 *
 * 1. IT MERGES, IT DOES NOT OVERWRITE. docs/data/** is committed and hand-enriched. The harvester
 *    owns the `machine` block; `purpose`, the explanations, and any links a person asserted are
 *    carried forward untouched. A harvester that rewrote whole files would delete the only part of
 *    them with judgement in it.
 *
 * 2. IT NEVER INVENTS. A relationship is emitted only where the syntax states it. `purpose` is left
 *    null rather than guessed from a class name, and such components are marked `needs-review` —
 *    an honest gap beats a plausible sentence nobody checked.
 *
 * 3. IT SEPARATES COMMITTED FROM UNCOMMITTED. Every component records whether its file is
 *    committed, modified or untracked. An uncommitted file is one machine's working tree, not
 *    branch truth, and is never presented as history.
 *
 * 4. IT REDACTS BEFORE IT WRITES. The repository is public. Every string is scrubbed on the way
 *    out and any finding is reported.
 *
 * Usage:
 *   node scripts/documentation/harvest-source.mjs [--dry-run] [--quiet]
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_DIRS, DATA, REPO_ROOT, rel, walk, readJson, writeJson, writeJsonIfChanged } from "./lib/paths.mjs";
import * as git from "./lib/git.mjs";
import { scrub, isSensitiveFile } from "./lib/redact.mjs";
import { IdLedger, moduleFor, layerFor, naturalKey } from "./lib/ids.mjs";
import { parseCSharp, resolveRoutes, classifyType, unwrapReturnType } from "./lib/csharp.mjs";
import { parseTypeScript, classifyExport, resolveImport } from "./lib/typescript.mjs";
import { isMigrationFile, isGeneratedMigrationArtifact, parseMigration } from "./lib/migrations.mjs";
import { SCHEMA_VERSION, HARVESTER_VERSION, CONFIDENCE, evidence, confirmed, inferred, needsReview, mergeHarvested } from "./lib/entity.mjs";

const GENERATOR = "harvest-source.mjs";
const HUMAN_FIELDS = [
  "purpose", "simple_explanation", "technical_explanation", "knowledge_ref",
  "features", "requirements", "test_cases", "change_history",
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const QUIET = args.has("--quiet");

const log = (...parts) => { if (!QUIET) console.log(...parts); };

async function main() {
  const started = Date.now();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  if (!git.isRepo()) {
    console.error("Not a git repository — the harvester needs git as an evidence source.");
    process.exit(1);
  }

  const branch = git.currentBranch();
  const head = git.headSha();
  log(`Harvesting source on branch ${branch} @ ${head.slice(0, 8)}`);

  const fileStates = git.fileStates();
  const lastCommits = git.lastCommitPerFile();
  log(`  git: ${fileStates.size} dirty paths, ${lastCommits.size} tracked files with history`);

  const ledger = IdLedger.open("COMP", "component-id-ledger.json");

  const components = [];
  const securityFindings = [];
  const stats = {
    csharpFiles: 0, tsFiles: 0, migrationFiles: 0, skippedDesigner: 0, skippedSensitive: 0,
    types: 0, members: 0, exports: 0, routes: 0, apiPaths: 0, diRegistrations: 0,
    docCitations: 0, incidents: 0, parseFailures: [],
  };

  const gitFor = (relativePath) => {
    const state = fileStates.get(relativePath) ?? "COMMITTED";
    const commit = lastCommits.get(relativePath) ?? null;
    return {
      state,
      last_commit: commit?.sha ?? null,
      last_commit_date: commit?.date ?? null,
      last_commit_subject: commit?.subject ?? null,
      commit_count: commit?.commit_count ?? null,
    };
  };

  // ---------------------------------------------------------------- C#

  /*
   * PRODUCT CODE ONLY.
   *
   * `tests/` is deliberately absent. Since Phase 3, every test method is a first-class TC-* entity
   * with its own module, evidence and Component -> TestCase edges, so carrying the test CLASSES here
   * as components too would represent the same code twice: once as "how the product is implemented"
   * (which they are not) and once as "how we verify it" (which they are). It would also inflate
   * PLATFORM by ~124 entries and make "769 components" a number that means two different things.
   *
   * `tools/` stays: ResetPassword is real code that ships nowhere but exists to be run, and it is
   * outside MathilensERP.slnx, so nothing else in this repository documents it.
   */
  const csharpRoots = ["src", "tools"].map((d) => path.join(REPO_ROOT, d));
  const csharpFiles = csharpRoots.flatMap((root) => walk(root, { extensions: [".cs"] }));

  const migrations = [];
  const routeTable = [];
  const diRegistrations = [];
  const deferredCalls = [];

  for (const absolute of csharpFiles) {
    const relativePath = rel(absolute);

    if (isMigrationFile(relativePath)) {
      if (isGeneratedMigrationArtifact(relativePath)) { stats.skippedDesigner++; continue; }
      const source = fs.readFileSync(absolute, "utf8");
      const migration = parseMigration(source, relativePath);
      migration.git = gitFor(relativePath);
      migrations.push(migration);
      stats.migrationFiles++;
      continue;
    }

    if (isSensitiveFile(relativePath)) { stats.skippedSensitive++; continue; }

    let parsed;
    try {
      parsed = parseCSharp(fs.readFileSync(absolute, "utf8"), relativePath);
    } catch (error) {
      stats.parseFailures.push({ path: relativePath, error: error.message });
      continue;
    }
    stats.csharpFiles++;

    const module = moduleFor(relativePath);
    const layer = layerFor(relativePath);

    for (const registration of parsed.fileLevel.diRegistrations) {
      diRegistrations.push({ ...registration, file: relativePath });
    }
    stats.diRegistrations += parsed.fileLevel.diRegistrations.length;
    stats.docCitations += parsed.docCitations.length;
    stats.incidents += parsed.incidents.length;

    for (const type of parsed.types) {
      const kind = classifyType(type, relativePath, layer);
      if (kind === "controller") {
        resolveRoutes(type);
        for (const member of type.members) {
          if (member.http?.resolved_route) {
            routeTable.push({
              route: member.http.resolved_route,
              method: member.http.method,
              controller: type.name,
              action: member.name,
              policy: member.http.policy,
              file: relativePath,
              line: member.line,
            });
            stats.routes++;
          }
        }
      }

      /*
       * Generic arity is part of identity.
       *
       * `src/Shared/Results/Result.cs` declares BOTH `Result` and `Result<TValue>` — two distinct
       * types that a name-only key collapses into one, which produced a duplicate COMP id and would
       * have made every reference to "Result" ambiguous. The CLR's own convention (`Result`1`) is
       * used, so the two are separable everywhere downstream.
       */
      const arity = (type.generics ?? "").split(",").filter(Boolean).length;
      const symbolKey = arity > 0 ? `${type.name}\`${arity}` : type.name;
      const displayName = arity > 0 ? `${type.name}${type.generics}` : type.name;

      const key = naturalKey(relativePath, symbolKey);
      const id = ledger.idFor(key, module, today);

      // Dependencies: only what the syntax states. Constructor injection is the strongest signal in
      // this codebase because it uses constructor injection exclusively and no service locator.
      const dependsOn = [];
      for (const parameterType of type.ctorParams) {
        dependsOn.push({
          target: parameterType,
          target_component: null,
          via: "constructor-injection",
          confidence: CONFIDENCE.CONFIRMED,
        });
      }
      for (const base of type.base_types) {
        dependsOn.push({
          target: base,
          target_component: null,
          via: "base-type",
          confidence: CONFIDENCE.CONFIRMED,
        });
      }
      if (type.efConfigures) {
        dependsOn.push({
          target: type.efConfigures,
          target_component: null,
          via: "ef-configuration",
          confidence: CONFIDENCE.CONFIRMED,
        });
      }

      /*
       * Method-body references — the Phase 4 enhancement.
       *
       * Three of the four forms name the type outright and are CONFIRMED. `method-call` resolves the
       * receiver from a local declared in the same body, which is an inference however careful, so it
       * carries INFERRED. Each edge keeps the line and the expression that produced it, so a reader
       * can check the claim without re-running anything.
       */
      for (const reference of type.bodyReferences ?? []) {
        dependsOn.push({
          target: reference.name,
          target_component: null,
          via: reference.via,
          confidence: reference.via === "method-call" ? CONFIDENCE.INFERRED : CONFIDENCE.CONFIRMED,
          evidence: {
            file: relativePath,
            line: reference.line,
            expression: reference.expression,
          },
        });
      }

      // Held for the second pass, which needs every component's members to resolve them.
      deferredCalls.push({
        owner: id,
        file: relativePath,
        fieldTypes: buildFieldTypeMap(type),
        calls: type.deferredCalls ?? [],
      });

      const typeEvidence = [evidence.symbol(relativePath, type.name, type.line)];
      if (type.attributes.length) {
        typeEvidence.push(evidence.attribute(relativePath, type.attributes[0], type.line));
      }

      const gitInfo = gitFor(relativePath);
      const provenance =
        gitInfo.state === "UNCOMMITTED"
          ? needsReview(GENERATOR, typeEvidence, now,
              "File is untracked: this component describes one working tree and is not branch history.")
          : confirmed(GENERATOR, typeEvidence, now);

      components.push({
        id,
        name: displayName,
        kind,
        path: relativePath,
        module,
        layer,
        purpose: null,
        simple_explanation: null,
        technical_explanation: null,
        knowledge_ref: null,
        features: [],
        requirements: [],
        test_cases: [],
        machine: {
          namespace: parsed.namespace,
          declaration: type.declaration,
          line: type.line,
          modifiers: type.modifiers,
          base_types: type.base_types,
          attributes: type.attributes,
          members: type.members.map((member) => ({
            name: member.name,
            kind: member.kind,
            signature: member.signature ?? null,
            line: member.line ?? null,
            modifiers: member.modifiers ?? [],
            attributes: member.attributes ?? [],
            ...(member.http ? { http: member.http } : {}),
          })),
          depends_on: dependsOn,
          doc_citations: parsed.docCitations,
          incident_comments: parsed.incidents,
          git: gitInfo,
          metrics: {
            lines: parsed.lineCount,
            member_count: type.members.length,
            dependency_count: dependsOn.length,
          },
        },
        status: gitInfo.state === "UNCOMMITTED" ? "needs-review" : "active",
        data_classification: "PUBLIC_SAFE",
        provenance,
        last_verified_commit: gitInfo.last_commit,
        change_history: [],
      });

      stats.types++;
      stats.members += type.members.length;
    }
  }

  // ---------------------------------------------------------------- TypeScript

  const tsFiles = walk(path.join(REPO_ROOT, "web/src"), { extensions: [".ts", ".tsx"] });
  const frontendCalls = [];

  for (const absolute of tsFiles) {
    const relativePath = rel(absolute);
    let parsed;
    try {
      parsed = parseTypeScript(fs.readFileSync(absolute, "utf8"), relativePath);
    } catch (error) {
      stats.parseFailures.push({ path: relativePath, error: error.message });
      continue;
    }
    stats.tsFiles++;
    stats.apiPaths += parsed.apiPaths.length;

    const module = moduleFor(relativePath);
    const gitInfo = gitFor(relativePath);

    // One component per exported symbol would produce ~600 entries with no additional meaning for a
    // file whose exports are one component plus its props type. A module-level component with its
    // exports as members is the granularity that matches how these files are actually changed.
    const primary =
      parsed.exports.find((e) => e.is_default)
      ?? parsed.exports.find((e) => /^[A-Z]/.test(e.name) && e.kind === "function")
      ?? parsed.exports[0];

    if (!primary) continue;

    const key = naturalKey(relativePath, primary.name);
    const id = ledger.idFor(key, module, today);
    const kind = classifyExport(primary, relativePath, parsed);

    const dependsOn = [];
    for (const imported of parsed.imports) {
      const resolved = resolveImport(imported.from, relativePath);
      if (resolved) {
        dependsOn.push({
          target: resolved,
          target_component: null,
          via: "import",
          confidence: CONFIDENCE.CONFIRMED,
        });
      }
    }
    for (const apiPath of parsed.apiPaths) {
      dependsOn.push({
        target: apiPath.normalized,
        target_component: null,
        // The literal path is in the source, but binding it to a controller action is a match on
        // shape, not a proof — hence INFERRED.
        via: "http-call",
        confidence: CONFIDENCE.INFERRED,
      });
      frontendCalls.push({ file: relativePath, ...apiPath });
    }

    const tsEvidence = [evidence.symbol(relativePath, primary.name, primary.line)];
    if (parsed.route) tsEvidence.push(evidence.route(relativePath, parsed.route, primary.line));

    components.push({
      id,
      name: primary.name === "default" ? path.basename(relativePath).replace(/\.tsx?$/, "") : primary.name,
      kind,
      path: relativePath,
      module,
      layer: "Web",
      purpose: null,
      simple_explanation: null,
      technical_explanation: null,
      knowledge_ref: null,
      features: [],
      requirements: [],
      test_cases: [],
      machine: {
        namespace: parsed.route ?? null,
        declaration: primary.signature ?? null,
        line: primary.line ?? null,
        modifiers: parsed.isClient ? ["use client"] : [],
        base_types: [],
        attributes: [],
        members: parsed.exports.map((e) => ({
          name: e.name,
          kind: "export",
          signature: e.signature ?? null,
          line: e.line ?? null,
          modifiers: e.is_default ? ["default"] : [],
          attributes: [],
        })),
        depends_on: dependsOn,
        doc_citations: [],
        incident_comments: [],
        git: gitInfo,
        metrics: {
          lines: parsed.lineCount,
          member_count: parsed.exports.length,
          dependency_count: dependsOn.length,
        },
      },
      status: gitInfo.state === "UNCOMMITTED" ? "needs-review" : "active",
      data_classification: "PUBLIC_SAFE",
      provenance:
        gitInfo.state === "UNCOMMITTED"
          ? needsReview(GENERATOR, tsEvidence, now, "File is untracked: working-tree observation, not branch history.")
          : confirmed(GENERATOR, tsEvidence, now),
      last_verified_commit: gitInfo.last_commit,
      change_history: [],
    });

    stats.types++;
    stats.exports += parsed.exports.length;
  }

  // ---------------------------------------------------------------- resolve targets to components

  const byName = new Map();
  const byPath = new Map();
  for (const component of components) {
    // Indexed on the bare name: a dependency is written `Result<CustomerDto>` at the use site but
    // `Result<TValue>` at the declaration, so matching on the display name would never resolve.
    // The arity ambiguity this reintroduces is handled below — a name with more than one candidate
    // is left unresolved rather than guessed.
    const bareName = component.name.replace(/<.*$/, "");
    if (!byName.has(bareName)) byName.set(bareName, []);
    byName.get(bareName).push(component);
    byPath.set(component.path.replace(/\.(ts|tsx|cs)$/, ""), component);
  }

  let resolvedEdges = 0;
  let ambiguousEdges = 0;
  for (const component of components) {
    for (const dependency of component.machine.depends_on) {
      const bareName = dependency.target.replace(/<.*$/, "").split(".").pop();

      if (dependency.via === "import") {
        const target = byPath.get(dependency.target) ?? byPath.get(`${dependency.target}/index`);
        if (target) { dependency.target_component = target.id; resolvedEdges++; }
        continue;
      }
      if (dependency.via === "http-call") continue;

      const candidates = byName.get(bareName) ?? [];
      if (candidates.length === 1) {
        dependency.target_component = candidates[0].id;
        resolvedEdges++;
      } else if (candidates.length > 1) {
        // Two types share a name. Guessing which one is meant would be exactly the invention this
        // system forbids, so the edge stays unresolved and is downgraded.
        dependency.confidence = CONFIDENCE.NEEDS_REVIEW;
        ambiguousEdges++;
      }
    }
  }

  /*
   * SECOND PASS — deferred method calls.
   *
   *     var order = await _orderRepository.GetByIdAsync(id, ct);   // type not stated
   *     order.TransitionTo(...);                                   // ...but discoverable
   *
   * `_orderRepository` comes from a constructor parameter of type `IOrderRepository`; that port's
   * `GetByIdAsync` is declared to return `Task<Order?>`; unwrapped, that is `Order`. Both halves are
   * parsed signatures already in the registry, so the edge rests on evidence rather than on a name
   * looking familiar. It is still INFERRED — two hops of resolution is not the same as the type
   * being written at the call site.
   */
  let deferredResolved = 0;
  let deferredUnresolved = 0;
  for (const entry of deferredCalls) {
    const owner = components.find((c) => c.id === entry.owner);
    if (!owner) continue;

    for (const call of entry.calls) {
      const receiverType = entry.fieldTypes.get(call.receiver);
      if (!receiverType) { deferredUnresolved++; continue; }

      const receiverComponent = (byName.get(receiverType.replace(/<.*$/, "")) ?? [])[0];
      if (!receiverComponent) { deferredUnresolved++; continue; }

      const member = receiverComponent.machine.members.find((m) => m.name === call.receiver_method);
      const returned = unwrapReturnType(member?.signature ?? null);
      if (!returned) { deferredUnresolved++; continue; }

      const targets = byName.get(returned) ?? [];
      if (targets.length !== 1) { deferredUnresolved++; continue; }

      const already = owner.machine.depends_on.some(
        (d) => d.target_component === targets[0].id && d.via === "method-call",
      );
      if (already) continue;

      owner.machine.depends_on.push({
        target: returned,
        target_component: targets[0].id,
        via: "method-call",
        confidence: CONFIDENCE.INFERRED,
        evidence: {
          file: entry.file,
          line: call.line,
          expression: `${call.expression}  [${receiverType}.${call.receiver_method} returns ${returned}]`.slice(0, 200),
        },
      });
      deferredResolved++;
    }
  }

  // Bind frontend literal paths to controller actions by normalised route shape.
  const routeIndex = new Map();
  for (const entry of routeTable) {
    routeIndex.set(normalizeRoute(entry.route), entry);
  }
  let boundCalls = 0;
  for (const component of components) {
    for (const dependency of component.machine.depends_on) {
      if (dependency.via !== "http-call") continue;
      const match = routeIndex.get(normalizeRoute(dependency.target));
      if (match) {
        const target = byName.get(match.controller)?.[0];
        if (target) { dependency.target_component = target.id; boundCalls++; }
      }
    }
  }

  // ---------------------------------------------------------------- write

  const retired = ledger.retireUnseen(today);
  const byModule = new Map();
  for (const component of components) {
    if (!byModule.has(component.module)) byModule.set(component.module, []);
    byModule.get(component.module).push(component);
  }

  const written = [];
  for (const [module, moduleComponents] of [...byModule.entries()].sort()) {
    const file = path.join(DATA_DIRS.source, `${module.toLowerCase()}.json`);
    const existing = readJson(file);
    const existingById = new Map((existing?.components ?? []).map((c) => [c.id, c]));

    const merged = moduleComponents
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((component) => mergeHarvested(existingById.get(component.id), component, HUMAN_FIELDS));

    const payload = {
      module,
      schema_version: SCHEMA_VERSION,
      generated_at: now,
      harvester_version: HARVESTER_VERSION,
      components: merged,
    };

    const { entity: safe, findings } = scrub(payload, { context: `${module}:` });
    securityFindings.push(...findings);

    const didWrite = !DRY_RUN && writeJsonIfChanged(file, safe);
    written.push({ file: rel(file), module, count: merged.length, changed: didWrite });
  }

  if (migrations.length) {
    const payload = {
      schema_version: SCHEMA_VERSION,
      generated_at: now,
      harvester_version: HARVESTER_VERSION,
      migrations: migrations.sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? "")),
    };
    const { entity: safe, findings } = scrub(payload, { context: "migrations:" });
    securityFindings.push(...findings);
    const file = path.join(DATA_DIRS.source, "_migrations.json");
    const didWrite = !DRY_RUN && writeJsonIfChanged(file, safe);
    written.push({ file: rel(file), module: "SCHEMA", count: migrations.length, changed: didWrite });
  }

  // The route table and DI map are DERIVED indexes, not source data — they belong in the ignored
  // registry directory, and are rebuilt from the same evidence on every run.
  const registryDir = path.join(REPO_ROOT, "docs/registry");
  if (!DRY_RUN) {
    writeJson(path.join(registryDir, "route-table.json"), {
      generated_at: now, branch, head, routes: routeTable.sort((a, b) => a.route.localeCompare(b.route)),
    });
    writeJson(path.join(registryDir, "di-registrations.json"), { generated_at: now, registrations: diRegistrations });
    writeJson(path.join(registryDir, "frontend-api-calls.json"), { generated_at: now, calls: frontendCalls });
    ledger.save();
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const summary = {
    branch, head, generated_at: now, elapsed_seconds: Number(elapsed),
    components: components.length,
    by_module: Object.fromEntries([...byModule.entries()].map(([m, c]) => [m, c.length]).sort()),
    stats,
    edges: {
      total: components.reduce((sum, c) => sum + c.machine.depends_on.length, 0),
      resolved: resolvedEdges,
      ambiguous_needs_review: ambiguousEdges,
      http_calls_bound_to_routes: boundCalls,
    },
    ledger: ledger.stats(),
    retired_ids: retired,
    security_findings: securityFindings.length,
    uncommitted_components: components.filter((c) => c.machine.git.state === "UNCOMMITTED").length,
    modified_components: components.filter((c) => c.machine.git.state === "MODIFIED").length,
  };

  if (!DRY_RUN) writeJson(path.join(registryDir, "harvest-summary.json"), summary);

  log("");
  log(`  components      ${summary.components}`);
  log(`  C# files        ${stats.csharpFiles}  (types ${stats.types}, members ${stats.members})`);
  log(`  TS/TSX files    ${stats.tsFiles}  (exports ${stats.exports})`);
  log(`  migrations      ${stats.migrationFiles}  (designer files skipped: ${stats.skippedDesigner})`);
  log(`  routes          ${stats.routes}   frontend API calls ${stats.apiPaths} (bound ${boundCalls})`);
  log(`  DI registrations ${stats.diRegistrations}`);
  log(`  doc citations   ${stats.docCitations}   incident comments ${stats.incidents}`);
  log(`  edges           ${summary.edges.total} (resolved ${resolvedEdges}, ambiguous ${ambiguousEdges})`);
  log(`  uncommitted     ${summary.uncommitted_components} components from untracked files`);
  log(`  security        ${securityFindings.length} redaction findings`);
  if (stats.parseFailures.length) log(`  parse failures  ${stats.parseFailures.length}`);
  log(`  wrote           ${written.filter((w) => w.changed).length} of ${written.length} files changed, ${elapsed}s${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`);

  if (securityFindings.length && !QUIET) {
    log("");
    log("  SECURITY FINDINGS (redacted before writing):");
    for (const finding of securityFindings.slice(0, 20)) {
      log(`    ${finding.kind}  ${finding.context}  ${finding.sample}`);
    }
  }
}

function normalizeRoute(route) {
  return route
    .replace(/\{[^}]*\}/g, "{param}")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/**
 * Field/parameter name -> declared type, for a class's injected dependencies.
 *
 * Both spellings are recorded because a body may use either: the constructor parameter
 * (`orderRepository`) or the field this codebase assigns it to (`_orderRepository`).
 */
function buildFieldTypeMap(type) {
  const map = new Map();
  for (const parameter of type.ctorParamsNamed ?? []) {
    map.set(parameter.name, parameter.type);
    map.set(`_${parameter.name}`, parameter.type);
  }
  return map;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
