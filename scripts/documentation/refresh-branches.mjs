/**
 * Refreshes the derived half of docs/data/branches.json.
 *
 * THE DIVISION OF LABOUR IS THE POINT. `type`, `base` and `environment` are DECLARED by a person
 * and are never touched here — this repository's branch names carry no reliable information
 * (`Ver1.0.1` is a merged work branch, `Orders` and `Whatsapp` are merged work branches, `ai` and
 * `dev1` are experiments), so guessing a classification from a name would manufacture facts.
 *
 * What IS computed, from git and only from git:
 *   - divergence (ahead/behind against the integration branch) and the merge base
 *   - `activity`: ACTIVE / INACTIVE / HISTORICAL, derived from that divergence
 *   - `base_verified`: whether the declared base agrees with `git merge-base`
 *
 * A branch is never deleted, renamed or reclassified by this script. Unknown branches found in git
 * are ADDED with `type: "unknown"` and left for a person to classify — appearing in the registry as
 * an open question is the correct outcome, not silently choosing for them.
 *
 * Usage: node scripts/documentation/refresh-branches.mjs [--dry-run]
 */

import path from "node:path";
import { DATA, readJson, writeJson, rel } from "./lib/paths.mjs";
import * as git from "./lib/git.mjs";
import { SCHEMA_VERSION } from "./lib/entity.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const FILE = path.join(DATA, "branches.json");

/** A branch with no unique commits and no work in 21 days is history, not a work in progress. */
const HISTORICAL_AFTER_DAYS = 21;

function main() {
  if (!git.isRepo()) {
    console.error("Not a git repository.");
    process.exit(1);
  }

  const existing = readJson(FILE);
  if (!existing) {
    console.error(`${rel(FILE)} does not exist. It is DECLARED data — create it first; this script only refreshes what git can prove.`);
    process.exit(1);
  }

  const declared = new Map(existing.branches.map((b) => [b.name, b]));
  const integration = existing.branches.find((b) => b.type === "integration")?.name
    ?? existing.branches.find((b) => b.type === "production")?.name;

  if (!integration) {
    console.error("No integration or production branch declared — divergence has nothing to measure against.");
    process.exit(1);
  }

  const known = new Set([...git.localBranches(), ...git.remoteBranches().map((r) => r.replace(/^origin\//, ""))]);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const refreshed = [];

  for (const name of [...new Set([...declared.keys(), ...known])].sort()) {
    const branch = declared.get(name) ?? {
      name,
      type: "unknown",
      base: null,
      environment: null,
      activity: "UNKNOWN",
      classification_source: "derived:discovered-in-git — NEEDS A DECLARED TYPE",
      notes: "Found in git but not declared in branches.json. Classify it: a name is not evidence.",
    };

    const ref = resolveRef(name);
    branch.ref = ref ?? name;
    branch.remote = Boolean(ref && ref.startsWith("origin/"));

    if (!ref) {
      // Declared but no longer present in git. Kept — a deleted branch is still history worth
      // recording — but marked so nothing downstream treats it as queryable.
      branch.activity = "HISTORICAL";
      branch.divergence = null;
      branch.classification_source = `${stripDerived(branch.classification_source)} + derived:absent-from-git(${today})`;
      refreshed.push(branch);
      continue;
    }

    const counts = name === integration ? { ahead: 0, behind: 0 } : git.divergence(integration, ref);
    const mergeBaseSha = name === integration ? null : git.mergeBase(integration, ref);
    const mergeBaseMeta = mergeBaseSha ? git.commitMeta(mergeBaseSha) : null;
    const last = git.commitMeta(ref);

    branch.divergence = {
      compared_to: integration,
      ahead: counts?.ahead ?? null,
      behind: counts?.behind ?? null,
      merge_base: mergeBaseSha,
      merge_base_date: mergeBaseMeta?.date ?? null,
      last_commit: last?.sha ?? null,
      last_commit_date: last?.date ?? null,
      measured_at: today,
    };

    branch.activity = classifyActivity(name, integration, counts, last, today);
    branch.base_verified = verifyBase(branch, ref);
    branch.last_analyzed_commit = last?.sha ?? null;

    const derivation = `derived:divergence(ahead=${counts?.ahead ?? "?"},behind=${counts?.behind ?? "?"},last=${last?.date ?? "?"})`;
    branch.classification_source = `${stripDerived(branch.classification_source)} + ${derivation}`;

    refreshed.push(branch);
  }

  const payload = {
    schema_version: SCHEMA_VERSION,
    generated_at: now,
    notes: existing.notes,
    branches: refreshed,
  };

  if (!DRY_RUN) writeJson(FILE, payload);

  console.log(`Branch registry ${DRY_RUN ? "(dry run) " : ""}— ${refreshed.length} branches, integration = ${integration}`);
  for (const branch of refreshed) {
    const d = branch.divergence;
    console.log(
      `  ${branch.name.padEnd(18)} ${branch.type.padEnd(12)} ${branch.activity.padEnd(11)}` +
      (d ? ` ahead ${String(d.ahead).padStart(3)}  behind ${String(d.behind).padStart(3)}  last ${d.last_commit_date}` : " (absent from git)"),
    );
  }
  const undeclared = refreshed.filter((b) => b.type === "unknown");
  if (undeclared.length) {
    console.log(`\n  ${undeclared.length} branch(es) need a declared type: ${undeclared.map((b) => b.name).join(", ")}`);
  }
}

/** Prefer the remote ref: it is what CI can see, and a local branch may be stale or absent there. */
function resolveRef(name) {
  const remotes = git.remoteBranches();
  if (remotes.includes(`origin/${name}`)) return `origin/${name}`;
  if (git.localBranches().includes(name)) return name;
  return null;
}

function classifyActivity(name, integration, counts, last, today) {
  if (name === integration) return "ACTIVE";
  if (!counts || !last) return "UNKNOWN";

  // Commits the integration branch does not have = work in progress, whatever its age.
  if (counts.ahead > 0) return "ACTIVE";

  const ageDays = daysBetween(last.date, today);
  return ageDays > HISTORICAL_AFTER_DAYS ? "HISTORICAL" : "INACTIVE";
}

function verifyBase(branch, ref) {
  if (!branch.base) return null;
  const base = git.mergeBase(branch.base, ref);
  return base !== null;
}

function daysBetween(from, to) {
  if (!from || !to) return 0;
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function stripDerived(source) {
  return (source ?? "declared:owner").split(" + derived:")[0];
}

main();
