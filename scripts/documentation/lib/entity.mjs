/**
 * The envelope every persisted entity carries, and the evidence vocabulary behind it.
 *
 * The point of routing all provenance through here is that `confidence` and `evidence` cannot drift
 * apart. `confirmed()` refuses to produce a CONFIRMED claim with no evidence — which is the failure
 * mode that turns an evidence-based system into a plausible-sounding one.
 */

export const SCHEMA_VERSION = "1.0.0";
export const HARVESTER_VERSION = "1.0.0";

export const CONFIDENCE = {
  CONFIRMED: "CONFIRMED",
  INFERRED: "INFERRED",
  PREDICTED: "PREDICTED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
};

/** Evidence constructors. `ref` must always be something a reader can go and look at. */
export const evidence = {
  file: (path, detail) => ({ kind: "file", ref: path, ...(detail ? { detail } : {}) }),
  symbol: (path, symbol, line) => ({
    kind: "symbol",
    ref: `${path}#${symbol}`,
    ...(line ? { line } : {}),
  }),
  attribute: (path, attribute, line) => ({ kind: "attribute", ref: `${path}#${attribute}`, ...(line ? { line } : {}) }),
  route: (path, route, line) => ({ kind: "route", ref: route, detail: path, ...(line ? { line } : {}) }),
  di: (path, registration, line) => ({ kind: "di-registration", ref: `${path}#${registration}`, ...(line ? { line } : {}) }),
  efModel: (path, detail) => ({ kind: "ef-model", ref: path, detail }),
  migration: (path, detail) => ({ kind: "migration", ref: path, detail }),
  testMethod: (path, method, line) => ({ kind: "test-method", ref: `${path}::${method}`, ...(line ? { line } : {}) }),
  comment: (path, line, detail) => ({ kind: "comment", ref: path, line, ...(detail ? { detail } : {}) }),
  docCitation: (path, citation, line) => ({ kind: "doc-citation", ref: citation, detail: path, ...(line ? { line } : {}) }),
  gitLog: (sha, detail) => ({ kind: "git-log", ref: sha, ...(detail ? { detail } : {}), observed_at_commit: sha }),
  gitTree: (ref, path) => ({ kind: "git-tree", ref: `${ref}:${path}` }),
  workflow: (path, detail) => ({ kind: "workflow", ref: path, detail }),
  configKey: (path, key) => ({ kind: "config-key", ref: `${path}#${key}` }),
  command: (command, detail) => ({ kind: "command-output", ref: command, ...(detail ? { detail } : {}) }),
  human: (who, detail) => ({ kind: "human", ref: who, ...(detail ? { detail } : {}) }),
};

function provenance(generator, confidence, evidenceItems, now, notes) {
  return {
    generator,
    generator_version: HARVESTER_VERSION,
    generated_at: now,
    confidence,
    evidence: evidenceItems,
    ...(notes ? { notes } : {}),
  };
}

/**
 * A directly verified claim. Throws rather than downgrading when evidence is missing: a silent
 * downgrade would let a caller believe it recorded proof when it recorded an opinion.
 */
export function confirmed(generator, evidenceItems, now, notes) {
  if (!Array.isArray(evidenceItems) || evidenceItems.length === 0) {
    throw new Error(`${generator}: CONFIRMED requires at least one evidence item`);
  }
  return provenance(generator, CONFIDENCE.CONFIRMED, evidenceItems, now, notes);
}

/** Reasoned from evidence that does not state it outright. Evidence is still expected. */
export function inferred(generator, evidenceItems, now, notes) {
  return provenance(generator, CONFIDENCE.INFERRED, evidenceItems ?? [], now, notes);
}

/** A human has to decide. Used when the harvester finds a thing but cannot say what it is for. */
export function needsReview(generator, evidenceItems, now, notes) {
  return provenance(generator, CONFIDENCE.NEEDS_REVIEW, evidenceItems ?? [], now, notes);
}

/** Forward-looking. Never a statement about what is. */
export function predicted(generator, evidenceItems, now, notes) {
  return provenance(generator, CONFIDENCE.PREDICTED, evidenceItems ?? [], now, notes);
}

/**
 * Merges a freshly harvested entity over the version already committed.
 *
 * This is the rule that lets docs/data/** be both harvested and hand-enriched: the harvester owns
 * `machine`, and every field a person wrote — purpose, explanations, links they asserted — survives
 * the next run untouched. Getting this backwards would delete the only part of the file with
 * judgement in it.
 */
export function mergeHarvested(existing, harvested, humanFields) {
  if (!existing) return harvested;

  const merged = { ...harvested };
  for (const field of humanFields) {
    if (existing[field] !== undefined && existing[field] !== null) {
      const value = existing[field];
      const isEmptyArray = Array.isArray(value) && value.length === 0;
      if (!isEmptyArray) merged[field] = value;
    }
  }

  // Human edits and harvest updates both count as versions of the entity.
  merged.entity_version = (existing.entity_version ?? 1) + (changed(existing, harvested) ? 1 : 0);
  if (existing.change_history?.length) merged.change_history = existing.change_history;
  return merged;
}

function changed(before, after) {
  return JSON.stringify(before.machine ?? null) !== JSON.stringify(after.machine ?? null);
}

export function envelope({ now, generator, confidence, evidenceItems, status = "active", classification = "PUBLIC_SAFE", lastCommit = null }) {
  const builder =
    confidence === CONFIDENCE.CONFIRMED ? confirmed
      : confidence === CONFIDENCE.INFERRED ? inferred
      : confidence === CONFIDENCE.PREDICTED ? predicted
      : needsReview;

  return {
    schema_version: SCHEMA_VERSION,
    entity_version: 1,
    status,
    data_classification: classification,
    provenance: builder(generator, evidenceItems, now),
    last_verified_commit: lastCommit,
    change_history: [],
  };
}
