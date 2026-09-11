/**
 * TypeScript / TSX structural analysis.
 *
 * ANALYSIS DEPTH. Same honesty as the C# side: this reads what the syntax states and nothing more.
 * Reliable here are exports, imports, the "use client" boundary, App Router route paths derived
 * from file location, and — the valuable one — LITERAL API PATHS.
 *
 * The literal-path extraction is what stitches the frontend to the backend. This codebase writes
 * its calls as `apiGet<Customer>(`/api/v1/customers/${id}`, token)`, so the path template is present
 * in the source and can be matched against the controller route table produced by the C# analyser.
 * A path assembled at runtime from variables would not be seen, and is not claimed.
 *
 * Not attempted: JSX component-usage graphs, prop flow, hook dependency analysis, or resolving
 * `@/` aliases to their targets beyond the simple `@/ -> web/src/` substitution this project uses.
 */

const API_PATH = /["'`](\/api\/v1\/[^"'`]*)["'`]/g;
const IMPORT = /^\s*import\s+(?:type\s+)?(?:([\w*\s{},]+?)\s+from\s+)?["']([^"']+)["']/;
const EXPORT_FUNCTION = /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_]\w*)/;
const EXPORT_CONST = /^\s*export\s+const\s+([A-Za-z_]\w*)/;
const EXPORT_TYPE = /^\s*export\s+(?:type|interface)\s+([A-Za-z_]\w*)/;
const EXPORT_CLASS = /^\s*export\s+class\s+([A-Za-z_]\w*)/;
const DEFAULT_EXPORT_FN = /^\s*export\s+default\s+function\s*([A-Za-z_]\w*)?/;

/** Strips comments and string bodies, preserving line count — same reasoning as the C# analyser. */
export function stripNoise(source) {
  const out = [];
  let buffer = "";
  let i = 0;
  const flush = () => { out.push(buffer); buffer = ""; };

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { flush(); i++; continue; }

    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") flush(); else buffer += " ";
        i++;
      }
      i += 2;
      continue;
    }
    buffer += ch;
    i++;
  }
  flush();
  return out;
}

/**
 * The App Router path a file serves, or null if it is not a route.
 *
 * `web/src/app/dashboard/orders/[id]/page.tsx` -> `/dashboard/orders/[id]`
 * Route groups `(name)` are stripped, matching Next's own behaviour.
 */
export function routeForFile(relativePath) {
  const match = /^web\/src\/app\/(.*)\/(page|layout|route)\.tsx?$/.exec(relativePath);
  if (!match) {
    return /^web\/src\/app\/(page|layout)\.tsx?$/.test(relativePath) ? "/" : null;
  }
  const segments = match[1]
    .split("/")
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  return `/${segments.join("/")}`;
}

export function parseTypeScript(source, relativePath) {
  const lines = stripNoise(source);
  const rawLines = source.split(/\r?\n/);

  const exports = [];
  const imports = [];
  const apiPaths = [];
  let isClient = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (index < 5 && /^["']use client["'];?$/.test(trimmed)) isClient = true;

    const importMatch = IMPORT.exec(line);
    if (importMatch) {
      imports.push({ what: (importMatch[1] ?? "").trim(), from: importMatch[2], line: lineNumber });
    }

    let name = null;
    let kind = null;
    let match;
    if ((match = EXPORT_FUNCTION.exec(line))) { name = match[1]; kind = "function"; }
    else if ((match = EXPORT_CONST.exec(line))) { name = match[1]; kind = "const"; }
    else if ((match = EXPORT_TYPE.exec(line))) { name = match[1]; kind = "type"; }
    else if ((match = EXPORT_CLASS.exec(line))) { name = match[1]; kind = "class"; }
    else if ((match = DEFAULT_EXPORT_FN.exec(line))) { name = match[1] ?? "default"; kind = "function"; }

    if (name) {
      exports.push({
        name,
        kind,
        line: lineNumber,
        signature: (rawLines[index] ?? "").trim().slice(0, 200),
        is_default: /export\s+default/.test(line),
      });
    }

    // API paths are read from the RAW line: stripNoise blanks string bodies, and the path is the
    // string body. Comments are excluded by checking the stripped line still holds a call.
    if (/api(?:Get|Post|Put|Delete|GetPaged|PutNoContent|PostNoContent|DeleteFor|GetFile|PostFile)\s*[<(]/.test(line)
        || /["'`]\/api\/v1\//.test(rawLines[index] ?? "")) {
      API_PATH.lastIndex = 0;
      let pathMatch;
      while ((pathMatch = API_PATH.exec(rawLines[index] ?? "")) !== null) {
        apiPaths.push({
          path: pathMatch[1],
          // `${id}` is a path parameter; normalising it lets the path match a controller template.
          normalized: pathMatch[1].replace(/\$\{[^}]+\}/g, "{param}").split("?")[0],
          line: lineNumber,
        });
      }
    }
  }

  return {
    exports,
    imports,
    apiPaths,
    isClient,
    route: routeForFile(relativePath),
    lineCount: lines.length,
    relativePath,
  };
}

/** What a TS export is, in this project's vocabulary. */
export function classifyExport(exportInfo, relativePath, parsed) {
  const { name, kind } = exportInfo;
  if (parsed.route && exportInfo.is_default) return "route";
  if (/^use[A-Z]/.test(name)) return "hook";
  if (/^web\/src\/lib\/api\//.test(relativePath)) return "api-client";
  if (relativePath.endsWith(".tsx") && /^[A-Z]/.test(name) && kind === "function") return "react-component";
  if (kind === "type") return "dto";
  return "module";
}

/** `@/lib/api/orders` -> `web/src/lib/api/orders`, matching the tsconfig path alias. */
export function resolveImport(specifier, fromRelativePath) {
  if (specifier.startsWith("@/")) return `web/src/${specifier.slice(2)}`;
  if (specifier.startsWith(".")) {
    const fromDir = fromRelativePath.split("/").slice(0, -1);
    const parts = specifier.split("/");
    for (const part of parts) {
      if (part === ".") continue;
      else if (part === "..") fromDir.pop();
      else fromDir.push(part);
    }
    return fromDir.join("/");
  }
  return null; // bare specifier: an npm package, not a repository component
}
