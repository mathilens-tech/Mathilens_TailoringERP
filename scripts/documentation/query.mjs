/**
 * Evidence-backed answers to the questions this platform exists to answer.
 *
 * Every answer is read from docs/data/** and the derived registry — nothing is computed by
 * judgement here, and every line printed can be traced back to a file and a line number in the
 * repository. If the data does not support an answer, the answer is "not found", not a guess.
 *
 * Usage:
 *   node scripts/documentation/query.mjs component <path-or-name>
 *   node scripts/documentation/query.mjs gaps
 *   node scripts/documentation/query.mjs impact <path>
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_DIRS, REPO_ROOT, readJson } from "./lib/paths.mjs";

const [command, argument] = process.argv.slice(2);

const components = loadGrouped(DATA_DIRS.source, "components");
const testCases = loadGrouped(DATA_DIRS.testcases, "test_cases");
const rules = loadGrouped(DATA_DIRS.rules, "rules");
const requirements = loadIndividual(DATA_DIRS.requirements);
const features = loadIndividual(DATA_DIRS.features);
const trace = readJson(path.join(REPO_ROOT, "docs/registry/traceability.json"));

const byId = new Map(components.map((c) => [c.id, c]));

if (command === "component") answerComponent(argument);
else if (command === "gaps") answerGaps();
else if (command === "impact") answerImpact(argument);
else {
  console.log("Usage: query.mjs component <path|name> | gaps | impact <path>");
  process.exit(1);
}

function findComponents(needle) {
  return components.filter((c) => c.path === needle || c.name === needle || c.name.replace(/<.*$/, "") === needle);
}

function answerComponent(needle) {
  const matches = findComponents(needle);
  if (!matches.length) { console.log(`No component matches "${needle}".`); return; }

  for (const component of matches) {
    console.log(`\n${component.id}  ${component.name}   [${component.kind}, ${component.layer}, ${component.module}]`);
    console.log(`  ${component.path}${component.knowledge_ref ? `   → ${component.knowledge_ref}` : ""}`);

    const reqs = trace.reverse.component_to_requirement[component.id] ?? [];
    console.log(`\n  REQUIREMENTS implemented by it (${reqs.length}) — via developer-written spec citations`);
    for (const link of reqs.slice(0, 6)) {
      const requirement = requirements.find((r) => r.id === link.requirement);
      console.log(`    ${link.requirement}  ${requirement?.source.section}  ${truncate(requirement?.title, 70)}`);
    }

    const feats = trace.reverse.component_to_feature[component.id] ?? [];
    console.log(`\n  PRODUCT FEATURES depending on it (${feats.length})`);
    for (const link of feats) {
      const feature = features.find((f) => f.id === link.feature);
      console.log(`    ${link.feature}  ${feature?.name}   [${feature?.implementation_status}]`);
    }

    const ruleLinks = trace.reverse.component_to_rule[component.id] ?? [];
    console.log(`\n  BUSINESS RULES implemented by it (${ruleLinks.length})`);
    for (const link of ruleLinks.slice(0, 8)) {
      const rule = rules.find((r) => r.id === link.rule);
      console.log(`    ${link.rule}  [${rule?.category}]  ${truncate(rule?.statement, 78)}`);
    }
    if (ruleLinks.length > 8) console.log(`    … ${ruleLinks.length - 8} more`);

    const tests = trace.forward.component_to_test[component.id] ?? [];
    console.log(`\n  TESTS exercising it (${tests.length})`);
    for (const link of tests.slice(0, 6)) {
      const testCase = testCases.find((t) => t.id === link.test_case);
      console.log(`    ${link.test_case}  [${link.via}, ${link.confidence}]  ${truncate(testCase?.title, 60)}  ${testCase?.last_result?.outcome ?? "NOT_RUN"}`);
    }
    if (tests.length > 6) console.log(`    … ${tests.length - 6} more`);
  }
}

function answerImpact(needle) {
  const matches = findComponents(needle);
  if (!matches.length) { console.log(`No component matches "${needle}".`); return; }

  const reverse = new Map();
  for (const component of components) {
    for (const dependency of component.machine.depends_on) {
      if (!dependency.target_component) continue;
      if (!reverse.has(dependency.target_component)) reverse.set(dependency.target_component, []);
      reverse.get(dependency.target_component).push({ id: component.id, via: dependency.via, evidence: dependency.evidence });
    }
  }

  for (const component of matches) {
    console.log(`\nIMPACT OF CHANGING  ${component.path}  (${component.id} ${component.name})`);

    const direct = reverse.get(component.id) ?? [];
    console.log(`\n  DIRECT dependents (${direct.length})`);
    for (const dependent of direct.slice(0, 10)) {
      const evidence = dependent.evidence ? ` — ${dependent.evidence.file.split("/").pop()}:${dependent.evidence.line}` : "";
      console.log(`    ${dependent.id.padEnd(20)} ${byId.get(dependent.id)?.name.padEnd(38) ?? ""} [${dependent.via}]${evidence}`);
    }

    const reached = new Map([[component.id, 0]]);
    const queue = [component.id];
    while (queue.length) {
      const current = queue.shift();
      const hops = reached.get(current);
      if (hops >= 3) continue;
      for (const dependent of reverse.get(current) ?? []) {
        if (!reached.has(dependent.id)) { reached.set(dependent.id, hops + 1); queue.push(dependent.id); }
      }
    }

    const directTests = new Set((trace.forward.component_to_test[component.id] ?? []).map((t) => t.test_case));
    const allTests = new Set();
    for (const id of reached.keys()) {
      for (const link of trace.forward.component_to_test[id] ?? []) allTests.add(link.test_case);
    }
    const featuresHit = new Set();
    const rulesHit = new Set();
    const requirementsHit = new Set();
    for (const id of reached.keys()) {
      for (const link of trace.reverse.component_to_feature[id] ?? []) featuresHit.add(link.feature);
      for (const link of trace.reverse.component_to_rule[id] ?? []) rulesHit.add(link.rule);
      for (const link of trace.reverse.component_to_requirement[id] ?? []) requirementsHit.add(link.requirement);
    }

    console.log(`\n  REACHED within 3 hops   ${reached.size - 1} components`);
    console.log(`  TESTS  direct ${directTests.size}   including indirect ${allTests.size}`);
    console.log(`  FEATURES affected       ${featuresHit.size}   ${[...featuresHit].slice(0, 5).join(", ")}`);
    console.log(`  BUSINESS RULES affected ${rulesHit.size}`);
    console.log(`  REQUIREMENTS affected   ${requirementsHit.size}   ${[...requirementsHit].slice(0, 5).join(", ")}`);
  }
}

function answerGaps() {
  const coverage = readJson(path.join(REPO_ROOT, "docs/registry/coverage.json"));

  console.log("\nWHICH REQUIREMENTS ARE IMPLEMENTED BUT NOT TESTED");
  const implementedNotTested = requirements.filter((r) => r.coverage?.implemented === "YES" && r.coverage?.tested === "NOT_FOUND");
  console.log(`  ${implementedNotTested.length} of ${requirements.length}`);
  for (const requirement of implementedNotTested.slice(0, 5)) {
    console.log(`    ${requirement.id}  ${requirement.source.section}  ${truncate(requirement.title, 68)}`);
  }

  console.log("\nWHICH IMPLEMENTED FEATURES HAVE NO FRS REQUIREMENT");
  const undocumented = features.filter((f) => f.implementation_status === "UNDOCUMENTED_CODE");
  console.log(`  ${undocumented.length} of ${features.length}`);
  for (const feature of undocumented) {
    console.log(`    ${feature.id}  ${feature.name.padEnd(34)} ${feature.coverage.component_count} components, ${feature.coverage.test_count} tests`);
  }

  console.log("\nWHICH FRS REQUIREMENTS HAVE NO IMPLEMENTATION EVIDENCE");
  const unimplemented = requirements.filter((r) => r.coverage?.implemented === "NOT_FOUND");
  console.log(`  ${unimplemented.length} of ${requirements.length}`);
  for (const requirement of unimplemented.slice(0, 5)) {
    console.log(`    ${requirement.id}  ${requirement.source.document.split("/").pop()} ${requirement.source.section}  ${truncate(requirement.title, 58)}`);
  }

  console.log("\nWHICH BUSINESS RULES ARE INFERRED FROM CODE RATHER THAN SPECIFIED");
  const inferred = rules.filter((r) => r.origin === "IMPLEMENTED");
  console.log(`  ${inferred.length} of ${rules.length}  (every rule harvested so far)`);
  const byCategory = {};
  for (const rule of inferred) byCategory[rule.category] = (byCategory[rule.category] ?? 0) + 1;
  console.log(`    by category: ${JSON.stringify(byCategory)}`);

  console.log("\nCOVERAGE SUMMARY");
  console.log(`  requirements  specified ${coverage.requirements.specified}  implemented ${coverage.requirements.implemented}  tested ${coverage.requirements.tested}`);
  console.log(`  features      with FRS ${coverage.features.with_requirements}  with code ${coverage.features.with_components}  with tests ${coverage.features.with_tests}`);
  console.log(`  rules         specified ${coverage.rules.specified}  implemented ${coverage.rules.implemented}  tested ${coverage.rules.tested}`);
}

function truncate(text, length) {
  if (!text) return "";
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
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
