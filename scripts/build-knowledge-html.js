/*
 * Renders knowledge.md to a standalone knowledge.html.
 *
 * A purpose-built converter rather than a dependency: the document uses a known, small subset of
 * Markdown (headings, tables with escaped pipes, fenced blocks, nested lists holding tables), and
 * adding a package to a repo that has none for this would be the larger change.
 */

/*
 * ES modules, not CommonJS.
 *
 * This file was written before the repository had a root package.json. Phase 1 of the documentation
 * platform added one with `"type": "module"` for the AJV-based tooling, which retroactively made
 * every root-level `.js` an ES module — and this script stopped running with
 * "require is not defined in ES module scope". Converted rather than renamed to `.cjs`, so it
 * matches the rest of the tooling and the path referenced in knowledge.html's footer still holds.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = path.join(repoRoot, "knowledge.md");
const outPath = path.join(repoRoot, "knowledge.html");

const source = fs.readFileSync(mdPath, "utf8").replace(/\r\n/g, "\n");

// ---------------------------------------------------------------- inline

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Code spans are lifted out before escaping so their contents survive `<T>` and `|` untouched. */
function inline(text) {
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });

  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
  return s;
}

/** GitHub's heading slug, so the document's own table of contents keeps working. */
function slug(text) {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Splits a table row on unescaped pipes, so `\|` inside a cell stays a pipe. */
function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cur = "";
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (trimmed[i] === "|") {
      cells.push(cur);
      cur = "";
    } else {
      cur += trimmed[i];
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

// ---------------------------------------------------------------- blocks

const isFence = (l) => /^\s*```/.test(l);
const isHeading = (l) => /^#{1,6}\s+/.test(l);
const isRule = (l) => /^\s*-{3,}\s*$/.test(l);
const isListItem = (l) => /^\s*([-*]|\d+\.)\s+/.test(l);
const isTableSeparator = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
const isTableStart = (lines, i) =>
  lines[i].trim().startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]);

const headings = [];

function render(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (isFence(line)) {
      const body = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++;
      out.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (isHeading(line)) {
      const [, hashes, text] = line.match(/^(#{1,6})\s+(.*)$/);
      const level = hashes.length;
      const id = slug(text);
      if (level === 2) {
        headings.push({ id, text: text.replace(/^\d+\.\s*/, "") });
      }
      out.push(
        `<h${level} id="${id}">${inline(text)}` +
          `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`,
      );
      i++;
      continue;
    }

    if (isRule(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (isTableStart(lines, i)) {
      const head = splitRow(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr>`;
      const tbody = rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("");
      out.push(
        `<div class="table-scroll"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`,
      );
      continue;
    }

    if (isListItem(line)) {
      const indent = line.match(/^(\s*)/)[1].length;
      const ordered = /^\s*\d+\.\s/.test(line);
      const items = [];
      let cur = null;

      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);

        if (m && m[1].length === indent) {
          if (cur) items.push(cur);
          cur = [m[3]];
          i++;
          continue;
        }

        if (!l.trim()) {
          // A blank line only continues the item if indented content follows it — that is how a
          // table or a second paragraph sits inside a numbered step.
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          if (cur && j < lines.length && /^\s{2,}/.test(lines[j])) {
            cur.push("");
            i++;
            continue;
          }
          break;
        }

        if (cur && /^\s{2,}/.test(l)) {
          cur.push(l.replace(/^ {1,4}/, ""));
          i++;
          continue;
        }

        break;
      }
      if (cur) items.push(cur);

      const rendered = items
        .map((body) => {
          let html = render(body);
          // A one-paragraph item stays tight rather than growing a <p>'s margins.
          const single = html.match(/^<p>([\s\S]*)<\/p>$/);
          if (single && !single[1].includes("<p>")) html = single[1];
          return `<li>${html}</li>`;
        })
        .join("");

      out.push(ordered ? `<ol>${rendered}</ol>` : `<ul>${rendered}</ul>`);
      continue;
    }

    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isHeading(lines[i]) &&
      !isFence(lines[i]) &&
      !isRule(lines[i]) &&
      !isListItem(lines[i]) &&
      !lines[i].trim().startsWith("|")
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    else i++;
  }

  return out.join("\n");
}

const body = render(source.split("\n"));

// Plain text, not inline(): the rail is 280px and a <code> pill in it would wrap the label.
const sidebar = headings
  .map((h) => `<a href="#${h.id}">${escapeHtml(h.text.replace(/`/g, ""))}</a>`)
  .join("\n        ");

const generated = new Date().toISOString().slice(0, 10);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mathilens Tailoring ERP — knowledge base</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --surface: #f7f8fa;
    --border: #e2e5ea;
    --fg: #1c2024;
    --muted: #5b636d;
    --primary: #2563eb;
    --code-bg: #f2f4f7;
    --code-fg: #b02a5b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14171a;
      --surface: #1b1f23;
      --border: #2c3238;
      --fg: #e6e9ec;
      --muted: #9aa3ad;
      --primary: #6ea8fe;
      --code-bg: #22272c;
      --code-fg: #ff9ec4;
    }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  .layout { display: grid; grid-template-columns: 1fr; max-width: 1400px; margin: 0 auto; }
  @media (min-width: 1080px) {
    .layout { grid-template-columns: 280px minmax(0, 1fr); gap: 3rem; }
  }

  nav.toc { display: none; }
  @media (min-width: 1080px) {
    nav.toc {
      display: block;
      position: sticky;
      top: 0;
      align-self: start;
      max-height: 100dvh;
      overflow-y: auto;
      padding: 2.5rem 0 2.5rem 1.5rem;
      border-right: 1px solid var(--border);
    }
    nav.toc strong {
      display: block;
      font-size: .75rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: .75rem;
    }
    nav.toc a {
      display: block;
      padding: .3rem .5rem .3rem 0;
      font-size: .875rem;
      color: var(--muted);
      text-decoration: none;
      border-left: 2px solid transparent;
      padding-left: .75rem;
      margin-left: -.75rem;
    }
    nav.toc a:hover { color: var(--primary); border-left-color: var(--primary); }
  }

  main { min-width: 0; padding: 2.5rem 1.25rem 6rem; }
  @media (min-width: 1080px) { main { padding: 2.5rem 2rem 6rem 0; } }

  h1, h2, h3, h4 { line-height: 1.25; font-weight: 650; scroll-margin-top: 1.5rem; }
  h1 { font-size: 2rem; margin: 0 0 1.5rem; letter-spacing: -.02em; }
  h2 {
    font-size: 1.45rem;
    margin: 3.25rem 0 1rem;
    padding-bottom: .5rem;
    border-bottom: 1px solid var(--border);
    letter-spacing: -.01em;
  }
  h3 { font-size: 1.1rem; margin: 2.25rem 0 .75rem; }
  h4 { font-size: 1rem; margin: 1.75rem 0 .5rem; color: var(--muted); }

  .anchor {
    margin-left: .4rem;
    color: var(--border);
    text-decoration: none;
    font-weight: 400;
    opacity: 0;
    transition: opacity .15s;
  }
  h1:hover .anchor, h2:hover .anchor, h3:hover .anchor, h4:hover .anchor { opacity: 1; }

  p { margin: 0 0 1rem; }
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
  hr { border: 0; border-top: 1px solid var(--border); margin: 2.5rem 0; }

  ul, ol { margin: 0 0 1rem; padding-left: 1.5rem; }
  li { margin-bottom: .4rem; }
  li > ul, li > ol { margin-top: .4rem; }

  code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: .855em;
    background: var(--code-bg);
    color: var(--code-fg);
    padding: .12em .38em;
    border-radius: 4px;
    word-break: break-word;
  }
  pre {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.15rem;
    overflow-x: auto;
    margin: 0 0 1.25rem;
  }
  pre code {
    background: none;
    color: var(--fg);
    padding: 0;
    font-size: .82rem;
    line-height: 1.55;
    white-space: pre;
  }

  .table-scroll { overflow-x: auto; margin: 0 0 1.5rem; border: 1px solid var(--border); border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { text-align: left; padding: .6rem .85rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { background: var(--surface); font-weight: 600; white-space: nowrap; }
  tbody tr:last-child td { border-bottom: 0; }
  td code { white-space: nowrap; }

  strong { font-weight: 650; }
  blockquote { margin: 0 0 1rem; padding-left: 1rem; border-left: 3px solid var(--border); color: var(--muted); }

  footer.meta {
    margin-top: 4rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border);
    font-size: .8rem;
    color: var(--muted);
  }
</style>
</head>
<body>
<div class="layout">
  <nav class="toc">
    <strong>Contents</strong>
    ${sidebar}
  </nav>
  <main>
${body}
    <footer class="meta">
      Generated from <code>knowledge.md</code> on ${generated}. Edit the Markdown and re-run
      <code>scripts/build-knowledge-html.js</code> — this file is derived, not authored.
    </footer>
  </main>
</div>
</body>
</html>
`;

fs.writeFileSync(outPath, html, "utf8");
console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB, ${headings.length} sections)`);
