/**
 * Phase 4 — traceability and coverage.
 *
 * Closes the graph in both directions:
 *
 *     FR  →  FEAT  →  BR  →  COMP  →  TC
 *     TC  →  COMP  →  BR  →  FEAT  →  FR
 *
 * and computes, for every requirement, feature and rule, the three questions kept deliberately
 * apart:
 *
 *     SPECIFIED    is it written down in the FRS?
 *     IMPLEMENTED  is there code evidence?
 *     TESTED       does a real test exercise it?
 *
 * Conflating those hides the two findings worth having. "Specified but not implemented" is work not
 * done. "Implemented but not specified" is behaviour nobody asked for — and in a product sold to
 * multiple shops, that is the more expensive of the two.
 *
 * THE REQUIREMENT→CODE EDGE IS EARNED, NOT ASSUMED. It comes from the 184 spec citations this
 * team already maintains by hand in its source comments (`00_MASTER_SPEC.md § 8.3`). A requirement
 * harvested from § 8.3 is linked to every component whose comments cite § 8.3 — evidence written by
 * the developers, not a keyword match invented here.
 *
 * Derived edges live in the ignored registry. Only the coverage summaries are written back into
 * docs/data, and only into machine-owned fields.
 *
 * Usage: node scripts/documentation/build-traceability.mjs [--dry-run] [--quiet]
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_DIRS, REPO_ROOT, readJson, writeJson, writeJsonIfChanged } from "./lib/paths.mjs";
import * as git from "./lib/git.mjs";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const QUIET = args.has("--quiet");
const log = (...parts) => { if (!QUIET) console.log(...parts); };

function main() {
  const now = new Date().toISOString();
  const branch = git.currentBranch();
  const head = git.headSha();

  const components = loadGrouped(DATA_DIRS.source, "components");
  const testCases = loadGrouped(DATA_DIRS.testcases, "test_cases");
  const rules = loadGrouped(DATA_DIRS.rules, "rules");
  const requirements = loadIndividual(DATA_DIRS.requirements);
  const features = loadIndividual(DATA_DIRS.features);

  const componentById = new Map(components.map((c) => [c.id, c]));

  // ---------------------------------------------------------------- COMP <-> TC

  const testsByComponent = new Map();
  const componentsByTest = new Map();
  for (const testCase of testCases) {
    for (const edge of testCase.machine?.exercises ?? []) {
      push(testsByComponent, edge.component, { test_case: testCase.id, via: edge.via, confidence: edge.confidence });
      push(componentsByTest, testCase.id, { component: edge.component, via: edge.via, confidence: edge.confidence });
    }
  }

  // ---------------------------------------------------------------- FR <-> COMP, from doc citations

  const citationIndex = new Map();
  for (const component of components) {
    for (const citation of component.machine?.doc_citations ?? []) {
      const key = `${citation.document}|${citation.section.replace(/\s+/g, " ").trim()}`;
      push(citationIndex, key, { component: component.id, line: citation.line });
    }
  }

  const componentsByRequirement = new Map();
  const requirementsByComponent = new Map();
  for (const requirement of requirements) {
    const document = path.basename(requirement.source.document);
    const key = `${document}|${requirement.source.section.replace(/\s+/g, " ").trim()}`;
    for (const hit of citationIndex.get(key) ?? []) {
      push(componentsByRequirement, requirement.id, {
        component: hit.component, via: "doc-citation", confidence: "CONFIRMED", line: hit.line,
      });
      push(requirementsByComponent, hit.component, {
        requirement: requirement.id, via: "doc-citation", confidence: "CONFIRMED",
      });
    }
  }

  // ---------------------------------------------------------------- FEAT <-> BR, COMP, FR

  const rulesByComponent = new Map();
  for (const rule of rules) {
    for (const componentId of rule.components ?? []) {
      push(rulesByComponent, componentId, { rule: rule.id, category: rule.category });
    }
  }

  const rulesByFeature = new Map();
  const featuresByComponent = new Map();
  for (const feature of features) {
    for (const componentId of feature.machine?.derived_components ?? []) {
      push(featuresByComponent, componentId, { feature: feature.id });
      for (const link of rulesByComponent.get(componentId) ?? []) {
        push(rulesByFeature, feature.id, link);
      }
    }
  }

  const featuresByRequirement = new Map();
  for (const feature of features) {
    for (const requirementId of feature.machine?.derived_requirements ?? []) {
      push(featuresByRequirement, requirementId, { feature: feature.id, via: "module", confidence: "INFERRED" });
    }
  }

  // ---------------------------------------------------------------- coverage

  const requirementUpdates = [];
  for (const requirement of requirements) {
    const linkedComponents = componentsByRequirement.get(requirement.id) ?? [];
    const linkedTests = new Set();
    for (const link of linkedComponents) {
      for (const test of testsByComponent.get(link.component) ?? []) linkedTests.add(test.test_case);
    }

    requirement.implementation_evidence = linkedComponents.map((link) => ({
      component: link.component,
      via: "doc-citation",
      confidence: "CONFIRMED",
      detail: `source comment cites ${requirement.source.section} at line ${link.line}`,
    }));

    requirement.coverage = {
      specified: "YES", // it exists in the FRS by construction — that is where it came from
      implemented: linkedComponents.length === 0 ? "NOT_FOUND" : "YES",
      tested: linkedTests.size === 0 ? "NOT_FOUND" : linkedTests.size >= linkedComponents.length ? "YES" : "PARTIAL",
      component_count: linkedComponents.length,
      test_count: linkedTests.size,
      computed_at: now,
    };
    requirementUpdates.push(requirement);
  }

  const featureUpdates = [];
  for (const feature of features) {
    const ruleLinks = rulesByFeature.get(feature.id) ?? [];
    // derived_rules is written by harvest-features; traceability only reads it.
    feature.coverage = {
      ...feature.coverage,
      rule_count: feature.machine.derived_rules.length,
      computed_at: now,
    };
    featureUpdates.push(feature);
  }

  // ---------------------------------------------------------------- gaps

  const gaps = {
    requirements_without_implementation: requirements.filter((r) => r.coverage.implemented === "NOT_FOUND").map((r) => r.id),
    requirements_without_tests: requirements.filter((r) => r.coverage.tested === "NOT_FOUND").map((r) => r.id),
    features_without_requirements: features.filter((f) => (f.machine.derived_requirements ?? []).length === 0).map((f) => f.id),
    features_without_tests: features.filter((f) => (f.coverage?.test_count ?? 0) === 0).map((f) => f.id),
    features_without_rules: features.filter((f) => (f.machine.derived_rules ?? []).length === 0).map((f) => f.id),
    rules_without_specification: rules.filter((r) => r.origin === "IMPLEMENTED").map((r) => r.id),
    rules_without_tests: rules.filter((r) => (r.coverage?.test_count ?? 0) === 0).map((r) => r.id),
    components_without_tests: components.filter((c) => !testsByComponent.has(c.id) && c.layer !== "Web").map((c) => c.id),
    components_without_feature: components.filter((c) => !featuresByComponent.has(c.id)).map((c) => c.id),
    tests_without_requirement_path: testCases.filter((t) => {
      for (const edge of t.machine?.exercises ?? []) {
        if (requirementsByComponent.has(edge.component)) return false;
      }
      return true;
    }).map((t) => t.id),
  };

  // ---------------------------------------------------------------- write

  const graph = {
    branch, head, generated_at: now,
    note: "Derived traceability. Regenerated on every run from docs/data/**; never committed, never a source of truth.",
    counts: {
      requirements: requirements.length,
      features: features.length,
      rules: rules.length,
      components: components.length,
      test_cases: testCases.length,
    },
    edges: {
      requirement_to_component: countEdges(componentsByRequirement),
      requirement_to_feature: countEdges(featuresByRequirement),
      feature_to_component: sumSizes(featuresByComponent),
      feature_to_rule: countEdges(rulesByFeature),
      rule_to_component: sumSizes(rulesByComponent),
      component_to_test: countEdges(testsByComponent),
    },
    forward: {
      requirement_to_component: mapToObject(componentsByRequirement),
      requirement_to_feature: mapToObject(featuresByRequirement),
      feature_to_rule: mapToObject(rulesByFeature),
      component_to_test: mapToObject(testsByComponent),
    },
    reverse: {
      component_to_requirement: mapToObject(requirementsByComponent),
      component_to_feature: mapToObject(featuresByComponent),
      component_to_rule: mapToObject(rulesByComponent),
      test_to_component: mapToObject(componentsByTest),
    },
    gaps: Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, { count: v.length, sample: v.slice(0, 10) }])),
  };

  const coverage = {
    generated_at: now,
    requirements: {
      total: requirements.length,
      specified: requirements.length,
      implemented: requirements.filter((r) => r.coverage.implemented === "YES").length,
      tested: requirements.filter((r) => r.coverage.tested !== "NOT_FOUND").length,
      not_found_implementation: gaps.requirements_without_implementation.length,
    },
    features: {
      total: features.length,
      with_requirements: features.filter((f) => (f.machine.derived_requirements ?? []).length > 0).length,
      with_components: features.filter((f) => (f.coverage?.component_count ?? 0) > 0).length,
      with_tests: features.filter((f) => (f.coverage?.test_count ?? 0) > 0).length,
      with_rules: features.filter((f) => (f.machine.derived_rules ?? []).length > 0).length,
      by_status: countBy(features, (f) => f.implementation_status),
    },
    rules: {
      total: rules.length,
      specified: rules.filter((r) => r.origin !== "IMPLEMENTED").length,
      implemented: rules.length,
      tested: rules.filter((r) => (r.coverage?.test_count ?? 0) > 0).length,
      by_category: countBy(rules, (r) => r.category),
    },
    components: {
      total: components.length,
      with_tests: testsByComponent.size,
      with_requirements: requirementsByComponent.size,
      with_features: featuresByComponent.size,
      with_rules: rulesByComponent.size,
    },
    test_cases: {
      total: testCases.length,
      reaching_a_requirement: testCases.length - gaps.tests_without_requirement_path.length,
    },
  };

  let written = 0;
  if (!DRY_RUN) {
    writeJson(path.join(REPO_ROOT, "docs/registry/traceability.json"), graph);
    writeJson(path.join(REPO_ROOT, "docs/registry/coverage.json"), coverage);

    for (const requirement of requirementUpdates) {
      const file = path.join(DATA_DIRS.requirements, `${requirement.id}.json`);
      if (writeJsonIfChanged(file, requirement)) written++;
    }
    for (const feature of featureUpdates) {
      const file = path.join(DATA_DIRS.features, `${feature.id}.json`);
      if (writeJsonIfChanged(file, feature)) written++;
    }
  }

  log(`Traceability on ${branch} @ ${head.slice(0, 8)}`);
  log(`  entities             FR ${requirements.length}  FEAT ${features.length}  BR ${rules.length}  COMP ${components.length}  TC ${testCases.length}`);
  log(`  edges                ${JSON.stringify(graph.edges)}`);
  log("");
  log(`  REQUIREMENTS  specified ${coverage.requirements.specified}  implemented ${coverage.requirements.implemented}  tested ${coverage.requirements.tested}`);
  log(`  FEATURES      with FRS ${coverage.features.with_requirements}/${features.length}  with code ${coverage.features.with_components}  with tests ${coverage.features.with_tests}  with rules ${coverage.features.with_rules}`);
  log(`  RULES         specified ${coverage.rules.specified}/${rules.length}  tested ${coverage.rules.tested}`);
  log(`  COMPONENTS    with tests ${coverage.components.with_tests}  with FRS ${coverage.components.with_requirements}  with features ${coverage.components.with_features}  with rules ${coverage.components.with_rules}`);
  log("");
  log("  GAPS");
  for (const [name, gap] of Object.entries(graph.gaps)) {
    log(`    ${name.padEnd(38)} ${gap.count}`);
  }
  log("");
  log(`  wrote ${written} data files updated with coverage${DRY_RUN ? " (DRY RUN)" : ""}`);
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function mapToObject(map) {
  return Object.fromEntries([...map.entries()].sort());
}

function countEdges(map) {
  let total = 0;
  for (const list of map.values()) total += list.length;
  return total;
}

function sumSizes(map) {
  return countEdges(map);
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function loadGrouped(dir, key) {
  const items = [];
  if (!fs.existsSync(dir)) return items;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    for (const item of readJson(path.join(dir, file))?.[key] ?? []) items.push(item);
  }
  return items;
}

function loadIndividual(dir) {
  const items = [];
  if (!fs.existsSync(dir)) return items;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const item = readJson(path.join(dir, file));
    if (item?.id) items.push(item);
  }
  return items;
}

main();
