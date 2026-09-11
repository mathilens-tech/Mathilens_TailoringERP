/**
 * C# structural analysis.
 *
 * ANALYSIS DEPTH — STATED PLAINLY, BECAUSE OVERSTATING IT WOULD MAKE EVERY DOWNSTREAM CLAIM
 * UNTRUSTWORTHY.
 *
 * This is a STRUCTURAL analyser, not a compiler. It reads declarations and the relationships C#
 * spells out syntactically. It does the following reliably:
 *
 *   - namespaces, types, base types and implemented interfaces
 *   - methods, constructors, properties, fields, enum members, with modifiers and attributes
 *   - controller routes: [Route]/[HttpGet…]/[Authorize(Policy=…)]/[AllowAnonymous], with the
 *     action route resolved against the controller prefix
 *   - constructor-injection dependencies (the dependency signal that actually matters in a
 *     codebase that uses constructor injection everywhere and no service locator)
 *   - DI registrations: AddScoped/AddSingleton/AddTransient/AddHttpClient, generic and typeof forms
 *   - EF surface: DbSet<T>, IEntityTypeConfiguration<T>, ToTable("…")
 *   - spec citations in comments (`00_MASTER_SPEC.md § 8.3`) — a hand-maintained requirement index
 *     this repository already keeps in 123 files
 *   - post-mortem narratives in comments, which are this repository's only reliable defect corpus
 *
 * It does NOT do: overload resolution, type inference, generic instantiation, call-graph
 * construction through interfaces at runtime, or dataflow. A method that reaches another type only
 * through a local variable is not seen. Where a relationship is established by shape rather than by
 * proof, it is emitted with confidence INFERRED and a `via` that says how — never CONFIRMED.
 *
 * Comments and string literals are removed before any pattern is applied, so a brace inside a
 * string cannot shift the perceived nesting. C# 11 raw strings, verbatim strings and char literals
 * are all handled, because this codebase uses all three.
 */

/** Phrases that mark a comment as narrating a past failure rather than describing intent. */
const INCIDENT_PHRASES = [
  /which is (?:exactly )?what .{0,60}turned out to be/i,
  /silent outage/i,
  /this hid until/i,
  /used to (?:fail|be|report|throw|crash|return)/i,
  /stopped being/i,
  /quietly (?:fell|deployed|renumber|disagree|starts?|stops?)/i,
  /went live querying/i,
  /the bug (?:was|is)/i,
  /only surfaced when/i,
  /and nobody would notice/i,
  /debug(?:ged)? (?:it )?for ten minutes/i,
  /failed (?:EF'?s|the) .{0,40}check/i,
  /would (?:otherwise )?(?:have )?(?:been|left|produce[d]?) .{0,40}(?:wrong|broken|stale)/i,
];

const DOC_CITATION = /(\d{2}_[A-Z0-9_]+\.md)\s*(?:§+\s*)([\d.]+(?:[-–][\d.]+)?)/g;

const MODIFIERS = new Set([
  "public", "private", "protected", "internal", "static", "sealed", "abstract", "virtual",
  "override", "async", "partial", "readonly", "const", "extern", "new", "unsafe", "required",
  "volatile", "file", "ref",
]);

/**
 * Blanks comments and string bodies while preserving line structure and column positions, so a
 * later regex sees only code and every reported line number still matches the real file.
 */
export function stripNoise(source) {
  const out = [];
  const comments = [];
  let i = 0;
  let line = 1;
  let buffer = "";
  const push = (ch) => { buffer += ch; };

  const flushLine = () => { out.push(buffer); buffer = ""; line++; };

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { flushLine(); i++; continue; }

    // Line comment
    if (ch === "/" && next === "/") {
      let text = "";
      i += 2;
      while (i < source.length && source[i] !== "\n") { text += source[i]; i++; }
      comments.push({ line, text: text.trim() });
      continue;
    }

    // Block comment (including /// XML doc when written as /** */)
    if (ch === "/" && next === "*") {
      const startLine = line;
      let text = "";
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") { flushLine(); }
        else { push(" "); text += source[i]; }
        i++;
      }
      i += 2;
      comments.push({ line: startLine, text: text.trim() });
      continue;
    }

    // Raw string literal (C# 11): """ … """ — used by InvoiceNumberGenerator for its SQL.
    if (ch === '"' && next === '"' && source[i + 2] === '"') {
      let quotes = 0;
      while (source[i + quotes] === '"') quotes++;
      const fence = '"'.repeat(quotes);
      i += quotes;
      push(" ");
      const end = source.indexOf(fence, i);
      const stop = end === -1 ? source.length : end;
      while (i < stop) {
        if (source[i] === "\n") flushLine(); else push(" ");
        i++;
      }
      i += quotes;
      continue;
    }

    // Verbatim string @"…" where "" is an escaped quote
    if (ch === "@" && next === '"') {
      i += 2;
      push(" ");
      while (i < source.length) {
        if (source[i] === '"' && source[i + 1] === '"') { i += 2; push(" "); continue; }
        if (source[i] === '"') { i++; break; }
        if (source[i] === "\n") flushLine(); else push(" ");
        i++;
      }
      continue;
    }

    // Regular or interpolated string
    if (ch === '"') {
      i++;
      push(" ");
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; push(" "); continue; }
        if (source[i] === '"') { i++; break; }
        if (source[i] === "\n") { flushLine(); i++; continue; }
        push(" ");
        i++;
      }
      continue;
    }

    // Char literal
    if (ch === "'") {
      i++;
      push(" ");
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; push(" "); continue; }
        if (source[i] === "'") { i++; break; }
        push(" ");
        i++;
      }
      continue;
    }

    push(ch);
    i++;
  }
  out.push(buffer);
  return { lines: out, comments };
}

function splitModifiers(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const mods = [];
  let index = 0;
  while (index < words.length && MODIFIERS.has(words[index])) {
    mods.push(words[index]);
    index++;
  }
  return { modifiers: mods, rest: words.slice(index).join(" ") };
}

/** Splits a base-type list on commas that are not inside generic angle brackets. */
function splitBaseTypes(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "<") depth++;
    if (ch === ">") depth--;
    if (ch === "," && depth === 0) { parts.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean).filter((p) => !/^where\b/.test(p));
}

/**
 * Type declaration.
 *
 * The `(\(([^)]*)\))?` group is not decoration: 125 of this repository's 547 C# files — every API
 * contract and most DTOs — declare a POSITIONAL record, `public sealed record LoginRequest(string
 * UserName, string Password);`. Without the primary-constructor parameter list in this pattern,
 * 23% of the codebase parsed as containing no types at all.
 */
const TYPE_DECL = /^\s*((?:(?:public|internal|private|protected|static|sealed|abstract|partial|readonly|file|ref)\s+)*)\b(class|interface|enum|record\s+struct|record|struct)\s+([A-Za-z_]\w*)\s*(<[^>]*>)?\s*(\(([^)]*)\))?\s*(?::\s*([^{]+?))?\s*(?:where\b[^{]*)?[{;]?\s*$/;

const METHOD_DECL = /^\s*((?:(?:public|private|protected|internal|static|async|override|virtual|sealed|abstract|extern|partial|new|unsafe)\s+)*)([A-Za-z_][\w<>,\[\]\?\.\s]*?)\s+([A-Za-z_]\w*)\s*(<[^>(]*>)?\s*\(([^)]*)\)?/;

const PROPERTY_DECL = /^\s*((?:(?:public|private|protected|internal|static|virtual|override|sealed|abstract|required|readonly|const|new)\s+)*)([A-Za-z_][\w<>,\[\]\?\.]*)\s+([A-Za-z_]\w*)\s*(\{\s*(get|set|init)|=>)/;

const DI_GENERIC = /\.(Add(?:Scoped|Singleton|Transient|HttpClient))<\s*([^,>]+?)\s*(?:,\s*([^>]+?)\s*)?>/g;
const DI_TYPEOF = /\.(Add(?:Scoped|Singleton|Transient))\(\s*typeof\(([^)]+)\)\s*,\s*typeof\(([^)]+)\)\s*\)/g;
const DBSET = /DbSet<\s*([A-Za-z_][\w.]*)\s*>\s+([A-Za-z_]\w*)/g;
const EF_CONFIG = /IEntityTypeConfiguration<\s*([A-Za-z_][\w.]*)\s*>/;
const TO_TABLE = /\.ToTable\(\s*"?([A-Za-z_]\w*)"?/g;

/**
 * Parses one C# file into declared types with their members and outgoing relationships.
 *
 * `relativePath` is used only to label evidence; nothing is read from disk here.
 */
export function parseCSharp(source, relativePath) {
  const { lines, comments } = stripNoise(source);
  // Structure is read from `lines` (strings blanked, so a brace or paren inside a literal cannot
  // shift the nesting); human-facing text and attribute ARGUMENTS are read from `rawLines`, because
  // blanking string bodies also blanks `[Route("api/v1/orders")]` down to `[Route(  )]`. Reading
  // attributes from the stripped text silently resolved every controller route to "/".
  const rawLines = source.split(/\r?\n/);

  const docCitations = [];
  const incidents = [];
  for (const comment of comments) {
    DOC_CITATION.lastIndex = 0;
    let match;
    while ((match = DOC_CITATION.exec(comment.text)) !== null) {
      // Trailing dot trimmed: "§ 11 Validation Strategy" captures "11." from the section pattern,
      // and "§ 11." would not match the "§ 11" a requirement records as its source.
      docCitations.push({ document: match[1], section: `§ ${match[2].replace(/\.$/, "")}`, line: comment.line });
    }
    for (const phrase of INCIDENT_PHRASES) {
      if (phrase.test(comment.text)) {
        incidents.push({
          line: comment.line,
          text: comment.text.slice(0, 400),
          matched: String(phrase).slice(1, 60),
        });
        break;
      }
    }
  }

  let namespaceName = null;
  const types = [];
  const fileLevel = { diRegistrations: [], dbSets: [], toTables: [] };

  let pendingAttributes = [];
  let depth = 0;
  const openTypes = [];

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index];
    const sourceLine = (rawLines[index] ?? "").trim();
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();

    if (trimmed.length === 0) continue;

    if (namespaceName === null) {
      const ns = /^\s*namespace\s+([\w.]+)\s*[;{]?/.exec(trimmed);
      if (ns) namespaceName = ns[1];
    }

    // Attribute lines accumulate until the declaration they decorate. Taken from the SOURCE line,
    // so `[Route("api/v1/orders")]` keeps its argument.
    let isAttributeLine = false;
    if (trimmed.startsWith("[") && !trimmed.startsWith("[]")) {
      isAttributeLine = true;
      pendingAttributes.push(sourceLine.replace(/^\[|\]$/g, ""));
    }

    // File-level relationship scans, done on the noise-stripped line so a commented-out
    // registration cannot be recorded as real.
    let m;
    DI_GENERIC.lastIndex = 0;
    while ((m = DI_GENERIC.exec(rawLine)) !== null) {
      fileLevel.diRegistrations.push({
        method: m[1], service: m[2].trim(), implementation: (m[3] ?? m[2]).trim(), line: lineNumber,
      });
    }
    DI_TYPEOF.lastIndex = 0;
    while ((m = DI_TYPEOF.exec(rawLine)) !== null) {
      fileLevel.diRegistrations.push({
        method: m[1], service: m[2].trim(), implementation: m[3].trim(), line: lineNumber, open_generic: true,
      });
    }
    DBSET.lastIndex = 0;
    while ((m = DBSET.exec(rawLine)) !== null) {
      fileLevel.dbSets.push({ entity: m[1], property: m[2], line: lineNumber });
    }
    TO_TABLE.lastIndex = 0;
    while ((m = TO_TABLE.exec(rawLine)) !== null) {
      fileLevel.toTables.push({ table: m[1], line: lineNumber });
    }

    /*
     * A positional record whose parameter list runs over several lines:
     *
     *   public sealed record CreateCustomerRequest(
     *       string FullName,
     *       string PhoneNumber);
     *
     * The declaration is one logical line spread over five physical ones, so the following lines
     * are joined until the parentheses balance and the pattern is applied to that. 38 of this
     * repository's contracts and queries are written this way — every one of them parsed as an
     * empty file until this existed.
     */
    let declarationLine = rawLine;
    let declarationSource = sourceLine;
    let consumedLines = 0;
    if (TYPE_KEYWORD_OPEN.test(rawLine) && unbalancedParens(rawLine) > 0) {
      let balance = unbalancedParens(rawLine);
      let lookahead = index + 1;
      while (lookahead < lines.length && balance > 0 && lookahead - index < 60) {
        declarationLine += ` ${lines[lookahead].trim()}`;
        declarationSource += ` ${(rawLines[lookahead] ?? "").trim()}`;
        balance += unbalancedParens(lines[lookahead]);
        lookahead++;
      }
      consumedLines = lookahead - index - 1;
    }

    const typeMatch = TYPE_DECL.exec(declarationLine);
    if (typeMatch && !trimmed.startsWith("//")) {
      const { modifiers } = splitModifiers(typeMatch[1] ?? "");
      const kind = typeMatch[2].replace(/\s+/g, " ");
      const name = typeMatch[3];
      const generics = typeMatch[4] ?? "";
      const primaryParams = typeMatch[6] ?? "";
      const bases = typeMatch[7] ? splitBaseTypes(typeMatch[7]) : [];

      const type = {
        name,
        kind,
        generics,
        modifiers,
        base_types: bases,
        attributes: [...pendingAttributes],
        line: lineNumber,
        declaration: declarationSource.replace(/\s*\{\s*$/, "").slice(0, 400),
        members: [],
        ctorParams: [],
        depth,
        efConfigures: EF_CONFIG.exec(typeMatch[7] ?? "")?.[1] ?? null,
      };

      // A positional record's parameters are its public members and its constructor at once. Both
      // are recorded, because a reader asks "what fields does this DTO carry" and the impact engine
      // asks "what types does it depend on".
      if (primaryParams.trim()) {
        const parameterTypes = parseParameters(primaryParams);
        type.ctorParams.push(...parameterTypes);
        for (const parameter of primaryParams.split(",")) {
          const parts = parameter.trim().split(/\s+/).filter(Boolean);
          if (parts.length >= 2) {
            type.members.push({
              name: parts[parts.length - 1].replace(/[=).]+.*$/, ""),
              kind: "property",
              signature: parameter.trim(),
              line: lineNumber,
              modifiers: ["positional"],
              attributes: [],
            });
          }
        }
      }

      types.push(type);
      openTypes.push({ type, depth });
      pendingAttributes = [];
      depth += countBraces(declarationLine);
      index += consumedLines;
      continue;
    }

    const activeType = openTypes.length ? openTypes[openTypes.length - 1].type : null;

    if (activeType) {
      const memberDepth = openTypes[openTypes.length - 1].depth + 1;

      if (depth === memberDepth) {
        const member = parseMember(rawLine, trimmed, activeType, lineNumber, pendingAttributes, sourceLine);
        if (member) {
          activeType.members.push(member);
          if (member.kind === "constructor") {
            activeType.ctorParams.push(...parseParameters(member.rawParams));
            activeType.ctorParamsNamed ??= [];
            activeType.ctorParamsNamed.push(...parseParametersWithNames(member.rawParams));
          }
          pendingAttributes = [];
        } else if (activeType.kind === "enum" && /^[A-Za-z_]\w*\s*(=.*)?,?$/.test(trimmed)) {
          activeType.members.push({
            name: trimmed.replace(/[=,].*$/, "").trim(),
            kind: "enum-member",
            signature: trimmed.replace(/,$/, ""),
            line: lineNumber,
            modifiers: [],
            attributes: [],
          });
        }
      }
    }

    // Attributes belong to the next declaration. A line that is neither an attribute nor a
    // declaration ends the run — otherwise attributes drift down the file and are reported against
    // members they do not decorate.
    if (!isAttributeLine && !trimmed.endsWith("]")) {
      pendingAttributes = [];
    }

    depth += countBraces(rawLine);
    while (openTypes.length && depth <= openTypes[openTypes.length - 1].depth) {
      openTypes.pop();
    }
  }

  // Method-body references, attached per type. Done after the structural pass so every member and
  // its line number is known.
  for (const type of types) {
    const scan = scanMethodBodies(type, lines);
    type.bodyReferences = scan.references;
    type.deferredCalls = scan.deferred;
  }

  return { namespace: namespaceName, types, fileLevel, docCitations, incidents, lineCount: lines.length, relativePath };
}

/*
 * ---------------------------------------------------------------------------------------------
 * METHOD-BODY REFERENCES
 *
 * Phase 2 captured only structural wiring: constructor injection, base types, EF configuration and
 * imports. That left a blind spot Phase 3 made obvious — a handler whose `Handle()` calls
 * `Order.Create(...)` recorded NO edge to `Order`, so reverse traversal from a domain entity found
 * almost no dependents and indirect impact analysis was shallow.
 *
 * These patterns close it, using the same technique the test harvester already proved on 649 real
 * edges. Four resolvable forms, in descending certainty:
 *
 *   instantiation   `new Invoice(...)`               — the type is named outright
 *   static-call     `Order.Create(...)`              — the type is named outright
 *   declared-type   `Order order;` / `Order o = ...` — the type is named outright
 *   method-call     `order.Cancel()`                 — the type is NOT named; it is resolved from a
 *                                                      local whose declaration IS in the same body
 *
 * The fourth is the only one requiring inference, and it is deliberately narrow: the local's type
 * must have been declared or `new`-ed in the same method. Anything else — a field, a parameter, a
 * chained expression — is left alone rather than guessed.
 * ---------------------------------------------------------------------------------------------
 */

/** Types that are the language and the framework, not this product. Never resolved, never edges. */
const FRAMEWORK_TYPES = new Set([
  "Task", "ValueTask", "Guid", "DateTime", "DateOnly", "TimeOnly", "TimeSpan", "String", "Int32",
  "CancellationToken", "List", "Dictionary", "HashSet", "IEnumerable", "IReadOnlyList", "IList",
  "IReadOnlyDictionary", "ICollection", "Array", "Math", "Convert", "Console", "Exception",
  "ArgumentException", "ArgumentNullException", "ArgumentOutOfRangeException", "InvalidOperationException",
  "NotImplementedException", "Enum", "Type", "Object", "Nullable", "Func", "Action", "Expression",
  "JsonSerializer", "JsonSerializerOptions", "JsonElement", "Encoding", "StringBuilder", "Regex",
  "ILogger", "IServiceCollection", "IServiceProvider", "IConfiguration", "IOptions", "IMemoryCache",
  "HttpClient", "HttpContext", "HttpResponseMessage", "StringComparer", "StringComparison",
  "EF", "DbContext", "DbSet", "IQueryable", "SaveChangesInterceptor", "InterceptionResult",
  "RandomNumberGenerator", "SHA256", "AesGcm", "CryptographicException", "FormatException",
  "Assert", "Substitute", "Arg", "Record", "Path", "File", "Directory", "Uri", "Stream",
]);

const BODY_INSTANTIATION = /\bnew\s+([A-Z][A-Za-z0-9_]*)\s*[(<{]/g;
const BODY_STATIC_CALL = /(?<![.\w])([A-Z][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*[(<]/g;
const BODY_DECLARED_TYPE = /(?<![.\w])([A-Z][A-Za-z0-9_]*)(?:<[^>=;()]*>)?\??\s+([a-z_][A-Za-z0-9_]*)\s*(?:=[^=]|;)/g;
const BODY_LOCAL_FROM_NEW = /\bvar\s+([a-z_][A-Za-z0-9_]*)\s*=\s*new\s+([A-Z][A-Za-z0-9_]*)/g;
const BODY_INSTANCE_CALL = /(?<![.\w])([a-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

/**
 * Extracts the references a type's own method bodies make.
 *
 * `lines` must be the noise-stripped source, so a type name inside a string or a comment cannot
 * become a dependency.
 */
export function scanMethodBodies(type, lines) {
  const references = [];
  const deferred = [];
  const seen = new Set();
  const seenDeferred = new Set();

  const add = (name, via, line, expression) => {
    if (FRAMEWORK_TYPES.has(name) || name === type.name) return;
    const key = `${name}|${via}`;
    if (seen.has(key)) return;
    seen.add(key);
    references.push({ name, via, line, expression: expression.slice(0, 120) });
  };

  for (const member of type.members) {
    if (member.kind !== "method" && member.kind !== "constructor" && member.kind !== "property") continue;
    if (!member.line) continue;

    const range = memberBodyRange(lines, member.line);
    const body = lines.slice(range.start - 1, range.end).join("\n");
    if (!body.trim()) continue;

    // Locals whose type is known from their own declaration, so `order.Cancel()` can be resolved.
    const localTypes = new Map();
    let match;

    BODY_LOCAL_FROM_NEW.lastIndex = 0;
    while ((match = BODY_LOCAL_FROM_NEW.exec(body)) !== null) localTypes.set(match[1], match[2]);

    BODY_DECLARED_TYPE.lastIndex = 0;
    while ((match = BODY_DECLARED_TYPE.exec(body)) !== null) {
      if (match[1] === "var" || match[1] === "return") continue;
      localTypes.set(match[2], match[1]);
      add(match[1], "declared-type", lineOf(body, match.index, range.start), match[0]);
    }

    BODY_INSTANTIATION.lastIndex = 0;
    while ((match = BODY_INSTANTIATION.exec(body)) !== null) {
      add(match[1], "instantiation", lineOf(body, match.index, range.start), match[0]);
    }

    BODY_STATIC_CALL.lastIndex = 0;
    while ((match = BODY_STATIC_CALL.exec(body)) !== null) {
      add(match[1], "static-call", lineOf(body, match.index, range.start), `${match[1]}.${match[2]}(…)`);
    }

    /*
     * Locals whose type is NOT stated here, but IS discoverable:
     *
     *     var order = await _orderRepository.GetByIdAsync(id, ct);
     *     order.TransitionTo(...);
     *
     * The type of `order` is the return type of `IOrderRepository.GetByIdAsync`, which this platform
     * has already parsed into the component registry. So the call is recorded as DEFERRED and
     * resolved in a second pass once every component's members are known — two parsed signatures,
     * no guessing. Without this, every handler that loads an aggregate through its repository —
     * which is nearly all of them — recorded no edge to that aggregate at all.
     */
    const localFromCall = new Map();
    BODY_LOCAL_FROM_MEMBER_CALL.lastIndex = 0;
    while ((match = BODY_LOCAL_FROM_MEMBER_CALL.exec(body)) !== null) {
      localFromCall.set(match[1], { receiver: match[2], method: match[3] });
    }

    BODY_INSTANCE_CALL.lastIndex = 0;
    while ((match = BODY_INSTANCE_CALL.exec(body)) !== null) {
      const declaredType = localTypes.get(match[1]);
      if (declaredType) {
        add(declaredType, "method-call", lineOf(body, match.index, range.start), `${match[1]}.${match[2]}(…)`);
        continue;
      }
      const origin = localFromCall.get(match[1]);
      if (!origin) continue; // The receiver's type is not knowable here — not guessed.
      const key = `${origin.receiver}.${origin.method}|${match[1]}.${match[2]}`;
      if (seenDeferred.has(key)) continue;
      seenDeferred.add(key);
      deferred.push({
        receiver: origin.receiver,
        receiver_method: origin.method,
        local: match[1],
        called: match[2],
        line: lineOf(body, match.index, range.start),
        expression: `var ${match[1]} = ${origin.receiver}.${origin.method}(…); ${match[1]}.${match[2]}(…)`.slice(0, 160),
      });
    }
  }

  return { references, deferred };
}

const BODY_LOCAL_FROM_MEMBER_CALL =
  /\bvar\s+([a-z_][A-Za-z0-9_]*)\s*=\s*(?:await\s+)?([_a-z][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

/**
 * Unwraps a return type down to the product type inside it.
 *
 * `Task<Order?>` -> `Order`, `Task<Result<OrderDto>>` -> `OrderDto`, `IReadOnlyList<Customer>` ->
 * `Customer`. Only the wrappers this codebase actually uses are unwrapped; anything else is left
 * alone rather than guessed at.
 */
export function unwrapReturnType(signature) {
  if (!signature) return null;
  // Take the type that precedes the method name in a signature such as
  // "Task<Order?> GetByIdAsync(Guid id, CancellationToken ct)".
  const match = /^(?:(?:public|private|protected|internal|static|async|override|virtual|sealed|abstract|new)\s+)*([A-Za-z_][\w<>,\.\?\[\]\s]*?)\s+[A-Za-z_]\w*\s*\(/.exec(signature.trim());
  let type = (match?.[1] ?? "").trim();
  if (!type) return null;

  const wrappers = ["Task", "ValueTask", "Result", "IReadOnlyList", "IReadOnlyCollection", "List", "IEnumerable", "PagedResult", "Nullable"];
  let previous = null;
  while (type !== previous) {
    previous = type;
    for (const wrapper of wrappers) {
      const inner = new RegExp(`^${wrapper}<(.+)>$`).exec(type.trim());
      if (inner) { type = inner[1].trim(); break; }
    }
    type = type.replace(/\?+$/, "").trim();
  }

  // A tuple or a multi-argument generic that survived unwrapping is not a single type.
  if (/[,()]/.test(type)) return null;
  return /^[A-Z][A-Za-z0-9_]*$/.test(type) ? type : null;
}

/** The line range of a member's body, by brace tracking from its declaration. */
function memberBodyRange(lines, declarationLine) {
  let depth = 0;
  let started = false;
  for (let index = declarationLine - 1; index < lines.length; index++) {
    const line = lines[index];
    for (const ch of line) {
      if (ch === "{") { depth++; started = true; }
      if (ch === "}") depth--;
    }
    if (started && depth <= 0) return { start: declarationLine, end: index + 1 };
    // Expression-bodied member: `=> Something(...);` with no brace of its own.
    if (!started && /=>/.test(line) && /;\s*$/.test(line)) return { start: declarationLine, end: index + 1 };
  }
  return { start: declarationLine, end: Math.min(declarationLine + 1, lines.length) };
}

function lineOf(body, offset, startLine) {
  let line = startLine;
  for (let i = 0; i < offset; i++) if (body[i] === "\n") line++;
  return line;
}

/** A type header whose parameter list may continue on the next line. */
const TYPE_KEYWORD_OPEN = /\b(class|interface|record\s+struct|record|struct)\s+[A-Za-z_]\w*\s*(<[^>]*>)?\s*\(/;

function unbalancedParens(line) {
  let balance = 0;
  for (const ch of line) {
    if (ch === "(") balance++;
    if (ch === ")") balance--;
  }
  return balance;
}

function countBraces(line) {
  let delta = 0;
  for (const ch of line) {
    if (ch === "{") delta++;
    if (ch === "}") delta--;
  }
  return delta;
}

function parseMember(rawLine, trimmed, type, lineNumber, attributes, sourceLine = null) {
  const text = sourceLine ?? trimmed;
  if (/^(namespace|using|return|if|for|foreach|while|switch|throw|else|try|catch|finally|do|lock|yield|await)\b/.test(trimmed)) {
    return null;
  }

  const property = PROPERTY_DECL.exec(rawLine);
  if (property && !trimmed.includes("(")) {
    const { modifiers } = splitModifiers(property[1] ?? "");
    return {
      name: property[3],
      kind: "property",
      signature: text.replace(/\s*\{.*$/, "").replace(/\s*=>.*$/, ""),
      line: lineNumber,
      modifiers,
      attributes: [...attributes],
    };
  }

  const method = METHOD_DECL.exec(rawLine);
  if (method) {
    const { modifiers } = splitModifiers(method[1] ?? "");
    let returnType = method[2].trim();
    const name = method[3];

    /*
     * Constructor detection.
     *
     * A constructor has NO return type — `public OrderRepository(ApplicationDbContext db)` is one
     * identifier where a method has two. The optional modifiers group can therefore match empty and
     * capture "public" as the return type, which made every constructor in the codebase parse as a
     * method. Since `ctorParams` is what produces the constructor-injection dependency edges — and
     * this codebase uses constructor injection exclusively — that single mis-parse cost the
     * dependency graph most of its real edges.
     *
     * So: strip any modifier words the group left behind, and if nothing remains and the name
     * matches the type, it is a constructor.
     */
    const residual = returnType.split(/\s+/).filter((word) => word && !MODIFIERS.has(word));
    if (residual.length === 0 && name === type.name) {
      modifiers.push(...returnType.split(/\s+/).filter(Boolean).filter((w) => MODIFIERS.has(w) && !modifiers.includes(w)));
      returnType = "";
    }
    const isConstructor = name === type.name && returnType === "";

    // `new Foo(` and similar call sites are not declarations.
    if (!isConstructor && (returnType === "" || returnType === "new" || returnType === "return")) return null;
    if (!/^[A-Za-z_]/.test(name)) return null;

    return {
      name: isConstructor ? type.name : name,
      kind: isConstructor ? "constructor" : "method",
      signature: text.replace(/\s*\{\s*$/, "").replace(/;$/, ""),
      line: lineNumber,
      modifiers,
      attributes: [...attributes],
      rawParams: method[5] ?? "",
      http: extractHttp(attributes),
    };
  }

  return null;
}

/** `IOrderRepository orderRepository, ICustomerRepository customerRepository` -> the two types. */
function parseParameters(raw) {
  if (!raw || !raw.trim()) return [];
  const params = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "<" || ch === "(" || ch === "[") depth++;
    if (ch === ">" || ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { params.push(current); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) params.push(current);

  return params
    .map((p) => p.trim().replace(/^(?:params|ref|out|in|this)\s+/, ""))
    .map((p) => p.split("=")[0].trim())
    .map((p) => {
      const parts = p.split(/\s+/).filter(Boolean);
      return parts.length >= 2 ? parts.slice(0, -1).join(" ") : null;
    })
    .filter(Boolean)
    .map((t) => t.trim());
}

/**
 * Constructor parameters as { type, name } pairs.
 *
 * The name matters for deferred-call resolution: the body calls `_orderRepository.GetByIdAsync`,
 * and the only way to know that `_orderRepository` is an `IOrderRepository` is the constructor
 * parameter it was assigned from. Both the parameter name and the `_camelCase` field this codebase
 * assigns it to are recorded, since either spelling can appear in a body.
 */
export function parseParametersWithNames(raw) {
  if (!raw || !raw.trim()) return [];
  const params = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "<" || ch === "(" || ch === "[") depth++;
    if (ch === ">" || ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { params.push(current); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) params.push(current);

  return params
    .map((p) => p.trim().replace(/^(?:params|ref|out|in|this)\s+/, "").split("=")[0].trim())
    .map((p) => {
      const parts = p.split(/\s+/).filter(Boolean);
      if (parts.length < 2) return null;
      return { type: parts.slice(0, -1).join(" ").trim(), name: parts[parts.length - 1].trim() };
    })
    .filter(Boolean);
}

const HTTP_ATTRIBUTE = /^Http(Get|Post|Put|Delete|Patch|Head|Options)(?:\(\s*"?([^")]*)"?\s*\))?/;

function extractHttp(attributes) {
  for (const attribute of attributes) {
    const match = HTTP_ATTRIBUTE.exec(attribute);
    if (match) {
      const policy = attributes.find((a) => a.startsWith("Authorize"));
      return {
        method: match[1].toUpperCase(),
        template: match[2] ? match[2] : null,
        resolved_route: null,
        policy: policy ? (/Policy\s*=\s*([^)\]]+)/.exec(policy)?.[1]?.trim() ?? "Authorize") : null,
        allow_anonymous: attributes.some((a) => a.startsWith("AllowAnonymous")),
      };
    }
  }
  return null;
}

/** Joins a controller's `[Route("api/v1/orders")]` prefix to each action's own template. */
export function resolveRoutes(type) {
  const routeAttribute = type.attributes.find((a) => a.startsWith("Route("));
  const prefix = routeAttribute ? /Route\(\s*"([^"]*)"/.exec(routeAttribute)?.[1] ?? "" : "";
  const classPolicy = type.attributes.find((a) => a.startsWith("Authorize"));
  const classPolicyName = classPolicy ? (/Policy\s*=\s*([^)\]]+)/.exec(classPolicy)?.[1]?.trim() ?? "Authorize") : null;

  for (const member of type.members) {
    if (!member.http) continue;
    const template = member.http.template ?? "";
    const joined = [prefix, template].filter(Boolean).join("/").replace(/\/+/g, "/");
    member.http.resolved_route = `/${joined.replace(/^\//, "")}`;
    if (!member.http.policy && classPolicyName) member.http.policy = classPolicyName;
  }
  return prefix;
}

/**
 * What a type IS, in this codebase's own vocabulary.
 *
 * Driven by naming and location conventions that this repository follows without exception — the
 * Application layer's one-folder-per-use-case layout and the `…Command`/`…Handler`/`…Validator`
 * suffixes. Where the convention does not answer, the answer is the plain C# kind, never a guess.
 */
export function classifyType(type, relativePath, layer) {
  const name = type.name;
  const bases = type.base_types.join(",");

  if (/Controller$/.test(name) && /\/Controllers\//.test(relativePath)) return "controller";
  if (/CommandHandler$|QueryHandler$/.test(name)) return "handler";
  if (/Validator$/.test(name) || /AbstractValidator</.test(bases)) return "validator";
  if (/Command$/.test(name)) return "command";
  if (/Query$/.test(name)) return "query";
  if (/Behavior$/.test(name) || /IPipelineBehavior</.test(bases)) return "behavior";
  if (/Interceptor$/.test(name)) return "interceptor";
  if (/Configuration$/.test(name) && /IEntityTypeConfiguration</.test(bases)) return "configuration";
  if (/Repository$/.test(name) && type.kind === "class") return "repository";
  if (type.kind === "interface" && /^I.*Repository$/.test(name)) return "port";
  if (type.kind === "interface" && layer === "Application") return "port";
  if (/Dto$/.test(name) || /Request$|Response$/.test(name)) return "dto";
  if (layer === "Domain" && /AuditableEntity|IAuditable/.test(bases)) return "entity";
  if (type.kind === "record struct" || type.kind === "record" && layer === "Domain") return "value-object";
  if (/Service$|Sender$|Generator$/.test(name) && type.kind === "class") return "service";
  if (type.modifiers.includes("static") && type.members.every((m) => m.kind === "property" || m.modifiers.includes("const"))) return "constant";

  switch (type.kind) {
    case "class": return "class";
    case "interface": return "interface";
    case "enum": return "enum";
    case "record": return "record";
    case "struct":
    case "record struct": return "struct";
    default: return "unknown";
  }
}
