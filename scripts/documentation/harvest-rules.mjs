/**
 * Phase 4 — business rule harvest.
 *
 * A business rule is a constraint the product enforces. This script finds them where they are
 * actually enforced, and quotes the enforcement rather than describing it.
 *
 * FIVE DETECTORS, EACH POINTING AT SOMETHING LITERAL:
 *
 *   domain-invariant    `throw new InvalidOperationException("Cannot remove the last item from an
 *                       order — cancel the order instead.")` — the message IS the rule, written by
 *                       the person who enforced it.
 *   state-table         `AllowedTransitions` — the order lifecycle, read out of the map itself.
 *   fluent-validation   `RuleFor(x => x.PhoneNumber).NotEmpty().WithMessage("…")`
 *   guard-clause        `Guard.AgainstNegativeOrZero(quantity, …)`
 *   constant            `MaxItemQuantity = 100_000` with the XML doc that explains it.
 *
 * ORIGIN IS NOT CONFIDENCE. A rule found in code is `origin: IMPLEMENTED` — the product demonstrably
 * behaves this way. Whether anyone SPECIFIED it is a separate question answered by matching against
 * the FRS, and a rule enforced with nothing specifying it is exactly the drift this platform exists
 * to surface. Code-derived rules carry confidence INFERRED: the behaviour is certain, the intent is
 * not.
 *
 * Usage: node scripts/documentation/harvest-rules.mjs [--dry-run] [--quiet]
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_DIRS, REPO_ROOT, rel, walk, readJson, writeJson, writeJsonIfChanged } from "./lib/paths.mjs";
import * as git from "./lib/git.mjs";
import { scrub } from "./lib/redact.mjs";
import { IdLedger, moduleFor } from "./lib/ids.mjs";
import { stripNoise } from "./lib/csharp.mjs";
import { SCHEMA_VERSION, HARVESTER_VERSION, CONFIDENCE, evidence, inferred, confirmed, mergeHarvested } from "./lib/entity.mjs";

const GENERATOR = "harvest-rules.mjs";

const HUMAN_FIELDS = [
  "statement", "category", "requirements", "features", "components", "test_cases", "change_history",
];

/** Rule category from the enforcement's own wording. */
const CATEGORY_RULES = [
  [/\btransition|status|lifecycle|state\b/i, "state-transition"],
  [/\bpermission|role|authoriz|forbidden|policy\b/i, "authorization"],
  [/\bhours?|days?|date|expire|window|before|after\b/i, "time-boundary"],
  [/\btotal|amount|price|sum|calculat|discount|tax|balance\b/i, "calculation"],
  [/\brequired|empty|null|invalid|must be|cannot be|format|length\b/i, "validation"],
  [/\bduplicate|unique|already exists|reference|orphan|cascade\b/i, "data-integrity"],
  [/\bcancel|deliver|complete|approve|workflow|step\b/i, "workflow"],
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const QUIET = args.has("--quiet");
const log = (...parts) => { if (!QUIET) console.log(...parts); };

function main() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const branch = git.currentBranch();
  const head = git.headSha();
  const fileStates = git.fileStates();
  const lastCommits = git.lastCommitPerFile();

  const components = loadAll(DATA_DIRS.source, "components");
  const testCases = loadAll(DATA_DIRS.testcases, "test_cases");
  const requirements = loadRequirements();

  const componentsByPath = new Map();
  for (const component of components) {
    if (!componentsByPath.has(component.path)) componentsByPath.set(component.path, []);
    componentsByPath.get(component.path).push(component);
  }

  const testsByComponent = new Map();
  for (const testCase of testCases) {
    for (const edge of testCase.machine?.exercises ?? []) {
      if (!testsByComponent.has(edge.component)) testsByComponent.set(edge.component, new Set());
      testsByComponent.get(edge.component).add(testCase.id);
    }
  }

  const ledger = IdLedger.open("BR", "rule-id-ledger.json");
  const rules = [];
  const stats = { byDetector: {}, byCategory: {}, byModule: {}, byOrigin: {}, filesScanned: 0 };

  for (const absolute of walk(path.join(REPO_ROOT, "src"), { extensions: [".cs"] })) {
    const relativePath = rel(absolute);
    if (/\/Migrations\//.test(relativePath)) continue;

    const source = fs.readFileSync(absolute, "utf8");
    const raw = source.split(/\r?\n/);
    const { lines } = stripNoise(source);
    stats.filesScanned++;

    const module = moduleFor(relativePath);
    const owning = componentsByPath.get(relativePath) ?? [];
    const found = [];

    // ---- domain invariants ---------------------------------------------------------------
    for (let index = 0; index < raw.length; index++) {
      const match = /throw new ([A-Za-z]+Exception)\(\s*\$?"([^"]{15,400})"/.exec(raw[index]);
      if (!match) continue;
      // A message that is only an interpolation gives the reader nothing on its own.
      const message = match[2].trim();
      if (/^\{[^}]*\}$/.test(message)) continue;
      found.push({
        detector: "domain-invariant",
        mechanism: "domain-invariant",
        statement: cleanMessage(message),
        line: index + 1,
        expression: raw[index].trim().slice(0, 160),
      });
    }

    // ---- guard clauses -------------------------------------------------------------------
    for (let index = 0; index < lines.length; index++) {
      const match = /Guard\.Against([A-Za-z]+)\(\s*([A-Za-z_][\w.]*)/.exec(lines[index]);
      if (!match) continue;
      found.push({
        detector: "guard-clause",
        mechanism: "guard-clause",
        statement: `${humanize(match[2])} must not be ${humanize(match[1]).toLowerCase()}`,
        line: index + 1,
        expression: raw[index]?.trim().slice(0, 160) ?? null,
      });
    }

    // ---- FluentValidation ----------------------------------------------------------------
    const validatorText = raw.join("\n");
    const RULE_FOR = /RuleFor\(\s*[a-z]\s*=>\s*[a-z]\.([A-Za-z0-9_.]+)\s*\)([\s\S]{0,400}?);/g;
    let ruleMatch;
    while ((ruleMatch = RULE_FOR.exec(validatorText)) !== null) {
      const property = ruleMatch[1];
      const chain = ruleMatch[2];
      const message = /WithMessage\(\s*"([^"]{5,300})"/.exec(chain)?.[1] ?? null;
      const validators = [...chain.matchAll(/\.([A-Z][A-Za-z0-9]*)\s*\(/g)]
        .map((m) => m[1])
        .filter((name) => name !== "WithMessage" && name !== "When" && name !== "Must");
      if (!message && validators.length === 0) continue;

      found.push({
        detector: "fluent-validation",
        mechanism: "fluent-validation",
        statement: message ?? `${humanize(property)} must satisfy ${validators.map(humanize).join(", ").toLowerCase()}`,
        line: lineAt(validatorText, ruleMatch.index),
        expression: `RuleFor(x => x.${property})${validators.map((v) => `.${v}()`).join("")}`.slice(0, 160),
      });
    }

    // ---- state-transition table ------------------------------------------------------------
    const transitions = /AllowedTransitions\s*=\s*new\(\)\s*\{([\s\S]{0,900}?)\};/.exec(validatorText);
    if (transitions) {
      for (const entry of transitions[1].matchAll(/\[([A-Za-z]+)\.([A-Za-z]+)\]\s*=\s*\[([^\]]*)\]/g)) {
        const targets = entry[3].split(",").map((t) => t.trim()).filter(Boolean).map((t) => t.split(".").pop());
        found.push({
          detector: "state-table",
          mechanism: "state-table",
          statement: targets.length
            ? `An order in ${entry[2]} may move only to ${targets.join(" or ")}`
            : `An order in ${entry[2]} is terminal and may not move to any other status`,
          line: lineAt(validatorText, entry.index),
          expression: entry[0].slice(0, 160),
        });
      }
    }

    // ---- documented constants ---------------------------------------------------------------
    for (let index = 0; index < raw.length; index++) {
      const match = /public const (?:int|decimal|long|string) ([A-Za-z_]\w*)\s*=\s*([^;]+);/.exec(raw[index]);
      if (!match) continue;
      if (!/Limits|Defaults|Rules|Policy/.test(relativePath)) continue;
      found.push({
        detector: "constant",
        mechanism: "constant",
        statement: `${humanize(match[1])} is ${match[2].trim()}`,
        line: index + 1,
        expression: match[0].trim().slice(0, 160),
      });
    }

    /*
     * The same rule enforced more than once in a file is ONE rule with several enforcement sites,
     * not several rules.
     *
     * `Order.Create` and `Order.CreateFabricSale` both call `Guard.AgainstEmpty(customerId, …)`,
     * which produced two entities with the same natural key and therefore the same BR id — a
     * duplicate the validator caught. Merging the sites is also the more truthful model: the
     * constraint is one rule, and knowing every place it is enforced is exactly what a change-impact
     * report needs.
     */
    const deduped = new Map();
    for (const item of found) {
      const key = `${item.detector}#${hash(item.statement)}`;
      if (deduped.has(key)) {
        deduped.get(key).sites.push({ line: item.line, expression: item.expression });
        continue;
      }
      deduped.set(key, { ...item, sites: [{ line: item.line, expression: item.expression }] });
    }

    // ---- entities -----------------------------------------------------------------------
    for (const item of deduped.values()) {
      const component = pickComponent(owning, item.line);
      const key = `${relativePath}#${item.detector}#${hash(item.statement)}`;
      const id = ledger.idFor(key, module, today);

      const category = categorize(item.statement, item.detector);
      const matchedRequirement = matchRequirement(item.statement, requirements, module);
      const origin = matchedRequirement ? "BOTH" : "IMPLEMENTED";

      const relatedTests = component ? [...(testsByComponent.get(component.id) ?? [])].sort() : [];

      stats.byDetector[item.detector] = (stats.byDetector[item.detector] ?? 0) + 1;
      stats.byCategory[category.category] = (stats.byCategory[category.category] ?? 0) + 1;
      stats.byModule[module] = (stats.byModule[module] ?? 0) + 1;
      stats.byOrigin[origin] = (stats.byOrigin[origin] ?? 0) + 1;

      const gitInfo = {
        state: fileStates.get(relativePath) ?? "COMMITTED",
        last_commit: lastCommits.get(relativePath)?.sha ?? null,
        last_commit_date: lastCommits.get(relativePath)?.date ?? null,
      };

      rules.push({
        id,
        entity_version: 1,
        statement: item.statement,
        module,
        category: category.category,
        category_evidence: category.why,
        origin,
        enforced_by: item.sites
          .sort((a, b) => a.line - b.line)
          .map((site) => ({
            component: pickComponent(owning, site.line)?.id ?? null,
            file: relativePath,
            line: site.line,
            mechanism: item.mechanism,
            expression: site.expression,
          })),
        requirements: matchedRequirement ? [matchedRequirement] : [],
        features: [],
        components: component ? [component.id] : [],
        test_cases: relatedTests,
        coverage: {
          specified: matchedRequirement ? "YES" : "NO",
          implemented: "YES",
          tested: relatedTests.length ? "PARTIAL" : "NOT_FOUND",
          test_count: relatedTests.length,
          computed_at: now,
        },
        machine: {
          detector: item.detector,
          raw: item.expression,
          symbol: component?.name ?? null,
          git: gitInfo,
        },
        status: "draft",
        data_classification: "PUBLIC_SAFE",
        provenance: inferred(
          GENERATOR,
          [evidence.symbol(relativePath, component?.name ?? item.detector, item.line)],
          now,
          "Read out of the enforcement in code. The behaviour is certain; whether it was intended as a business rule is a human judgement.",
        ),
        last_verified_commit: gitInfo.last_commit,
        change_history: [],
      });
    }
  }

  // ---------------------------------------------------------------- write, grouped by module

  const retired = ledger.retireUnseen(today);
  const byModule = new Map();
  for (const rule of rules) {
    if (!byModule.has(rule.module)) byModule.set(rule.module, []);
    byModule.get(rule.module).push(rule);
  }

  const written = [];
  for (const [module, moduleRules] of [...byModule.entries()].sort()) {
    const file = path.join(DATA_DIRS.rules, `${module.toLowerCase()}.json`);
    const existing = readJson(file);
    const existingById = new Map((existing?.rules ?? []).map((r) => [r.id, r]));

    const merged = moduleRules
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((rule) => mergeHarvested(existingById.get(rule.id), rule, HUMAN_FIELDS));

    const payload = {
      module, schema_version: SCHEMA_VERSION, generated_at: now,
      harvester_version: HARVESTER_VERSION, rules: merged,
    };
    const { entity: safe } = scrub(payload, { context: `${module}:` });
    const changed = !DRY_RUN && writeJsonIfChanged(file, safe);
    written.push({ changed });
  }

  if (!DRY_RUN) {
    ledger.save();
    writeJson(path.join(REPO_ROOT, "docs/registry/rule-harvest-summary.json"), {
      branch, head, generated_at: now, total: rules.length, stats, retired_ids: retired,
    });
  }

  log(`Harvested business rules on ${branch} @ ${head.slice(0, 8)}`);
  log(`  files scanned        ${stats.filesScanned}`);
  log(`  rules                ${rules.length}`);
  log(`  by detector          ${JSON.stringify(sortCounts(stats.byDetector))}`);
  log(`  by category          ${JSON.stringify(sortCounts(stats.byCategory))}`);
  log(`  by module            ${JSON.stringify(sortCounts(stats.byModule))}`);
  log(`  origin               ${JSON.stringify(stats.byOrigin)}`);
  log(`  wrote                ${written.filter((w) => w.changed).length} of ${written.length} files changed${DRY_RUN ? " (DRY RUN)" : ""}`);
}

/** The component whose declaration is nearest above this line — the one that owns the rule. */
function pickComponent(candidates, line) {
  let best = null;
  for (const component of candidates) {
    const declared = component.machine?.line ?? 0;
    if (declared <= line && (!best || declared > (best.machine?.line ?? 0))) best = component;
  }
  return best ?? candidates[0] ?? null;
}

/**
 * Links a rule to a requirement only on a strong lexical overlap.
 *
 * Deliberately strict: a weak match would manufacture the very traceability this platform is
 * supposed to measure honestly. No match is a real answer, and means the rule is enforced with
 * nothing in the FRS asking for it.
 */
function matchRequirement(statement, requirements, module) {
  const words = new Set(
    statement.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
      .filter((w) => w.length > 4 && !STOPWORDS.has(w)),
  );
  if (words.size < 3) return null;

  let best = null;
  let bestScore = 0;
  for (const requirement of requirements) {
    if (requirement.module !== module && requirement.module !== "PLATFORM") continue;
    const text = (requirement.description ?? "").toLowerCase();
    let score = 0;
    for (const word of words) if (text.includes(word)) score++;
    const ratio = score / words.size;
    if (ratio > bestScore && ratio >= 0.6 && score >= 3) { bestScore = ratio; best = requirement.id; }
  }
  return best;
}

const STOPWORDS = new Set(["these", "there", "which", "where", "their", "would", "could", "should", "about", "other", "cannot", "value", "using", "given", "every"]);

function categorize(statement, detector) {
  if (detector === "state-table") return { category: "state-transition", why: "read from the transition table" };
  if (detector === "fluent-validation") return { category: "validation", why: "FluentValidation rule" };
  if (detector === "constant") return { category: "policy", why: "documented constant" };
  for (const [pattern, category] of CATEGORY_RULES) {
    const match = pattern.exec(statement);
    if (match) return { category, why: `statement uses "${match[0]}"` };
  }
  return { category: "NEEDS_REVIEW", why: "no category vocabulary in the statement" };
}

function cleanMessage(message) {
  return message.replace(/\{[^}]*\}/g, "…").replace(/\s+/g, " ").trim();
}

function humanize(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

function loadAll(dir, key) {
  const items = [];
  if (!fs.existsSync(dir)) return items;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    for (const item of readJson(path.join(dir, file))?.[key] ?? []) items.push(item);
  }
  return items;
}

function loadRequirements() {
  const items = [];
  if (!fs.existsSync(DATA_DIRS.requirements)) return items;
  for (const file of fs.readdirSync(DATA_DIRS.requirements)) {
    if (!file.endsWith(".json")) continue;
    const requirement = readJson(path.join(DATA_DIRS.requirements, file));
    if (requirement?.id) items.push(requirement);
  }
  return items;
}

function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i++) value = (value * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(value).toString(36);
}

function sortCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

main();
