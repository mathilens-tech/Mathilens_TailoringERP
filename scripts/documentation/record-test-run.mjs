/**
 * Records a REAL test run against the test-case registry.
 *
 * This is the only path by which `last_result` is ever written. Nothing else — not the harvester,
 * not validation, not an assistant reading the source — may set it. A test case with no recorded
 * run keeps `last_result: null`, which reads as NOT_RUN and must never be read as passing.
 *
 * Every recorded result carries the run that produced it: the TRX file, the command, the commit and
 * the timestamp. A result without a run id is rejected by validation, so a hand-written "passed"
 * cannot survive.
 *
 * A [Theory] produces one TRX row per [InlineData] but is one test case here, so its rows are
 * aggregated — any failure makes the case failed; all-passed makes it passed. The row count is kept
 * so the difference between "1 case" and "9 executions" stays visible.
 *
 * Usage:
 *   node scripts/documentation/record-test-run.mjs <path-to.trx> [--command "..."] [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DATA_DIRS, REPO_ROOT, rel, readJson, writeJson } from "./lib/paths.mjs";
import * as git from "./lib/git.mjs";

const args = process.argv.slice(2);
const trxPath = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");
const command = args.find((a) => a.startsWith("--command="))?.slice("--command=".length) ?? null;

if (!trxPath) {
  console.error("Usage: node scripts/documentation/record-test-run.mjs <path-to.trx> [--command=\"...\"] [--dry-run]");
  process.exit(1);
}
if (!fs.existsSync(trxPath)) {
  console.error(`TRX file not found: ${trxPath}`);
  process.exit(1);
}

const trx = fs.readFileSync(trxPath, "utf8");
const runId = `trx:${createHash("sha256").update(trx).digest("hex").slice(0, 16)}`;
const recordedAt = new Date().toISOString();
const commit = git.isRepo() ? git.headSha() : null;
const branch = git.isRepo() ? git.currentBranch() : null;

/*
 * Parsed with a regex rather than an XML library. The shape read here is three attributes of one
 * element, VSTest writes them in a stable order, and a dependency for that would be the larger
 * change in a repository that has deliberately avoided them.
 */
const RESULT = /<UnitTestResult\b[^>]*\btestName="([^"]+)"[^>]*\boutcome="([^"]+)"[^>]*?(?:\bduration="([^"]+)")?[^>]*\/?>/g;

const outcomes = new Map();
let totalRows = 0;
let match;
while ((match = RESULT.exec(trx)) !== null) {
  const [, rawName, outcome, duration] = match;
  // `Namespace.Class.Method(quantity: 0)` — a Theory row. The case is the method.
  const fullName = rawName.replace(/\(.*\)$/, "").trim();
  if (!outcomes.has(fullName)) outcomes.set(fullName, { rows: [], durationMs: 0 });
  outcomes.get(fullName).rows.push(outcome);
  outcomes.get(fullName).durationMs += parseDuration(duration);
  totalRows++;
}

const summaryMatch = /<Counters\b[^>]*\btotal="(\d+)"[^>]*\bexecuted="(\d+)"[^>]*\bpassed="(\d+)"[^>]*\bfailed="(\d+)"/.exec(trx);

let matched = 0;
let unmatched = 0;
const unmatchedNames = new Set(outcomes.keys());
const byOutcome = { passed: 0, failed: 0, skipped: 0 };
const written = [];

for (const file of fs.readdirSync(DATA_DIRS.testcases).filter((f) => f.endsWith(".json"))) {
  const full = path.join(DATA_DIRS.testcases, file);
  const data = readJson(full);
  if (!data) continue;

  let changed = false;
  for (const testCase of data.test_cases ?? []) {
    const { namespace, class: className, method } = testCase.machine ?? {};
    if (!namespace || !className || !method) continue;

    const fullName = `${namespace}.${className}.${method}`;
    const result = outcomes.get(fullName);
    if (!result) {
      unmatched++;
      continue;
    }
    unmatchedNames.delete(fullName);
    matched++;

    const outcome = aggregate(result.rows);
    byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1;

    testCase.last_result = {
      outcome,
      run_id: runId,
      recorded_at: recordedAt,
      commit,
      duration_ms: Math.round(result.durationMs),
    };
    changed = true;
  }

  if (changed && !DRY_RUN) {
    writeJson(full, data);
    written.push(rel(full));
  }
}

const record = {
  run_id: runId,
  recorded_at: recordedAt,
  branch,
  commit,
  trx: rel(path.resolve(trxPath)),
  command,
  trx_rows: totalRows,
  distinct_methods: outcomes.size,
  counters: summaryMatch
    ? { total: +summaryMatch[1], executed: +summaryMatch[2], passed: +summaryMatch[3], failed: +summaryMatch[4] }
    : null,
  matched_test_cases: matched,
  // Test cases this run did not cover. For a UnitTests-only run this is every integration case, and
  // they correctly keep last_result: null — NOT_RUN, never assumed.
  test_cases_not_in_this_run: unmatched,
  trx_names_with_no_test_case: [...unmatchedNames].slice(0, 25),
  by_outcome: byOutcome,
};

if (!DRY_RUN) {
  writeJson(path.join(REPO_ROOT, "docs/registry/test-runs.json"), record);
}

console.log(`Recorded run ${runId}${DRY_RUN ? " (DRY RUN)" : ""}`);
console.log(`  TRX rows              ${totalRows} across ${outcomes.size} distinct methods`);
if (record.counters) {
  console.log(`  TRX counters          total ${record.counters.total}, passed ${record.counters.passed}, failed ${record.counters.failed}`);
}
console.log(`  test cases updated    ${matched}`);
console.log(`  outcomes              ${JSON.stringify(byOutcome)}`);
console.log(`  NOT_RUN (left null)   ${unmatched}`);
if (unmatchedNames.size) {
  console.log(`  TRX rows with no case ${unmatchedNames.size}`);
}
console.log(`  files written         ${written.length}`);

function aggregate(rows) {
  if (rows.some((r) => r === "Failed")) return "failed";
  if (rows.every((r) => r === "NotExecuted" || r === "Skipped")) return "skipped";
  return "passed";
}

function parseDuration(value) {
  if (!value) return 0;
  const parts = /(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(value);
  if (!parts) return 0;
  return (Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3])) * 1000;
}
