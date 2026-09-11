/**
 * Test-specific C# analysis, layered on the structural analyser in csharp.mjs.
 *
 * ANALYSIS DEPTH. Structure (namespace, class, methods, attributes) comes from `parseCSharp`. What
 * this module adds is METHOD BODIES, which the component harvest has no need of but a test harvest
 * cannot do without: the body is where the evidence lives for what a test actually exercises.
 *
 * Four things are read out of a body, all of them literal and none inferred:
 *
 *   - TYPE REFERENCES — `new TransitionOrderStatusCommandHandler(…)`, `Substitute.For<IOrderRepository>()`,
 *     `Order.Create(…)`, `<OrderStatus>`. Matched later against the real component registry, so a
 *     name that is not a component in this repository never becomes an edge.
 *   - HTTP PATHS — `_client.PostAsJsonAsync("/api/v1/orders", …)`. Integration tests reference no
 *     production type at all; the literal route is the only binding evidence they carry.
 *   - ASSERTED LITERALS — `Assert.Equal("Order.EmployeeRequired", …)`, status codes, numbers. This is
 *     what later lets the impact engine say "this test pins the OLD value" rather than guessing.
 *   - THEORY DATA — every `[InlineData(…)]` row, verbatim from the source line.
 *
 * NOT attempted: resolving what a helper method does, following `AuthenticateClient()` into its
 * body, or determining which overload is called. A test that reaches production code only through a
 * private helper is under-linked rather than wrongly linked, which is the correct way to be wrong.
 */

import { parseCSharp, stripNoise } from "./csharp.mjs";

const FACT = /^Fact\b/;
const THEORY = /^Theory\b/;
const INLINE_DATA = /^InlineData\s*\(/;
const MEMBER_DATA = /^MemberData\s*\(/;

/** `new Foo(`, `Foo.Bar(`, `Substitute.For<IFoo>()`, `<Foo>`, `Foo.Create(` — literal type mentions. */
const TYPE_REFERENCE_PATTERNS = [
  { via: "instantiation", pattern: /\bnew\s+([A-Z][A-Za-z0-9_]*)\s*[(<{]/g },
  { via: "static-call", pattern: /\b([A-Z][A-Za-z0-9_]*)\.[A-Za-z_][A-Za-z0-9_]*\s*[(<]/g },
  { via: "generic-argument", pattern: /<\s*([A-Z][A-Za-z0-9_]*)\s*[,>]/g },
  // `Result<string> result = "hello";` — the generic argument list must be allowed between the type
  // and the variable, or every implicit-conversion and generic-local test links to nothing.
  { via: "declared-type", pattern: /^\s*(?:private|public|internal|protected)?\s*(?:readonly\s+)?([A-Z][A-Za-z0-9_]*)(?:<[^>=;]*>)?\s+_?[a-z][A-Za-z0-9_]*\s*[=;]/gm },
];

/*
 * A literal API path, with its query string tolerated but not captured.
 *
 * The first version required the closing quote immediately after the path, so
 * `GetAsync("/api/v1/reports/revenue?fromUtc=2026-01-01&toUtc=2026-01-31")` matched nothing — and
 * every Reports endpoint test silently linked to no controller at all. The query is optional and
 * discarded: the route table keys on the path.
 */
const HTTP_PATH = /["'](\/api\/v1\/[^"'?\s]*)(?:\?[^"'\s]*)?["']/g;
const HTTP_VERB = /\b(GetAsync|PostAsync|PutAsync|DeleteAsync|PatchAsync|PostAsJsonAsync|PutAsJsonAsync|GetFromJsonAsync|SendAsync)\b/;

/** Literals a test pins. Deliberately narrow: quoted strings, numbers, and enum-ish members. */
const ASSERT_LITERAL = /Assert\.\w+\s*\(\s*([^,)]+)/g;

export function isTestFile(relativePath) {
  return /^tests\//.test(relativePath) && relativePath.endsWith(".cs");
}

/** `tests/UnitTests/...` -> `UnitTests`. The project is evidence for the kind of test. */
export function testProjectOf(relativePath) {
  return /^tests\/([^/]+)\//.exec(relativePath)?.[1] ?? "unknown";
}

/**
 * Maps every line to the test method whose body encloses it, by tracking braces from each method
 * declaration. Needed because attributes, not position, mark a test — and a body may contain
 * lambdas, nested braces and raw strings.
 */
function bodyRanges(lines, members) {
  const ranges = new Map();

  for (const member of members) {
    if (member.kind !== "method" || !member.line) continue;

    let depth = 0;
    let started = false;
    let end = member.line;

    for (let index = member.line - 1; index < lines.length; index++) {
      const line = lines[index];
      for (const ch of line) {
        if (ch === "{") { depth++; started = true; }
        if (ch === "}") depth--;
      }
      if (started && depth <= 0) { end = index + 1; break; }
      // An expression-bodied test (`=> Assert.True(...)`) never opens a brace.
      if (!started && /=>/.test(line) && /;\s*$/.test(line)) { end = index + 1; break; }
      end = index + 1;
    }
    ranges.set(member.name + ":" + member.line, { start: member.line, end });
  }

  return ranges;
}

function collectMatches(text, pattern) {
  const found = [];
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) found.push(match[1]);
  }
  return found;
}

/**
 * Parses one test file into its class(es) and their test methods, with the evidence each carries.
 */
export function parseTestFile(source, relativePath) {
  const parsed = parseCSharp(source, relativePath);
  const { lines } = stripNoise(source);
  const rawLines = source.split(/\r?\n/);

  const usings = [];
  for (const line of rawLines) {
    const match = /^\s*using\s+(?:static\s+)?([\w.]+)\s*;/.exec(line);
    if (match) usings.push(match[1]);
  }

  const classes = [];
  const typeLines = parsed.types.map((t) => t.line).sort((a, b) => a - b);

  for (const type of parsed.types) {
    if (type.kind !== "class") continue;

    const ranges = bodyRanges(lines, type.members);
    const tests = [];

    for (const member of type.members) {
      if (member.kind !== "method") continue;

      const attributes = member.attributes ?? [];
      const isFact = attributes.some((a) => FACT.test(a));
      const isTheory = attributes.some((a) => THEORY.test(a));
      if (!isFact && !isTheory) continue;

      const range = ranges.get(member.name + ":" + member.line) ?? { start: member.line, end: member.line };
      const bodyStripped = lines.slice(range.start - 1, range.end).join("\n");
      const bodyRaw = rawLines.slice(range.start - 1, range.end).join("\n");

      const typeReferences = [];
      for (const { via, pattern } of TYPE_REFERENCE_PATTERNS) {
        for (const name of collectMatches(bodyStripped, pattern)) {
          typeReferences.push({ name, via });
        }
      }

      // Literal API paths, from the RAW body: stripNoise blanks string bodies, and the path is the
      // string body. The verb is taken from the same line so the edge names a specific action.
      const httpCalls = [];
      for (const line of bodyRaw.split("\n")) {
        HTTP_PATH.lastIndex = 0;
        let match;
        while ((match = HTTP_PATH.exec(line)) !== null) {
          httpCalls.push({
            path: match[1],
            normalized: match[1].replace(/\$?\{[^}]+\}/g, "{param}"),
            verb: verbFor(line, bodyRaw),
          });
        }
      }

      const assertions = [];
      ASSERT_LITERAL.lastIndex = 0;
      let assertMatch;
      while ((assertMatch = ASSERT_LITERAL.exec(bodyRaw)) !== null) {
        const literal = assertMatch[1].trim();
        if (/^["'].*["']$/.test(literal) || /^-?\d+(\.\d+)?m?$/.test(literal) || /^[A-Z][A-Za-z0-9_]*\.[A-Za-z0-9_]+$/.test(literal)) {
          assertions.push(literal.slice(0, 120));
        }
      }

      const theoryData = attributes.filter((a) => INLINE_DATA.test(a)).map((a) => a.slice(0, 200));
      const memberData = attributes.filter((a) => MEMBER_DATA.test(a)).map((a) => a.slice(0, 200));

      tests.push({
        name: member.name,
        line: member.line,
        signature: member.signature,
        attribute: isTheory ? "Theory" : "Fact",
        attributes,
        theory_data: theoryData,
        member_data: memberData,
        is_async: (member.modifiers ?? []).includes("async"),
        type_references: dedupeReferences(typeReferences),
        http_calls: dedupeHttp(httpCalls),
        assertions: [...new Set(assertions)].slice(0, 12),
        body_lines: range.end - range.start + 1,
      });
    }

    if (tests.length === 0) continue;

    // `IClassFixture<CustomWebApplicationFactory>` — the host an integration test boots.
    const fixtures = type.base_types
      .map((base) => /^IClassFixture<\s*([A-Za-z0-9_]+)\s*>$/.exec(base)?.[1])
      .filter(Boolean);

    /*
     * CLASS-SCOPE REFERENCES — everything the class touches OUTSIDE its test method bodies:
     * shared fields, the constructor, and private helpers.
     *
     * This matters more than it sounds. `OrderFabricSaleTests` reaches `Order` only through
     *
     *     private static Order NewSale(...) => Order.CreateFabricSale(...);
     *
     * so a body-only scan found nothing in ten real tests and flagged them all as exercising no
     * production code. The class demonstrably uses the type; which of its tests do is a weaker
     * claim, so these edges are emitted at INFERRED rather than CONFIRMED.
     */
    const classEnd = typeLines.find((line) => line > type.line) ?? lines.length + 1;
    // Only TEST bodies are excluded. Excluding every method body removed the private helpers too,
    // which is precisely where `OrderFabricSaleTests` reaches `Order` — so the fix for those ten
    // tests did nothing until this distinction was made.
    const testMethodKeys = new Set(tests.map((t) => `${t.name}:${t.line}`));
    const inTestBody = new Set();
    for (const [key, range] of ranges.entries()) {
      if (!testMethodKeys.has(key)) continue;
      for (let line = range.start; line <= range.end; line++) inTestBody.add(line);
    }
    const classScopeText = lines
      .slice(type.line - 1, classEnd - 1)
      .filter((_, offset) => !inTestBody.has(type.line + offset))
      .join("\n");

    const classScopeReferences = [];
    for (const { pattern } of TYPE_REFERENCE_PATTERNS) {
      for (const name of collectMatches(classScopeText, pattern)) {
        classScopeReferences.push({ name, via: "class-scope" });
      }
    }

    classes.push({
      name: type.name,
      namespace: parsed.namespace,
      line: type.line,
      base_types: type.base_types,
      fixtures,
      usings,
      tests,
      class_scope_references: dedupeReferences(classScopeReferences),
    });
  }

  return { relativePath, namespace: parsed.namespace, usings, classes, docCitations: parsed.docCitations };
}

function verbFor(line, body) {
  const onLine = HTTP_VERB.exec(line);
  if (onLine) return normalizeVerb(onLine[1]);
  // A path split across lines from its call — look at the whole body as a fallback.
  const anywhere = HTTP_VERB.exec(body);
  return anywhere ? normalizeVerb(anywhere[1]) : null;
}

function normalizeVerb(name) {
  if (/^Get/.test(name)) return "GET";
  if (/^Post/.test(name)) return "POST";
  if (/^Put/.test(name)) return "PUT";
  if (/^Delete/.test(name)) return "DELETE";
  if (/^Patch/.test(name)) return "PATCH";
  return null;
}

function dedupeReferences(references) {
  const seen = new Map();
  for (const reference of references) {
    if (!seen.has(reference.name)) seen.set(reference.name, reference);
  }
  return [...seen.values()];
}

function dedupeHttp(calls) {
  const seen = new Map();
  for (const call of calls) {
    const key = `${call.verb ?? ""} ${call.normalized}`;
    if (!seen.has(key)) seen.set(key, call);
  }
  return [...seen.values()];
}

/**
 * What KIND of check this is, from evidence in the test itself.
 *
 * Every rule below points at something literal — a project, a status code, a fixture, an attribute.
 * Nothing is derived from the test name alone except the negative/positive split, where this
 * repository's `Method_Condition_Expectation` convention is followed without exception and the
 * expectation half is the evidence.
 */
export function classifyTest(test, testClass, project) {
  const name = test.name;
  const body = [...test.assertions, ...test.attributes].join(" ");

  if (/Unauthorized|Forbidden|WithoutBearerToken|Permission|Policy/i.test(name + body)) {
    return { type: "security", why: "asserts an authentication or authorization outcome" };
  }
  if (/ValidationError|Validator|Invalid[A-Z]|Required/i.test(name) || /VALIDATION_ERROR/.test(body)) {
    return { type: "validation", why: "asserts a validation outcome" };
  }
  if (test.http_calls.length > 0) {
    return { type: "api", why: `calls ${test.http_calls.length} literal API route(s)` };
  }
  if (project === "IntegrationTests" || testClass.fixtures.length > 0) {
    return { type: "integration", why: "runs against a booted host fixture" };
  }
  if (test.attribute === "Theory" && test.theory_data.some((d) => /-?\d/.test(d))) {
    return { type: "boundary", why: "parameterised with numeric rows" };
  }
  if (/Throws|Rejects|Refuse|Fails|NotFound|Conflict|Error/i.test(name)) {
    return { type: "negative", why: "expectation names a refusal or failure" };
  }
  return { type: "positive", why: "no failure expectation in the name; asserts a successful path" };
}

/**
 * The AREA a test covers, which is a different axis from its kind: a validation test and a boundary
 * test can both live in the Application layer.
 */
export function categorizeTest(relativePath, namespace, project, subjectLayers) {
  const layer = [...new Set(subjectLayers.filter(Boolean))];
  if (project === "IntegrationTests") return { category: "Integration", why: "IntegrationTests project" };

  const fromNamespace = /UnitTests\.(Domain|Application|Infrastructure|Shared|Api)\b/.exec(namespace ?? "")?.[1];
  if (fromNamespace) {
    const map = {
      Domain: "Domain", Application: "Application", Infrastructure: "Infrastructure",
      Shared: "Unit", Api: "API",
    };
    return { category: map[fromNamespace] ?? "Unit", why: `namespace segment ${fromNamespace}` };
  }
  if (layer.length === 1) return { category: layer[0], why: "every exercised component is in one layer" };
  return { category: "NEEDS_REVIEW", why: "no layer evidence" };
}
