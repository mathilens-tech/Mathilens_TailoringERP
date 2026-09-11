/**
 * Phase 4 — FRS harvest.
 *
 * Extracts NORMATIVE CLAUSES from the specification documents and turns each into an `FR-*` entity
 * under docs/data/requirements/.
 *
 * WHAT A REQUIREMENT IS HERE. It is a clause the specification actually contains, quoted verbatim,
 * with its document, section, parent section and line range. The `description` IS the quote. The
 * `title` is a shortening of it. Nothing is composed, paraphrased or extrapolated — if the FRS says
 * something this file does not, that is a gap to fill by hand, not by invention.
 *
 * WHY MODALITY IS THE SELECTOR. These documents are prescriptive by design ("every architecture
 * decision ... must conform to what is written here"). A sentence carrying must / must never /
 * shall / always / cannot / is required is making a demand of the product; a sentence without one is
 * usually rationale or narration. Selecting on modality is therefore reading the document the way it
 * was written, not guessing at intent.
 *
 * EVERY REQUIREMENT STARTS UNAPPROVED. `status: draft`, `approval.approved: false`. A harvested
 * clause is a proposal for the FRS, and approval is a human act — the approval lock in
 * validate-documentation.mjs then binds everyone, this script included.
 *
 * Usage: node scripts/documentation/harvest-requirements.mjs [--dry-run] [--quiet]
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_DIRS, REPO_ROOT, rel, readJson, writeJson, writeJsonIfChanged } from "./lib/paths.mjs";
import * as git from "./lib/git.mjs";
import { scrub } from "./lib/redact.mjs";
import { IdLedger } from "./lib/ids.mjs";
import { SCHEMA_VERSION, HARVESTER_VERSION, CONFIDENCE, evidence, confirmed, needsReview, mergeHarvested } from "./lib/entity.mjs";

const GENERATOR = "harvest-requirements.mjs";

const SPEC_DOCUMENTS = [
  "docs/00_MASTER_SPEC.md",
  "docs/01_ARCHITECTURE.md",
  "docs/02_DATABASE.md",
];

/*
 * Preserved across harvests.
 *
 * `implementation_evidence` and `coverage` are in this list although no human writes them: they are
 * owned by build-traceability, which runs afterwards. Without them here the two scripts overwrite
 * each other's work on every run — harvest clears the coverage, traceability recomputes it, and 121
 * committed files change on every single invocation regardless of whether anything actually did.
 * The rule is one writer per field, and this list is how that is enforced.
 */
const HUMAN_FIELDS = [
  "title", "business_purpose", "actors", "preconditions", "main_flow", "alternate_flow",
  "business_rules", "validation", "expected_result", "approval", "assertions",
  "features", "components", "test_cases", "change_history",
  "implementation_evidence", "coverage",
];

/*
 * Modality that makes a sentence a demand rather than a description.
 *
 * `(?:is|are) required` was added after the first run returned no CUSTOMER, MEASUREMENT, INVENTORY
 * or PRICING requirements at all. 02_DATABASE states its per-entity rules in exactly that form —
 * "At least one contact method (phone) is required ... name is required" — so the entity sections
 * that carry the most concrete, testable rules in the whole specification were being skipped.
 */
const NORMATIVE = /\b(must not|must never|must|shall not|shall|never|always|cannot|may only|(?:is|are) required|required to|has to|have to|is not permitted|are not permitted|no .{0,30} may|every .{0,40} (?:is|are|must|has|have))\b/i;

/** Wording that means the document has not decided yet — a clause, but not a requirement. */
const UNDECIDED = /\b(to be defined|tbd|placeholder|future work|not yet|deferred|will be (?:defined|expanded)|_to be)\b/i;

/** Sentences about the document itself rather than the product. */
const META = /\b(this document|table of contents|related documents|document status|last updated|see \[|status: draft)\b/i;

/**
 * Sections that are prose ABOUT the product rather than demands OF it.
 *
 * "Correctness — the system ... must be right before it is fast or pretty" is a value, and it
 * carries a `must`, so modality alone admits it as a requirement. It is not one: nothing can be
 * built, tested or traced against it. Vision, values, market positioning, risks and trade-offs are
 * excluded by section, which is the level at which the document itself separates them.
 */
const NON_NORMATIVE_SECTIONS =
  /^(how to read|table of contents|executive summary|purpose|product vision|vision statement|mission|business goals|target customers|target market|product philosophy|core values|success criteria|definition of success|future vision|risks|tradeoffs|trade-offs|related documents|architecture goals|glossary|changelog|revision history|overview)/i;

/**
 * Requirement type, from the clause's own vocabulary. Only assigned where a word in the clause
 * supports it; otherwise NEEDS_REVIEW rather than a plausible-looking guess.
 */
const TYPE_RULES = [
  [/\b(authenticat|sign[- ]in|token|jwt|password|credential|session|lockout)\w*/i, "security"],
  [/\b(authoriz|permission|role|policy|access control|forbidden|401|403)\w*/i, "authorization"],
  [/\b(validat|invalid|reject|malformed|required field|format)\w*/i, "validation"],
  [/\b(audit|activity log|traceab|who did|history)\w*/i, "audit"],
  [/\b(report|dashboard|export|summary|figures)\w*/i, "reporting"],
  [/\b(whatsapp|notification|message|notify|send)\w*/i, "notification"],
  [/\b(migration|schema|column|table|index|foreign key|soft delete|database|persist)\w*/i, "data"],
  [/\b(integration|external|third[- ]party|provider|api client|webhook)\w*/i, "integration"],
  [/\b(configur|setting|environment variable|secret|appsettings)\w*/i, "configuration"],
  [/\b(performance|latency|pagination|cache|scal|throughput|connection pool)\w*/i, "performance"],
  [/\b(status|lifecycle|transition|workflow|state|step|flow)\w*/i, "workflow"],
  [/\b(layer|architecture|dependency rule|clean architecture|cqrs|mediator|repository pattern)\w*/i, "architecture"],
];

/*
 * Which module a section belongs to, from its own title.
 *
 * Every pattern tolerates a plural. The specification titles its entity sections "Customers",
 * "Measurements", "Employees" — and `\bcustomer\b` does not match "Customers", because the word
 * boundary fails against the trailing "s". That single omission put every per-entity section in the
 * database document into PLATFORM, losing exactly the module-specific requirements worth having.
 */
const MODULE_RULES = [
  [/\border(s|items?)?\b|tailoring orders?\b/i, "ORDER"],
  [/\bcustomers?\b/i, "CUSTOMER"],
  [/\bmeasurements?(history)?\b/i, "MEASUREMENT"],
  [/\bemployees?\b|\bstaff\b/i, "EMPLOYEE"],
  [/\bbilling\b|\binvoices?\b|\bpayments?\b|\bfabricdetails\b/i, "BILLING"],
  [/\bpricing\b|\bcloth prices?\b/i, "PRICING"],
  [/\binventory\b|\bstock\b|\bcloth receipts?\b/i, "INVENTORY"],
  [/\breports?\b|\bdashboard\b/i, "REPORT"],
  [/\bwhatsapp\b/i, "WHATSAPP"],
  [/\bsettings?\b/i, "SETTING"],
  [/\busers?\b|\broles?\b|\bpermissions?\b|\bidentity\b/i, "USER"],
  [/\bactivity logs?\b|\bauditlogs?\b|\baudit logs?\b/i, "ACTIVITY"],
  [/\bauth\w*\b|\blogin\b|\bsign[- ]in\b|\brefreshtokens?\b|\btokens?\b|\bpasswords?\b/i, "AUTH"],
  [/\boccasions?\b|\bbirthday\b|\banniversar\w*\b/i, "OCCASION"],
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

  const ledger = IdLedger.open("FR", "requirement-id-ledger.json");
  const requirements = [];
  const stats = {
    documents: 0, sections: 0, statementsConsidered: 0, normative: 0,
    skippedUndecided: 0, skippedMeta: 0, skippedNonNormativeSections: 0, byDocument: {}, byModule: {}, byType: {},
    byForm: {}, needsReview: 0,
  };

  for (const document of SPEC_DOCUMENTS) {
    const absolute = path.join(REPO_ROOT, document);
    if (!fs.existsSync(absolute)) continue;
    stats.documents++;

    const lines = fs.readFileSync(absolute, "utf8").split(/\r?\n/);
    const sections = parseSections(lines);
    stats.sections += sections.length;

    for (const section of sections) {
      if (NON_NORMATIVE_SECTIONS.test(section.title) || NON_NORMATIVE_SECTIONS.test(section.parentTitle ?? "")) {
        stats.skippedNonNormativeSections++;
        continue;
      }
      for (const statement of extractStatements(section, lines)) {
        stats.statementsConsidered++;
        stats.byForm[statement.form] = (stats.byForm[statement.form] ?? 0) + 1;

        if (META.test(statement.text)) { stats.skippedMeta++; continue; }
        if (!NORMATIVE.test(statement.text)) continue;
        stats.normative++;

        const undecided = UNDECIDED.test(statement.text);
        if (undecided && statement.text.length < 80) { stats.skippedUndecided++; continue; }

        const module = moduleFor(section, statement.text);
        const type = typeFor(statement.text);
        const key = `${document}#${section.number}#${hash(statement.text)}`;
        const id = ledger.idFor(key, module, today);

        stats.byDocument[document] = (stats.byDocument[document] ?? 0) + 1;
        stats.byModule[module] = (stats.byModule[module] ?? 0) + 1;
        stats.byType[type.type] = (stats.byType[type.type] ?? 0) + 1;

        const ambiguous = undecided || statement.text.length > 600;
        if (ambiguous) stats.needsReview++;

        const sourceEvidence = [
          evidence.docCitation(document, `${document} § ${section.number}`, statement.line_start),
        ];

        requirements.push({
          id,
          schema_version: SCHEMA_VERSION,
          entity_version: 1,
          title: titleFor(statement.text),
          module,
          description: statement.text,
          business_purpose: null,
          actors: [],
          preconditions: [],
          main_flow: [],
          alternate_flow: [],
          business_rules: [],
          validation: [],
          expected_result: null,
          requirement_type: ambiguous ? "NEEDS_REVIEW" : type.type,
          requirement_type_evidence: ambiguous ? "clause is open-ended or undecided" : type.why,
          source: {
            document,
            section: `§ ${section.number}`,
            section_title: section.title,
            parent_section: section.parentNumber ? `§ ${section.parentNumber}` : null,
            parent_section_title: section.parentTitle,
            quote: statement.text,
            line: statement.line_start,
            line_start: statement.line_start,
            line_end: statement.line_end,
            form: statement.form,
          },
          approval: { approved: false, by: null, on: null, content_hash: null },
          assertions: [],
          implementation_evidence: [],
          coverage: null,
          features: [],
          components: [],
          test_cases: [],
          status: ambiguous ? "needs-review" : "draft",
          data_classification: "PUBLIC_SAFE",
          provenance: ambiguous
            ? needsReview(GENERATOR, sourceEvidence, now, "Clause is open-ended or marked undecided in the source document.")
            : confirmed(GENERATOR, sourceEvidence, now, "Quoted verbatim from the specification; interpretation into flows and rules is not attempted here."),
          last_verified_commit: fileStates.get(document) ? null : head,
          change_history: [],
        });
      }
    }
  }

  // ---------------------------------------------------------------- write

  const retired = ledger.retireUnseen(today);
  const written = [];

  for (const requirement of requirements) {
    const file = path.join(DATA_DIRS.requirements, `${requirement.id}.json`);
    const existing = readJson(file);
    const merged = mergeHarvested(existing, requirement, HUMAN_FIELDS);
    const { entity: safe } = scrub(merged, { context: `${requirement.id}:` });
    const changed = !DRY_RUN && writeJsonIfChanged(file, safe);
    written.push({ file: rel(file), changed });
  }

  if (!DRY_RUN) {
    ledger.save();
    writeJson(path.join(REPO_ROOT, "docs/registry/requirement-harvest-summary.json"), {
      branch, head, generated_at: now, total: requirements.length, stats, retired_ids: retired,
    });
  }

  log(`Harvested requirements on ${branch} @ ${head.slice(0, 8)}`);
  log(`  documents            ${stats.documents}, sections ${stats.sections}`);
  log(`  statements examined  ${stats.statementsConsidered}  (${JSON.stringify(stats.byForm)})`);
  log(`  normative clauses    ${stats.normative}  (meta ${stats.skippedMeta}, undecided ${stats.skippedUndecided}, non-normative sections ${stats.skippedNonNormativeSections})`);
  log(`  requirements         ${requirements.length}   needs-review ${stats.needsReview}`);
  log(`  by document          ${JSON.stringify(stats.byDocument)}`);
  log(`  by module            ${JSON.stringify(sortCounts(stats.byModule))}`);
  log(`  by type              ${JSON.stringify(sortCounts(stats.byType))}`);
  log(`  wrote                ${written.filter((w) => w.changed).length} of ${written.length} files changed${DRY_RUN ? " (DRY RUN)" : ""}`);
}

/**
 * The document's own heading hierarchy, preserved rather than flattened. `## 8. Orders` is a parent
 * of `### 8.3 Pagination`, and a requirement records both so the FRS can be browsed the way the
 * specification is written.
 */
function parseSections(lines) {
  const sections = [];
  let inFence = false;
  let currentParent = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;

    const heading = /^(#{2,4})\s+(?:(\d+(?:\.\d+)*)\.?\s+)?(.*)$/.exec(line);
    if (!heading) continue;

    const level = heading[1].length;
    const number = heading[2] ?? null;
    const title = heading[3].trim();

    const section = {
      level,
      number: number ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
      title,
      line: index + 1,
      parentNumber: level > 2 ? currentParent?.number ?? null : null,
      parentTitle: level > 2 ? currentParent?.title ?? null : null,
      bodyStart: index + 2,
      bodyEnd: lines.length,
    };

    if (sections.length) sections[sections.length - 1].bodyEnd = index;
    if (level === 2) currentParent = section;
    sections.push(section);
  }

  return sections;
}

/**
 * Splits a section body into addressable statements: sentences from prose, whole bullet items, and
 * table rows. A bullet is kept whole because splitting "must X, and must not Y" into two would
 * invent a distinction the document did not make.
 */
function extractStatements(section, lines) {
  const statements = [];
  let inFence = false;
  let paragraph = [];
  let paragraphStart = null;

  const flushParagraph = (endLine) => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    for (const sentence of splitSentences(text)) {
      statements.push({ text: sentence, form: "sentence", line_start: paragraphStart, line_end: endLine });
    }
    paragraph = [];
    paragraphStart = null;
  };

  for (let index = section.bodyStart - 1; index < section.bodyEnd && index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (/^\s*```/.test(line)) { inFence = !inFence; flushParagraph(lineNumber); continue; }
    if (inFence) continue;
    if (/^#{2,4}\s/.test(line)) break;

    if (!line.trim()) { flushParagraph(lineNumber); continue; }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph(lineNumber);
      statements.push({ text: clean(bullet[1]), form: "bullet", line_start: lineNumber, line_end: lineNumber });
      continue;
    }

    const tableRow = /^\s*\|(.+)\|\s*$/.exec(line);
    if (tableRow) {
      flushParagraph(lineNumber);
      if (/^[\s|:-]+$/.test(tableRow[1])) continue; // separator row
      const cells = tableRow[1].split("|").map((c) => clean(c)).filter(Boolean);
      if (cells.length >= 2) {
        statements.push({ text: cells.join(" — "), form: "table-row", line_start: lineNumber, line_end: lineNumber });
      }
      continue;
    }

    if (paragraphStart === null) paragraphStart = lineNumber;
    paragraph.push(line.trim());
  }

  flushParagraph(section.bodyEnd);
  return statements.filter((s) => s.text.length >= 30 && s.text.length <= 900);
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z`*\[])/)
    .map((s) => clean(s))
    .filter((s) => s.length >= 30);
}

/** Markdown removed so the stored clause reads as prose, with the wording untouched. */
function clean(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Module from the SECTION's own title, never from a word in the clause.
 *
 * Scanning the clause text put a Core Values row into ORDER because it happened to contain the word
 * "orders". A specification section is titled by what it governs; a sentence merely mentions things.
 * PLATFORM is therefore the honest answer for most of these documents, which are cross-cutting by
 * design — the module-specific requirements come from sections such as 02_DATABASE § 10.7 Orders.
 */
function moduleFor(section, _text) {
  const haystack = `${section.title} ${section.parentTitle ?? ""}`;
  for (const [pattern, module] of MODULE_RULES) {
    if (pattern.test(haystack)) return module;
  }
  return "PLATFORM";
}

function typeFor(text) {
  for (const [pattern, type] of TYPE_RULES) {
    const match = pattern.exec(text);
    if (match) return { type, why: `clause uses "${match[0]}"` };
  }
  return { type: "functional", why: "prescriptive clause with no more specific vocabulary" };
}

/** A readable one-line title. The clause itself remains the requirement. */
function titleFor(text) {
  const trimmed = text.replace(/^(the|a|an|every|all|any|no)\s+/i, "");
  const short = trimmed.length <= 90 ? trimmed : `${trimmed.slice(0, 87).replace(/\s+\S*$/, "")}…`;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i++) {
    value = (value * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(value).toString(36);
}

function sortCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

main();
