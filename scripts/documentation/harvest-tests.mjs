/**
 * Phase 3 — test harvest.
 *
 * Converts every real xUnit `[Fact]` and `[Theory]` method into a stable `TC-*` entity under
 * docs/data/testcases/<module>.json, and derives Component -> TestCase edges from evidence in the
 * test bodies.
 *
 * FIVE PROPERTIES, AND WHY EACH IS NON-NEGOTIABLE:
 *
 * 1. NOTHING IS INVENTED. A test case exists here only because a method with a test attribute
 *    exists in the repository. No proposed tests are written by this script — a `PLANNED` case is
 *    a judgement about what SHOULD exist, and that belongs to a later phase with a human in it.
 *
 * 2. NO RESULT IS EVER INFERRED. `last_result` is only ever set by record-test-run.mjs from a real
 *    run. Harvesting leaves it null, which reads as NOT_RUN — never as passing.
 *
 * 3. A [THEORY] IS ONE TEST CASE. Its `[InlineData]` rows are metadata. Minting a case per row
 *    would turn 489 methods into several thousand entities that no one asked for and that no
 *    reporting layer would ever show separately.
 *
 * 4. IT IS IDEMPOTENT. IDs come from the ledger keyed on `path#Class.Method`, so running it twice
 *    changes nothing. Edges are deduplicated by (component, via).
 *
 * 5. IT MERGES. The `machine` block is rewritten; `title`, `steps`, `expected_result`, priority and
 *    any human-asserted links survive, exactly as the component harvest behaves.
 *
 * Usage: node scripts/documentation/harvest-tests.mjs [--dry-run] [--quiet]
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_DIRS, REPO_ROOT, rel, walk, readJson, writeJson, writeJsonIfChanged } from "./lib/paths.mjs";
import * as git from "./lib/git.mjs";
import { scrub } from "./lib/redact.mjs";
import { IdLedger, moduleForTest, naturalKey } from "./lib/ids.mjs";
import { parseTestFile, isTestFile, testProjectOf, classifyTest, categorizeTest } from "./lib/csharp-tests.mjs";
import { SCHEMA_VERSION, HARVESTER_VERSION, CONFIDENCE, evidence, confirmed, inferred, needsReview, mergeHarvested } from "./lib/entity.mjs";

const GENERATOR = "harvest-tests.mjs";

/** Preserved across harvests — everything a person might write about a test. */
const HUMAN_FIELDS = [
  "title", "priority", "preconditions", "test_data", "steps", "expected_result",
  "requirements", "features", "components", "test_plans", "change_history", "last_result",
];

/**
 * Names that appear in test bodies, match a component, and would produce edges that say nothing.
 * `Assert`, `Guid` and friends are not in the component registry at all so they never match; these
 * are the ones that DO match and still carry no information about what is under test.
 */
const UNINFORMATIVE_EDGES = new Set(["Program"]);

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const QUIET = args.has("--quiet");
const log = (...parts) => { if (!QUIET) console.log(...parts); };

function main() {
  const started = Date.now();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  if (!git.isRepo()) {
    console.error("Not a git repository — the harvester needs git as an evidence source.");
    process.exit(1);
  }

  const branch = git.currentBranch();
  const head = git.headSha();
  const fileStates = git.fileStates();
  const lastCommits = git.lastCommitPerFile();

  // ---------------------------------------------------------------- component index

  const components = loadComponents();
  if (components.length === 0) {
    console.error("No components found. Run `npm run docs:harvest:source` first — test edges are resolved against the component registry.");
    process.exit(1);
  }

  const componentByName = new Map();
  for (const component of components) {
    const bare = component.name.replace(/<.*$/, "");
    if (!componentByName.has(bare)) componentByName.set(bare, []);
    componentByName.get(bare).push(component);
  }

  const routeTable = readJson(path.join(REPO_ROOT, "docs/registry/route-table.json"))?.routes ?? [];
  const routeIndex = new Map();
  for (const route of routeTable) {
    routeIndex.set(normalizeRoute(route.route), route);
  }

  // ---------------------------------------------------------------- discover and parse

  const testFiles = walk(path.join(REPO_ROOT, "tests"), { extensions: [".cs"] })
    .map(rel)
    .filter(isTestFile)
    .sort();

  const projects = new Map();
  for (const file of testFiles) {
    const project = testProjectOf(file);
    projects.set(project, (projects.get(project) ?? 0) + 1);
  }

  const ledger = IdLedger.open("TC", "testcase-id-ledger.json");
  const testCases = [];
  const stats = {
    filesDiscovered: testFiles.length,
    filesWithTests: 0,
    classes: 0,
    facts: 0,
    theories: 0,
    inlineDataRows: 0,
    parseFailures: [],
    edgesByVia: {},
    unresolvedReferences: new Map(),
    httpCallsBound: 0,
    httpCallsTotal: 0,
    moduleEvidence: {},
    obsoleteFlagged: 0,
  };
  const securityFindings = [];

  for (const relativePath of testFiles) {
    let parsed;
    try {
      parsed = parseTestFile(fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8"), relativePath);
    } catch (error) {
      stats.parseFailures.push({ path: relativePath, error: error.message });
      continue;
    }
    if (parsed.classes.length === 0) continue;
    stats.filesWithTests++;

    const project = testProjectOf(relativePath);
    const gitInfo = gitFor(relativePath, fileStates, lastCommits);

    for (const testClass of parsed.classes) {
      stats.classes++;

      for (const test of testClass.tests) {
        if (test.attribute === "Theory") stats.theories++; else stats.facts++;
        stats.inlineDataRows += test.theory_data.length;

        // ---- edges, strongest evidence first ------------------------------------------------

        const exercises = new Map();
        const unresolved = new Set();

        const addEdge = (name, via, confidence) => {
          if (UNINFORMATIVE_EDGES.has(name)) return;
          const candidates = componentByName.get(name) ?? [];
          if (candidates.length === 0) { unresolved.add(name); return; }
          if (candidates.length > 1) {
            // Two components share a name. Choosing one would be invention; the edge is kept but
            // demoted so nothing downstream treats it as settled.
            const key = `${candidates[0].id}|${via}`;
            if (!exercises.has(key)) {
              exercises.set(key, { component: candidates[0].id, name, via, confidence: CONFIDENCE.NEEDS_REVIEW });
            }
            return;
          }
          const key = `${candidates[0].id}|${via}`;
          if (!exercises.has(key)) exercises.set(key, { component: candidates[0].id, name, via, confidence });
        };

        // (a) explicit type references in the body
        for (const reference of test.type_references) {
          addEdge(reference.name, reference.via, CONFIDENCE.CONFIRMED);
        }
        // (b) what the class touches outside its test bodies — shared fields, ctor, helpers
        for (const reference of testClass.class_scope_references) {
          addEdge(reference.name, "class-scope", CONFIDENCE.INFERRED);
        }
        // (d) fixture setup
        for (const fixture of testClass.fixtures) {
          addEdge(fixture, "fixture", CONFIDENCE.CONFIRMED);
        }
        // (e) integration host / API calls -> the controller that owns the route
        const httpCalls = [];
        for (const call of test.http_calls) {
          stats.httpCallsTotal++;
          const route = matchRoute(routeIndex, call.normalized);
          let routeComponent = null;
          if (route) {
            const controller = componentByName.get(route.controller)?.[0];
            if (controller) {
              routeComponent = controller.id;
              addEdge(route.controller, "http-route", CONFIDENCE.CONFIRMED);
              stats.httpCallsBound++;
            }
          }
          httpCalls.push({ ...call, route_component: routeComponent });
        }

        // (f) the class-name convention, as a LAST resort and only when corroborated
        const subjectName = /^(.*)Tests?$/.exec(testClass.name)?.[1] ?? null;
        let subjectComponent = null;
        if (subjectName) {
          const candidates = componentByName.get(subjectName) ?? [];
          if (candidates.length === 1) {
            const corroborated =
              test.type_references.some((r) => r.name === subjectName)
              || testClass.class_scope_references.some((r) => r.name === subjectName)
              || testClass.usings.some((u) => u.endsWith(`.${subjectName}`) || u.includes(subjectName));
            subjectComponent = candidates[0].id;
            addEdge(
              subjectName,
              "class-name-convention",
              corroborated ? CONFIDENCE.CONFIRMED : CONFIDENCE.INFERRED,
            );
          }
        }

        const edges = [...exercises.values()];
        for (const edge of edges) {
          stats.edgesByVia[edge.via] = (stats.edgesByVia[edge.via] ?? 0) + 1;
        }
        for (const name of unresolved) {
          stats.unresolvedReferences.set(name, (stats.unresolvedReferences.get(name) ?? 0) + 1);
        }

        // ---- module, type, category ---------------------------------------------------------

        const subjectModules = edges
          .map((edge) => components.find((c) => c.id === edge.component)?.module)
          .filter(Boolean);
        const subjectLayers = edges
          .map((edge) => components.find((c) => c.id === edge.component)?.layer)
          .filter(Boolean);

        const moduleResult = moduleForTest({
          namespace: testClass.namespace,
          relativePath,
          subjectModules,
        });
        stats.moduleEvidence[moduleResult.source.split("(")[0]] =
          (stats.moduleEvidence[moduleResult.source.split("(")[0]] ?? 0) + 1;

        const typeResult = classifyTest(test, testClass, project);
        const categoryResult = categorizeTest(relativePath, testClass.namespace, project, subjectLayers);

        // ---- obsolescence, conservatively ---------------------------------------------------

        let obsoleteReview = null;
        if (edges.length === 0 && httpCalls.length === 0) {
          stats.obsoleteFlagged++;
          obsoleteReview = {
            reason: "No production component or API route could be linked to this test from its body",
            evidence: [
              `${relativePath}:${test.line}`,
              `type references found: ${test.type_references.map((r) => r.name).join(", ") || "none"}`,
              "This may be correct (a pure helper or framework test) — it is surfaced, never deleted",
            ],
          };
        }

        // ---- entity -------------------------------------------------------------------------

        const key = naturalKey(relativePath, `${testClass.name}.${test.name}`);
        const id = ledger.idFor(key, moduleResult.module, today);

        const testEvidence = [evidence.testMethod(relativePath, test.name, test.line)];
        if (test.theory_data.length) {
          testEvidence.push(evidence.attribute(relativePath, `Theory x${test.theory_data.length}`, test.line));
        }
        for (const call of httpCalls.slice(0, 3)) {
          testEvidence.push(evidence.route(relativePath, call.path, test.line));
        }

        const provenance =
          gitInfo.state === "UNCOMMITTED"
            ? needsReview(GENERATOR, testEvidence, now, "Test file is untracked: a working-tree observation, not branch history.")
            : confirmed(GENERATOR, testEvidence, now);

        testCases.push({
          id,
          title: humanizeTestName(test.name),
          module: moduleResult.module,
          type: typeResult.type,
          type_evidence: typeResult.why,
          category: categoryResult.category,
          category_evidence: categoryResult.why,
          module_evidence: moduleResult.source,
          subject_component: subjectComponent,
          obsolete_review: obsoleteReview,
          priority: "unset",
          preconditions: [],
          test_data: test.theory_data.length ? `${test.theory_data.length} [InlineData] row(s) — see machine.inline_data` : null,
          steps: [],
          expected_result: null,
          automation: "AUTOMATED",
          automation_ref: `${relativePath}::${testClass.name}.${test.name}`,
          assertions: test.assertions,
          requirements: [],
          features: [],
          components: [],
          test_plans: [],
          last_result: null,
          machine: {
            file: relativePath,
            project,
            framework: "xunit",
            namespace: testClass.namespace,
            class: testClass.name,
            method: test.name,
            attribute: test.attribute,
            attributes: test.attributes.slice(0, 20),
            signature: test.signature ?? null,
            is_async: test.is_async,
            line: test.line,
            body_lines: test.body_lines,
            inline_data: test.theory_data,
            member_data: test.member_data,
            fixtures: testClass.fixtures,
            usings: testClass.usings.filter((u) => u.startsWith("MathilensERP.")),
            http_calls: httpCalls,
            exercises: edges.sort((a, b) => a.component.localeCompare(b.component)),
            unresolved_references: [...unresolved].sort(),
            git: gitInfo,
          },
          status: gitInfo.state === "UNCOMMITTED" ? "needs-review" : "active",
          data_classification: "PUBLIC_SAFE",
          provenance,
          last_verified_commit: gitInfo.last_commit,
          change_history: [],
        });
      }
    }
  }

  // ---------------------------------------------------------------- write

  const retired = ledger.retireUnseen(today);
  const byModule = new Map();
  for (const testCase of testCases) {
    if (!byModule.has(testCase.module)) byModule.set(testCase.module, []);
    byModule.get(testCase.module).push(testCase);
  }

  const written = [];
  for (const [module, moduleTests] of [...byModule.entries()].sort()) {
    const file = path.join(DATA_DIRS.testcases, `${module.toLowerCase()}.json`);
    const existing = readJson(file);
    const existingById = new Map((existing?.test_cases ?? []).map((t) => [t.id, t]));

    const merged = moduleTests
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((testCase) => mergeHarvested(existingById.get(testCase.id), testCase, HUMAN_FIELDS));

    const payload = {
      module,
      schema_version: SCHEMA_VERSION,
      generated_at: now,
      harvester_version: HARVESTER_VERSION,
      test_cases: merged,
    };

    const { entity: safe, findings } = scrub(payload, { context: `${module}:` });
    securityFindings.push(...findings);
    const didWrite = !DRY_RUN && writeJsonIfChanged(file, safe);
    written.push({ file: rel(file), module, count: merged.length, changed: didWrite });
  }

  // Component -> TestCase, the reverse direction. DERIVED, so it lives in the ignored registry and
  // is rebuilt from the same evidence every run rather than being stored twice.
  const reverse = new Map();
  for (const testCase of testCases) {
    for (const edge of testCase.machine.exercises) {
      if (!reverse.has(edge.component)) reverse.set(edge.component, []);
      reverse.get(edge.component).push({
        test_case: testCase.id,
        via: edge.via,
        confidence: edge.confidence,
        method: testCase.automation_ref,
      });
    }
  }

  const registryDir = path.join(REPO_ROOT, "docs/registry");
  const summary = {
    branch, head, generated_at: now,
    elapsed_seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    test_cases: testCases.length,
    facts: stats.facts,
    theories: stats.theories,
    inline_data_rows: stats.inlineDataRows,
    files_discovered: stats.filesDiscovered,
    files_with_tests: stats.filesWithTests,
    test_classes: stats.classes,
    projects: Object.fromEntries([...projects.entries()].sort()),
    by_module: Object.fromEntries([...byModule.entries()].map(([m, t]) => [m, t.length]).sort()),
    by_type: countBy(testCases, (t) => t.type),
    by_category: countBy(testCases, (t) => t.category),
    module_evidence: stats.moduleEvidence,
    edges: {
      total: testCases.reduce((sum, t) => sum + t.machine.exercises.length, 0),
      by_via: stats.edgesByVia,
      needs_review: testCases.reduce((sum, t) => sum + t.machine.exercises.filter((e) => e.confidence === "NEEDS_REVIEW").length, 0),
      components_covered: reverse.size,
    },
    http_calls: { total: stats.httpCallsTotal, bound: stats.httpCallsBound },
    unresolved_references: Object.fromEntries(
      [...stats.unresolvedReferences.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40),
    ),
    obsolete_flagged: stats.obsoleteFlagged,
    ledger: ledger.stats(),
    retired_ids: retired,
    parse_failures: stats.parseFailures,
    security_findings: securityFindings.length,
  };

  if (!DRY_RUN) {
    writeJson(path.join(registryDir, "component-test-index.json"), {
      generated_at: now,
      branch,
      head,
      note: "Component -> TestCase, derived from testcase machine.exercises. Regenerated on every harvest; never committed.",
      components: Object.fromEntries([...reverse.entries()].sort()),
    });
    writeJson(path.join(registryDir, "test-harvest-summary.json"), summary);
    ledger.save();
  }

  log(`Harvested tests on ${branch} @ ${head.slice(0, 8)}`);
  log(`  test files       ${stats.filesDiscovered} discovered, ${stats.filesWithTests} containing tests, ${stats.classes} classes`);
  log(`  projects         ${[...projects.entries()].map(([p, c]) => `${p} (${c})`).join(", ")}`);
  log(`  test cases       ${testCases.length}  = ${stats.facts} [Fact] + ${stats.theories} [Theory] (${stats.inlineDataRows} InlineData rows retained as metadata)`);
  log(`  edges            ${summary.edges.total} across ${reverse.size} components, ${summary.edges.needs_review} NEEDS_REVIEW`);
  log(`  http calls       ${stats.httpCallsBound}/${stats.httpCallsTotal} bound to routes`);
  log(`  module evidence  ${JSON.stringify(stats.moduleEvidence)}`);
  log(`  flagged review   ${stats.obsoleteFlagged} tests link to nothing`);
  log(`  security         ${securityFindings.length} redaction findings`);
  if (stats.parseFailures.length) log(`  parse failures   ${stats.parseFailures.length}`);
  log(`  wrote            ${written.filter((w) => w.changed).length} of ${written.length} files changed${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`);
}

function loadComponents() {
  const components = [];
  if (!fs.existsSync(DATA_DIRS.source)) return components;
  for (const file of fs.readdirSync(DATA_DIRS.source)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    for (const component of readJson(path.join(DATA_DIRS.source, file))?.components ?? []) {
      components.push(component);
    }
  }
  return components;
}

function gitFor(relativePath, fileStates, lastCommits) {
  const state = fileStates.get(relativePath) ?? "COMMITTED";
  const commit = lastCommits.get(relativePath) ?? null;
  return {
    state,
    last_commit: commit?.sha ?? null,
    last_commit_date: commit?.date ?? null,
    last_commit_subject: commit?.subject ?? null,
    commit_count: commit?.commit_count ?? null,
  };
}

/**
 * `AddItem_WithNonPositiveQuantity_Throws` -> "Add item with non-positive quantity throws".
 *
 * Readable, and reversible to the method it came from — the point is a title a non-developer can
 * scan, not a new fact. The method name is retained verbatim in `machine.method` either way.
 */
function humanizeTestName(name) {
  const words = name
    .split("_")
    .map((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2"))
    .join(" ");
  const lowered = words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
  // Restore the capitalisation of acronyms and known proper nouns the lowercase pass flattened.
  return lowered.replace(/\b(api|http|jwt|pdf|url|id|ef|sql|whats app|dto)\b/gi, (m) =>
    m.toLowerCase() === "whats app" ? "WhatsApp" : m.toUpperCase());
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function normalizeRoute(route) {
  return route.replace(/\{[^}]*\}/g, "{param}").replace(/\/+$/, "").toLowerCase();
}

/**
 * Matches a literal test URL to a route template.
 *
 * A test calls `/api/v1/settings/Shop.BusinessName`; the controller declares `settings/{key}`. An
 * exact comparison never matches, so trailing segments are progressively treated as parameter
 * values and retried. Bounded to two segments: beyond that the "match" would be a coincidence of
 * shape rather than a route.
 */
function matchRoute(routeIndex, literalPath) {
  const exact = routeIndex.get(normalizeRoute(literalPath));
  if (exact) return exact;

  const segments = literalPath.split("/");
  for (let trailing = 1; trailing <= 2 && trailing < segments.length; trailing++) {
    const candidate = [...segments];
    for (let offset = 0; offset < trailing; offset++) {
      candidate[candidate.length - 1 - offset] = "{param}";
    }
    const match = routeIndex.get(normalizeRoute(candidate.join("/")));
    if (match) return match;
  }
  return null;
}

main();
