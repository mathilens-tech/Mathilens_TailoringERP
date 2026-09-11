/**
 * Where everything lives, and how a path is spelled.
 *
 * One rule enforced here: a path stored in documentation data is always repo-relative with forward
 * slashes, whatever platform produced it. This repository is developed on Windows and built on
 * Linux CI, so a backslash leaking into a stored path would make the same component look like two
 * different ones depending on who ran the harvest.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../..");

export const DOCS = path.join(REPO_ROOT, "docs");
export const DATA = path.join(DOCS, "data");
export const SCHEMAS = path.join(DOCS, "schemas");

/** Committed source of truth. */
export const DATA_DIRS = {
  requirements: path.join(DATA, "requirements"),
  features: path.join(DATA, "features"),
  source: path.join(DATA, "source"),
  testcases: path.join(DATA, "testcases"),
  testplans: path.join(DATA, "testplans"),
  issues: path.join(DATA, "issues"),
  changes: path.join(DATA, "changes"),
  risks: path.join(DATA, "risks"),
  rules: path.join(DATA, "rules"),
  traceability: path.join(DATA, "traceability"),
};

/** Reproducible output. Git-ignored — never a source of truth, never hand-edited. */
export const GENERATED_DIRS = {
  generated: path.join(DOCS, "generated"),
  registry: path.join(DOCS, "registry"),
  traceability: path.join(DOCS, "traceability"),
  history: path.join(DOCS, "history"),
};

/** Repo-relative, forward slashes, no leading "./". */
export function rel(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
}

export function abs(relativePath) {
  return path.join(REPO_ROOT, relativePath.split("/").join(path.sep));
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== null) {
      return fallback;
    }
    if (error.code === "ENOENT") {
      return null;
    }
    throw new Error(`${rel(file)}: ${error.message}`);
  }
}

/**
 * Written with a trailing newline and two-space indent, sorted where the caller sorted it.
 *
 * Stable formatting is not cosmetic here: docs/data/** is committed, so an unstable serializer
 * would produce a diff on every harvest even when nothing changed, and a reviewer would stop
 * reading them.
 */
export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * Writes only when the CONTENT changed, ignoring the fields that move on every run.
 *
 * Without this, `generated_at` alone rewrites every committed file on every harvest, so
 * `git status` shows sixteen modified files after a run that discovered nothing new. That trains a
 * reviewer to skip the diff, which defeats the reason the data is committed at all. When nothing
 * substantive changed, the previous timestamp is kept and the file is left alone.
 *
 * Returns true when the file was actually written.
 */
/**
 * `computed_at` joins `generated_at` as volatile.
 *
 * The coverage blocks written by build-traceability stamp `computed_at` on every requirement,
 * feature and rule, so a run that recomputed identical coverage still rewrote 164 committed files.
 * A timestamp that moves whether or not anything changed is noise, and noise in a committed diff is
 * how a reviewer learns to stop reading it.
 */
export function writeJsonIfChanged(file, value, volatileKeys = ["generated_at", "computed_at"]) {
  const existing = readJson(file);
  if (existing && stripVolatile(existing, volatileKeys) === stripVolatile(value, volatileKeys)) {
    return false;
  }
  writeJson(file, value);
  return true;
}

/**
 * Serialises with the volatile keys removed at EVERY depth.
 *
 * Top-level stripping is not enough: `provenance.generated_at` sits on every entity, so a shallow
 * comparison still reports 645 changed components after a run that found nothing new.
 */
function stripVolatile(node, keys) {
  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out = {};
      for (const [key, child] of Object.entries(value)) {
        if (keys.includes(key)) continue;
        out[key] = walk(child);
      }
      return out;
    }
    return value;
  };
  return JSON.stringify(walk(node));
}

/** Recursive file walk, skipping the directories that are never evidence. */
const SKIP_DIRS = new Set([
  "node_modules", ".git", "bin", "obj", ".next", "out", "dist", ".vs", "coverage", "TestResults",
]);

export function walk(dir, { extensions = null, skipDirs = SKIP_DIRS } = {}) {
  const found = [];
  if (!fs.existsSync(dir)) {
    return found;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      found.push(...walk(full, { extensions, skipDirs }));
    } else if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
      found.push(full);
    }
  }
  return found;
}
