/**
 * Links components to the section of knowledge.md that discusses them.
 *
 * knowledge.md is the human narrative layer; the component registry is the machine layer. Rather
 * than copying prose into JSON — which would immediately drift — a component carries an anchor into
 * the narrative.
 *
 * THE LINK MUST BE EARNED. A component is linked only when its name appears in exactly ONE section
 * as a code span (`` `Order` ``) or in a heading. Two candidate sections means the evidence does not
 * identify one, and the answer is null. This is deliberately conservative: a wrong anchor sends a
 * reader to prose about something else, which is worse than no anchor at all.
 *
 * `knowledge_ref` is a human-owned field, so the harvester preserves whatever is there. This script
 * therefore only fills nulls — a person's link always wins, and re-running never overwrites one.
 * Every link it proposes is recorded with its evidence in docs/registry/knowledge-links.json.
 *
 * Usage: node scripts/documentation/link-knowledge.mjs [--dry-run] [--relink]
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_DIRS, REPO_ROOT, rel, readJson, writeJson } from "./lib/paths.mjs";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const RELINK = args.has("--relink");

const KNOWLEDGE = path.join(REPO_ROOT, "knowledge.md");
if (!fs.existsSync(KNOWLEDGE)) {
  console.error("knowledge.md not found — nothing to link to.");
  process.exit(1);
}

/** GitHub's heading slug, matching the anchors build-knowledge-html.js already emits. */
function slug(text) {
  return text.toLowerCase().replace(/`/g, "").replace(/[^a-z0-9 -]/g, "").trim().replace(/\s+/g, "-");
}

// ---------------------------------------------------------------- section index

const lines = fs.readFileSync(KNOWLEDGE, "utf8").split(/\r?\n/);
const sections = [];
let current = null;
let inFence = false;

for (let index = 0; index < lines.length; index++) {
  const line = lines[index];
  if (/^\s*```/.test(line)) inFence = !inFence;
  if (inFence) { if (current) current.body.push(line); continue; }

  const heading = /^(#{2,4})\s+(.*)$/.exec(line);
  if (heading) {
    current = { level: heading[1].length, title: heading[2], slug: slug(heading[2]), line: index + 1, body: [] };
    sections.push(current);
    continue;
  }
  if (current) current.body.push(line);
}

// ---------------------------------------------------------------- candidate lookup

/**
 * Where a name is mentioned as a code span or in a heading. Prose mentions are not enough: the word
 * "Order" appears in half the document, but `Order` in backticks is a reference to the type.
 */
function sectionsMentioning(name) {
  const codeSpan = new RegExp("`[^`]*\\b" + escapeRegex(name) + "\\b[^`]*`");
  const headingMention = new RegExp("\\b" + escapeRegex(name) + "\\b");
  const found = [];

  for (const section of sections) {
    const inHeading = headingMention.test(section.title);
    const inBody = section.body.some((line) => codeSpan.test(line));
    if (inHeading || inBody) {
      found.push({ section, strength: inHeading ? 2 : 1 });
    }
  }
  return found;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------- link

const proposals = [];
const stats = { considered: 0, linked: 0, alreadyLinked: 0, ambiguous: 0, notMentioned: 0 };
const written = [];

for (const file of fs.readdirSync(DATA_DIRS.source).filter((f) => f.endsWith(".json") && !f.startsWith("_"))) {
  const full = path.join(DATA_DIRS.source, file);
  const data = readJson(full);
  if (!data) continue;

  let changed = false;
  for (const component of data.components ?? []) {
    stats.considered++;

    if (component.knowledge_ref && !RELINK) { stats.alreadyLinked++; continue; }

    const bareName = component.name.replace(/<.*$/, "");
    const candidates = sectionsMentioning(bareName);

    if (candidates.length === 0) { stats.notMentioned++; continue; }

    // Prefer a heading mention when there is exactly one; otherwise a single body mention.
    const headingHits = candidates.filter((c) => c.strength === 2);
    const chosen =
      headingHits.length === 1 ? headingHits[0]
      : candidates.length === 1 ? candidates[0]
      : null;

    if (!chosen) {
      stats.ambiguous++;
      proposals.push({
        component: component.id, name: bareName, result: "ambiguous",
        candidates: candidates.map((c) => c.section.slug).slice(0, 6),
      });
      continue;
    }

    const anchor = `knowledge.html#${chosen.section.slug}`;
    component.knowledge_ref = anchor;
    changed = true;
    stats.linked++;
    proposals.push({
      component: component.id, name: bareName, result: "linked", anchor,
      section: chosen.section.title,
      evidence: chosen.strength === 2 ? "named in the section heading" : "referenced as a code span in the section body",
    });
  }

  if (changed && !DRY_RUN) {
    writeJson(full, data);
    written.push(rel(full));
  }
}

if (!DRY_RUN) {
  writeJson(path.join(REPO_ROOT, "docs/registry/knowledge-links.json"), {
    generated_at: new Date().toISOString(),
    source: "knowledge.md",
    sections_indexed: sections.length,
    stats,
    proposals,
  });
}

console.log(`Knowledge linking${DRY_RUN ? " (dry run)" : ""} — ${sections.length} sections indexed`);
console.log(`  components considered ${stats.considered}`);
console.log(`  linked                ${stats.linked}`);
console.log(`  already linked        ${stats.alreadyLinked}`);
console.log(`  ambiguous (left null) ${stats.ambiguous}`);
console.log(`  not mentioned         ${stats.notMentioned}`);
console.log(`  files written         ${written.length}`);
