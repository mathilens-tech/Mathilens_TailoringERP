/**
 * Git as an evidence source.
 *
 * Two disciplines this module exists to enforce:
 *
 * 1. NOTHING HERE WRITES. No commit, no stash, no checkout, no reset. Every command is a read.
 *    The working tree belongs to whoever is using it, and a documentation tool that "tidied up"
 *    before analysing would destroy work it does not own.
 *
 * 2. COMMITTED AND UNCOMMITTED ARE NEVER THE SAME THING. `fileStates()` classifies every path as
 *    COMMITTED, MODIFIED or UNCOMMITTED, and callers must carry that through, because an
 *    uncommitted file describes one machine's working tree — it is not branch truth and must never
 *    be recorded as history.
 *
 * Other refs are read with cat-file/ls-tree/grep rather than by checking out, so the branch matrix
 * can never disturb the tree it is running in.
 */

import { execFileSync } from "node:child_process";
import { REPO_ROOT } from "./paths.mjs";

function git(args, { allowFailure = false, maxBuffer = 64 * 1024 * 1024 } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer,
      stdio: ["ignore", "pipe", "pipe"],
    }).trimEnd();
  } catch (error) {
    if (allowFailure) return null;
    throw new Error(`git ${args.join(" ")} failed: ${error.stderr || error.message}`);
  }
}

export const raw = git;

export function currentBranch() {
  return git(["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function headSha() {
  return git(["rev-parse", "HEAD"]);
}

export function isRepo() {
  return git(["rev-parse", "--is-inside-work-tree"], { allowFailure: true }) === "true";
}

export function localBranches() {
  const out = git(["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
  return out ? out.split("\n").filter(Boolean) : [];
}

export function remoteBranches() {
  // `refs/remotes/origin/HEAD` short-names to plain `origin`, not `origin/HEAD` — so filtering on
  // the /HEAD suffix silently admitted a branch called "origin" into the registry. Symrefs are
  // excluded explicitly instead, and a remote branch must have a remote/name shape.
  const out = git(["for-each-ref", "--format=%(refname:short)%09%(symref)", "refs/remotes"]);
  if (!out) return [];
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"))
    .filter(([, symref]) => !symref)
    .map(([name]) => name)
    .filter((name) => name.includes("/"));
}

export function tags() {
  const out = git(["tag", "-l"], { allowFailure: true });
  return out ? out.split("\n").filter(Boolean) : [];
}

/**
 * Working-tree state per path, from one `git status` call.
 *
 * Returns a Map of repo-relative path -> COMMITTED | MODIFIED | UNCOMMITTED. Paths absent from the
 * map are COMMITTED (git only reports what differs).
 */
export function fileStates() {
  const states = new Map();
  const out = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { allowFailure: true });
  if (!out) return states;

  // -z output: "XY path\0" per entry, with renames adding a second \0-separated original path.
  const entries = out.split("\0").filter(Boolean);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const code = entry.slice(0, 2);
    const filePath = entry.slice(3);
    if (code[0] === "R") {
      // A rename carries its source path in the next record; both are dirty.
      const source = entries[++i];
      if (source) states.set(source, "MODIFIED");
      states.set(filePath, "MODIFIED");
      continue;
    }
    states.set(filePath, code === "??" ? "UNCOMMITTED" : "MODIFIED");
  }
  return states;
}

/**
 * Last-touching commit for every tracked file, from a single history walk.
 *
 * Deliberately not `git log -1 -- <path>` per file: this repository has ~700 source files, and
 * seven hundred git processes is minutes of wall clock for information one pass already contains.
 */
export function lastCommitPerFile(ref = "HEAD") {
  const map = new Map();
  const out = git(
    ["log", ref, "--name-only", "--no-merges", "--date=short", "--format=%x00%H%x1f%ad%x1f%an%x1f%s"],
    { allowFailure: true },
  );
  if (!out) return map;

  let current = null;
  for (const line of out.split("\n")) {
    if (line.startsWith("\0")) {
      const [sha, date, author, subject] = line.slice(1).split("\x1f");
      current = { sha, date, author, subject };
      continue;
    }
    const path = line.trim();
    if (!path || !current) continue;
    // First writer wins: git log walks newest-first, so the first mention is the latest commit.
    if (!map.has(path)) {
      map.set(path, { ...current, commit_count: 1 });
    } else {
      map.get(path).commit_count += 1;
    }
  }
  return map;
}

/** Divergence between two refs: how many commits each has that the other does not. */
export function divergence(base, head) {
  const out = git(["rev-list", "--left-right", "--count", `${base}...${head}`], { allowFailure: true });
  if (!out) return null;
  const [behind, ahead] = out.split(/\s+/).map((n) => Number.parseInt(n, 10));
  return { ahead, behind };
}

export function mergeBase(a, b) {
  return git(["merge-base", a, b], { allowFailure: true });
}

export function commitMeta(ref) {
  const out = git(["log", "-1", "--date=short", "--format=%H%x1f%ad%x1f%an%x1f%s", ref], { allowFailure: true });
  if (!out) return null;
  const [sha, date, author, subject] = out.split("\x1f");
  return { sha, date, author, subject };
}

/** Does a path exist at a ref? Used by the branch matrix, which never checks anything out. */
export function existsAtRef(ref, filePath) {
  return git(["cat-file", "-e", `${ref}:${filePath}`], { allowFailure: true }) !== null;
}

export function readAtRef(ref, filePath) {
  return git(["show", `${ref}:${filePath}`], { allowFailure: true });
}

/** Is `needle` present in `filePath` at `ref`? The behavioural half of branch availability. */
export function grepAtRef(ref, needle, pathspec) {
  const args = ["grep", "--fixed-strings", "--quiet", needle, ref];
  if (pathspec) args.push("--", pathspec);
  return git(args, { allowFailure: true }) !== null;
}

export function blameLine(filePath, line) {
  const out = git(["blame", "-L", `${line},${line}`, "--porcelain", "--", filePath], { allowFailure: true });
  if (!out) return null;
  const sha = out.split("\n")[0]?.split(" ")[0] ?? null;
  const author = /^author (.*)$/m.exec(out)?.[1] ?? null;
  const time = /^author-time (\d+)$/m.exec(out)?.[1] ?? null;
  return {
    commit: sha,
    author,
    date: time ? new Date(Number(time) * 1000).toISOString().slice(0, 10) : null,
  };
}
