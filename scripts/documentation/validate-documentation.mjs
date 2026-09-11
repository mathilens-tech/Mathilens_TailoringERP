/**
 * Documentation validation.
 *
 * Four tiers, in order of how certain they are. A check is only worth promoting to ERROR once it
 * has been reliably quiet on a healthy repository — a gate that cries wolf gets switched off, and
 * then it protects nothing.
 *
 *   1. SCHEMA      — does every file match its JSON Schema, and is every ID unique and well formed?
 *   2. REFERENTIAL — does every cross-reference resolve to an entity that exists?
 *   3. EVIDENCE    — does the evidence still exist? A component whose file has been deleted is
 *                    documentation that has quietly become fiction, and is demoted, not trusted.
 *   4. POLICY      — coverage, freshness, approval integrity, secret exposure.
 *
 * Default mode is WARN: it reports and exits 0. `--mode=error` fails the run on any ERROR-severity
 * finding, which is what CI will eventually use.
 *
 * Usage:
 *   node scripts/documentation/validate-documentation.mjs [--mode=warn|error] [--json] [--quiet]
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DATA, DATA_DIRS, REPO_ROOT, abs, rel, readJson, writeJson } from "./lib/paths.mjs";
import { validateAgainst, validateAgainstDef, loadValidators } from "./lib/schema.mjs";
import { scrub } from "./lib/redact.mjs";
import * as git from "./lib/git.mjs";

const args = process.argv.slice(2);
const MODE = (args.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "warn").toLowerCase();
const AS_JSON = args.includes("--json");
const QUIET = args.includes("--quiet");

const findings = [];
const add = (severity, check, message, where = null) =>
  findings.push({ severity, check, message, where });

const ERROR = "ERROR";
const WARN = "WARN";
const INFO = "INFO";

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));
}

function main() {
  const started = Date.now();
  const { files: schemaFiles } = loadValidators();

  const entities = new Map(); // id -> { type, file }
  const stats = {
    schemas: schemaFiles.length,
    components: 0, requirements: 0, features: 0, testCases: 0,
    testPlans: 0, issues: 0, changes: 0, risks: 0, rules: 0, links: 0, migrations: 0,
    filesValidated: 0,
  };

  // ---------------------------------------------------------------- 1. schema

  // Components — one file per module, plus the migration history.
  for (const file of listJson(DATA_DIRS.source)) {
    const name = path.basename(file);
    if (name.startsWith("_migrations")) {
      const data = readJson(file);
      const result = validateAgainstDef("support.schema.json", "migrationHistory", data);
      stats.filesValidated++;
      if (!result.ok) for (const error of result.errors) add(ERROR, "schema", error, rel(file));
      stats.migrations = data?.migrations?.length ?? 0;
      continue;
    }
    const data = readJson(file);
    const result = validateAgainst("component.schema.json", data);
    stats.filesValidated++;
    if (!result.ok) for (const error of result.errors) add(ERROR, "schema", error, rel(file));

    for (const component of data?.components ?? []) {
      stats.components++;
      register(entities, component.id, "component", rel(file));
    }
  }

  validateDirectory(DATA_DIRS.requirements, "requirement.schema.json", null, "requirement", entities, stats, "requirements");
  validateDirectory(DATA_DIRS.features, "feature.schema.json", null, "feature", entities, stats, "features");
  validateDirectory(DATA_DIRS.testplans, "support.schema.json", "testPlan", "testPlan", entities, stats, "testPlans");
  validateDirectory(DATA_DIRS.issues, "support.schema.json", "issue", "issue", entities, stats, "issues");
  validateDirectory(DATA_DIRS.changes, "support.schema.json", "change", "change", entities, stats, "changes");
  validateDirectory(DATA_DIRS.risks, "support.schema.json", "risk", "risk", entities, stats, "risks");

  // Business rules — one file per module, same shape as components and test cases.
  for (const file of listJson(DATA_DIRS.rules)) {
    const data = readJson(file);
    const result = validateAgainst("rule.schema.json", data);
    stats.filesValidated++;
    if (!result.ok) for (const error of result.errors) add(ERROR, "schema", error, rel(file));
    for (const rule of data?.rules ?? []) {
      stats.rules++;
      register(entities, rule.id, "rule", rel(file));
    }
  }

  // Test cases — one file per module, same shape as components.
  for (const file of listJson(DATA_DIRS.testcases)) {
    const data = readJson(file);
    const result = validateAgainst("testcase.schema.json", data);
    stats.filesValidated++;
    if (!result.ok) for (const error of result.errors) add(ERROR, "schema", error, rel(file));
    for (const testCase of data?.test_cases ?? []) {
      stats.testCases++;
      register(entities, testCase.id, "testCase", rel(file));
    }
  }

  // Branch registry.
  const branchesFile = path.join(DATA, "branches.json");
  const branches = readJson(branchesFile);
  if (branches) {
    const result = validateAgainst("branches.schema.json", branches);
    stats.filesValidated++;
    if (!result.ok) for (const error of result.errors) add(ERROR, "schema", error, rel(branchesFile));
  } else {
    add(WARN, "schema", "docs/data/branches.json is missing — branch awareness cannot run", "docs/data/branches.json");
  }

  // ID ledgers — one per entity family, all validated the same way.
  for (const name of fs.readdirSync(DATA).filter((f) => f.endsWith("-id-ledger.json"))) {
    const ledgerFile = path.join(DATA, name);
    const ledger = readJson(ledgerFile);
    if (!ledger) continue;
    const result = validateAgainstDef("support.schema.json", "idLedger", ledger);
    stats.filesValidated++;
    if (!result.ok) for (const error of result.errors) add(ERROR, "schema", error, rel(ledgerFile));

    // Every live entity must have a ledger entry, or its ID was minted outside the ledger and is
    // not stable — the failure mode the ledger exists to prevent.
    const assigned = new Set(Object.values(ledger.entries ?? {}).filter((e) => !e.retired).map((e) => e.id));
    const prefix = `${ledger.prefix}-`;
    for (const [id, meta] of entities) {
      if (!id.startsWith(prefix)) continue;
      if (!assigned.has(id)) {
        add(ERROR, "identity", `${id} exists in ${meta.file} but has no live ledger entry in ${name}`, meta.file);
      }
    }
  }

  // ---------------------------------------------------------------- 2. referential

  const referenceFields = {
    requirements: "requirement",
    features: "feature",
    components: "component",
    test_cases: "testCase",
    test_plans: "testPlan",
    rules: "rule",
  };

  for (const file of listJson(DATA_DIRS.source)) {
    if (path.basename(file).startsWith("_")) continue;
    const data = readJson(file);
    for (const component of data?.components ?? []) {
      checkReferences(component, referenceFields, entities, rel(file), component.id);
    }
  }
  for (const file of listJson(DATA_DIRS.rules)) {
    const data = readJson(file);
    for (const rule of data?.rules ?? []) {
      checkReferences(rule, referenceFields, entities, rel(file), rule.id);
      for (const enforcement of rule.enforced_by ?? []) {
        if (enforcement.component && !entities.has(enforcement.component)) {
          add(ERROR, "reference", rule.id + " is enforced_by " + enforcement.component + ", which does not resolve", rel(file));
        }
        if (!fs.existsSync(abs(enforcement.file))) {
          add(ERROR, "evidence", rule.id + " cites " + enforcement.file + ", which no longer exists", rel(file));
        }
      }
    }
  }

  for (const dir of [DATA_DIRS.requirements, DATA_DIRS.features, DATA_DIRS.testplans, DATA_DIRS.risks, DATA_DIRS.issues]) {
    for (const file of listJson(dir)) {
      const data = readJson(file);
      if (data && data.id) checkReferences(data, referenceFields, entities, rel(file), data.id);
    }
  }

  // Test cases: human-asserted links, plus the DERIVED Component -> TestCase edges, plus the one
  // claim a test entity makes that can be checked directly — that the method it names exists.
  let derivedEdges = 0;
  let derivedEdgesUnresolved = 0;
  let automationRefsChecked = 0;
  const componentsUnderTest = new Set();

  for (const file of listJson(DATA_DIRS.testcases)) {
    const data = readJson(file);
    for (const testCase of data?.test_cases ?? []) {
      checkReferences(testCase, referenceFields, entities, rel(file), testCase.id);

      if (testCase.subject_component && !entities.has(testCase.subject_component)) {
        add(ERROR, "reference", `${testCase.id}.subject_component -> ${testCase.subject_component} does not resolve`, rel(file));
      }

      for (const edge of testCase.machine?.exercises ?? []) {
        derivedEdges++;
        if (!entities.has(edge.component)) {
          derivedEdgesUnresolved++;
          add(ERROR, "reference", `${testCase.id} exercises ${edge.component}, which does not resolve to a component`, rel(file));
        } else {
          componentsUnderTest.add(edge.component);
        }
      }

      // An AUTOMATED case claims a real test method. If the file has gone, the claim is stale —
      // this is the check that stops the registry quietly describing tests that no longer exist.
      if (testCase.automation === "AUTOMATED") {
        automationRefsChecked++;
        const [testFile, methodRef] = (testCase.automation_ref ?? "").split("::");
        if (!testFile || !fs.existsSync(abs(testFile))) {
          add(ERROR, "evidence", `${testCase.id} is AUTOMATED but ${testFile || "(no ref)"} does not exist`, rel(file));
        } else if (methodRef) {
          const method = methodRef.split(".").pop();
          const source = fs.readFileSync(abs(testFile), "utf8");
          if (!new RegExp(`\\b${method}\\s*\\(`).test(source)) {
            add(WARN, "evidence", `${testCase.id} names method ${methodRef}, which was not found in ${testFile}`, rel(file));
          }
        }
        if (testCase.last_result !== null && testCase.last_result !== undefined && !testCase.last_result.run_id) {
          add(ERROR, "evidence", `${testCase.id} records a result with no run_id — a result must name the run that produced it`, rel(file));
        }
      }
    }
  }

  // ---------------------------------------------------------------- 3. evidence

  const fileStates = git.isRepo() ? git.fileStates() : new Map();
  let missingEvidence = 0;
  let uncommittedEntities = 0;

  for (const file of listJson(DATA_DIRS.source)) {
    if (path.basename(file).startsWith("_")) continue;
    const data = readJson(file);
    for (const component of data?.components ?? []) {
      if (component.path && !fs.existsSync(abs(component.path))) {
        missingEvidence++;
        add(
          ERROR,
          "evidence",
          `${component.id} documents ${component.path}, which no longer exists — the entity is describing something that is gone`,
          rel(file),
        );
      }
      if (component.machine?.git?.state === "UNCOMMITTED") {
        uncommittedEntities++;
        if (component.provenance?.confidence === "CONFIRMED") {
          add(
            ERROR,
            "evidence",
            `${component.id} is CONFIRMED but its file is untracked — an uncommitted working tree is not branch truth`,
            rel(file),
          );
        }
      }
      if (component.provenance?.confidence === "CONFIRMED" && (component.provenance.evidence?.length ?? 0) === 0) {
        add(ERROR, "evidence", `${component.id} claims CONFIRMED with no evidence`, rel(file));
      }
    }
  }

  // ---------------------------------------------------------------- 4. policy

  // Approval integrity: an approved requirement whose normative fields no longer hash to the
  // recorded value has been edited without re-approval. This is the check that binds everyone,
  // including this tooling.
  for (const file of listJson(DATA_DIRS.requirements)) {
    const requirement = readJson(file);
    if (!requirement?.approval?.approved) continue;
    const expected = requirement.approval.content_hash;
    const actual = requirementHash(requirement);
    if (!expected) {
      add(ERROR, "approval", `${requirement.id} is approved but carries no content_hash`, rel(file));
    } else if (expected !== actual) {
      add(
        ERROR,
        "approval",
        `${requirement.id} APPROVAL BROKEN: normative fields changed without re-approval (expected ${expected.slice(0, 18)}…, computed ${actual.slice(0, 18)}…)`,
        rel(file),
      );
    }
  }

  // Secret exposure over everything committed under docs/data.
  let secretFindings = 0;
  for (const file of allDataFiles()) {
    const data = readJson(file);
    if (!data) continue;
    const { findings: leaked } = scrub(data, { context: `${rel(file)}:` });
    for (const leak of leaked) {
      secretFindings++;
      add(ERROR, "secret", `possible credential in committed documentation (${leak.kind}) at ${leak.context}`, rel(file));
    }
  }

  // Coverage — reported as INFO while the layers that populate them are still being built. These
  // become real gates once Phases 3-6 have run.
  const productComponents = countComponents((c) => c.layer !== "Tests" && c.layer !== "Tools");
  const coverage = {
    components_total: stats.components,
    components_with_purpose: countComponents((c) => Boolean(c.purpose)),
    components_with_knowledge_ref: countComponents((c) => Boolean(c.knowledge_ref)),
    components_linked_to_feature: countComponents((c) => (c.features?.length ?? 0) > 0),
    components_linked_to_requirement: countComponents((c) => (c.requirements?.length ?? 0) > 0),
    // Derived Component <- TestCase coverage. Distinct from `components_with_tests`, which counts
    // links a person asserted; this counts what the evidence supports.
    components_covered_by_tests: componentsUnderTest.size,
    components_product_total: productComponents,
    component_test_coverage_percent: productComponents
      ? Math.round((componentsUnderTest.size / productComponents) * 1000) / 10
      : 0,
    components_with_asserted_tests: countComponents((c) => (c.test_cases?.length ?? 0) > 0),
    requirements_total: stats.requirements,
    features_total: stats.features,
    test_cases_total: stats.testCases,
    test_cases_automated: countTestCases((t) => t.automation === "AUTOMATED"),
    test_cases_with_results: countTestCases((t) => Boolean(t.last_result)),
    test_cases_flagged_for_review: countTestCases((t) => Boolean(t.obsolete_review)),
    derived_test_edges: derivedEdges,
    derived_test_edges_unresolved: derivedEdgesUnresolved,
    automation_refs_checked: automationRefsChecked,
  };

  for (const [label, expectedPhase] of [
    ["requirements_total", "Phase 4"],
    ["features_total", "Phase 4"],
    ["test_cases_total", "Phase 3"],
  ]) {
    if (coverage[label] === 0) {
      add(INFO, "coverage", `${label} is 0 — populated by ${expectedPhase}, not yet run`, null);
    }
  }

  // ---------------------------------------------------------------- report

  const elapsed = ((Date.now() - started) / 1000).toFixed(2);
  const counts = {
    ERROR: findings.filter((f) => f.severity === ERROR).length,
    WARN: findings.filter((f) => f.severity === WARN).length,
    INFO: findings.filter((f) => f.severity === INFO).length,
  };

  const report = {
    mode: MODE,
    generated_at: new Date().toISOString(),
    branch: git.isRepo() ? git.currentBranch() : null,
    head: git.isRepo() ? git.headSha() : null,
    elapsed_seconds: Number(elapsed),
    stats,
    coverage,
    evidence: { missing: missingEvidence, uncommitted_entities: uncommittedEntities },
    secrets: secretFindings,
    counts,
    findings,
  };

  writeJson(path.join(REPO_ROOT, "docs/registry/validation-report.json"), report);

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!QUIET) {
    console.log(`Validation (${MODE} mode) — ${stats.filesValidated} files, ${entities.size} entities, ${elapsed}s`);
    console.log(`  components ${stats.components}  requirements ${stats.requirements}  features ${stats.features}  rules ${stats.rules}  test cases ${stats.testCases}  migrations ${stats.migrations}`);
    console.log(`  ERROR ${counts.ERROR}   WARN ${counts.WARN}   INFO ${counts.INFO}`);
    for (const finding of findings.slice(0, 40)) {
      console.log(`  [${finding.severity}] ${finding.check}: ${finding.message}${finding.where ? `  (${finding.where})` : ""}`);
    }
    if (findings.length > 40) console.log(`  … ${findings.length - 40} more (see docs/registry/validation-report.json)`);
  }

  if (MODE === "error" && counts.ERROR > 0) process.exit(1);
}

function allDataFiles() {
  const files = [];
  const walkDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (entry.name.endsWith(".json")) files.push(full);
    }
  };
  walkDir(DATA);
  return files;
}

function register(entities, id, type, file) {
  if (!id) return;
  if (entities.has(id)) {
    add(ERROR, "identity", `duplicate id ${id} (also in ${entities.get(id).file})`, file);
    return;
  }
  entities.set(id, { type, file });
}

function checkReferences(entity, fields, entities, file, ownerId) {
  for (const [field, expectedType] of Object.entries(fields)) {
    for (const reference of entity[field] ?? []) {
      const target = entities.get(reference);
      if (!target) {
        add(ERROR, "reference", `${ownerId}.${field} -> ${reference} does not resolve to any entity`, file);
      } else if (target.type !== expectedType) {
        add(ERROR, "reference", `${ownerId}.${field} -> ${reference} is a ${target.type}, expected ${expectedType}`, file);
      }
    }
  }
}

function validateDirectory(dir, schemaId, defName, entityType, entities, stats, statKey) {
  for (const file of listJson(dir)) {
    const data = readJson(file);
    if (!data) continue;
    const result = defName ? validateAgainstDef(schemaId, defName, data) : validateAgainst(schemaId, data);
    stats.filesValidated++;
    if (!result.ok) for (const error of result.errors) add(ERROR, "schema", error, rel(file));
    stats[statKey]++;
    register(entities, data.id, entityType, rel(file));
  }
}

function countComponents(predicate) {
  let count = 0;
  for (const file of listJson(DATA_DIRS.source)) {
    if (path.basename(file).startsWith("_")) continue;
    for (const component of readJson(file)?.components ?? []) {
      if (predicate(component)) count++;
    }
  }
  return count;
}

function countTestCases(predicate) {
  let count = 0;
  for (const file of listJson(DATA_DIRS.testcases)) {
    for (const testCase of readJson(file)?.test_cases ?? []) {
      if (predicate(testCase)) count++;
    }
  }
  return count;
}

/**
 * Hash over the NORMATIVE fields only, so re-ordering links or refreshing provenance does not break
 * an approval, while changing what the requirement actually says does.
 */
function requirementHash(requirement) {
  const normative = {
    title: requirement.title,
    description: requirement.description,
    business_purpose: requirement.business_purpose ?? null,
    actors: requirement.actors ?? [],
    preconditions: requirement.preconditions ?? [],
    main_flow: requirement.main_flow ?? [],
    alternate_flow: requirement.alternate_flow ?? [],
    business_rules: requirement.business_rules ?? [],
    validation: requirement.validation ?? [],
    expected_result: requirement.expected_result ?? null,
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(normative)).digest("hex")}`;
}

/** Exported so the approval hash is computed the same way wherever a requirement is approved. */
export { requirementHash };

main();
