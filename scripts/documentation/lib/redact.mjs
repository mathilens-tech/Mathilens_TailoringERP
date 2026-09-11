/**
 * Secret redaction — Decision 1, enforced in code rather than by remembering.
 *
 * This repository is PUBLIC and docs/data/** is committed, so anything the harvester writes is
 * published. `appsettings.Development.json` alone contains a real JWT signing key and a database
 * password; a harvester that copied config values verbatim would publish them permanently, because
 * a git history cannot be un-pushed.
 *
 * Two layers, because either alone fails:
 *
 * 1. NEVER HARVEST VALUES. Config is read for KEY NAMES only. The existence of `Jwt:SigningKey` is
 *    documentation; its value is a credential. `describeConfigKey` is the only sanctioned way to
 *    mention configuration.
 *
 * 2. SCAN EVERYTHING ON THE WAY OUT. `scrub` runs over every string of every entity immediately
 *    before it is written, so a value that reaches the harvester by an unanticipated route — a
 *    connection string quoted in a comment, a token pasted into a doc citation — is caught anyway.
 *    Findings are reported, never silently dropped.
 *
 * A false positive here costs a redacted word in documentation. A false negative costs a published
 * credential. The patterns are therefore deliberately eager.
 */

/** Key names whose VALUES are credentials wherever they appear. */
const SECRET_KEY_PATTERN =
  /(password|passwd|pwd|secret|signingkey|signing_key|apikey|api_key|accesstoken|access_token|refreshtoken|refresh_token|clientsecret|client_secret|connectionstring|connection_string|publish[-_]?profile|privatekey|private_key|credential|authorization)/i;

/** Value shapes that are credentials regardless of the key they sit under. */
const VALUE_PATTERNS = [
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "postgres-connection-string", pattern: /\bHost=[^\s;"']+;[^"']*?(Password|Pwd)=[^\s;"']+/gi },
  { name: "sqlserver-connection-string", pattern: /\bServer=[^\s;"']+;[^"']*?(Password|Pwd)=[^\s;"']+/gi },
  {
    name: "assignment-of-secret",
    pattern: /\b(password|pwd|secret|signingkey|apikey|api_key|accesstoken|client_secret)\s*[:=]\s*["']?([^\s"',;}{)]{6,})["']?/gi,
    /*
     * `password: string` is a TYPE ANNOTATION, not a credential, and redacting it would corrupt
     * every method signature this platform documents — `changeOwnPassword(currentPassword: string)`
     * is exactly the kind of thing the source-code layer exists to record. So a match is discarded
     * when the assigned value is a type name, a language keyword, or a bare identifier with no
     * secret-like entropy. A genuine key is quoted, or long and mixed.
     */
    isFalsePositive: (_match, _key, value) => {
      const benignValues = new Set([
        "string", "number", "boolean", "any", "unknown", "object", "null", "undefined",
        "new", "await", "return", "readonly", "required", "public", "private", "nameof",
        "Guid", "String", "int", "decimal", "DateTime", "bool", "var", "const", "let",
      ]);
      if (!value) return true;
      if (benignValues.has(value)) return true;
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) && value.length < 12 && !/\d/.test(value)) return true;
      return false;
    },
  },
  { name: "azure-publish-profile", pattern: /<publishProfile[\s\S]{0,400}?<\/publishProfile>/gi },
  { name: "pem-private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    name: "long-base64-secret",
    /*
     * A base64 key, distinguished from a file path.
     *
     * The base64 alphabet includes "/", so `[A-Za-z0-9+/]{40,}` matched
     * `src/Application/Activity/Queries/Search/SearchActivityLogsQueryHandler` and every other long
     * repo path — 901 findings on the first dry run, all false, and every one of them would have
     * replaced a real path in the registry with [REDACTED]. A redactor that eats the data it is
     * protecting is worse than no redactor.
     *
     * The discriminator is that a real key carries base64 padding or a "+"; a path carries neither.
     * Two alternatives: (a) a run containing + or = padding, (b) a long unbroken alphanumeric run
     * with no separators at all. The dev signing key in appsettings.Development.json matches (a).
     */
    pattern: /\b(?=[A-Za-z0-9+/]*[+=])[A-Za-z0-9+/]{40,}={0,2}\b|\b[A-Za-z0-9]{50,}\b/g,
  },
];

/** Paths whose CONTENTS must never be read for values, only for structure. */
const SENSITIVE_FILE_PATTERN =
  /(appsettings[^/]*\.json|secrets\.json|\.env(\..*)?$|publishsettings|\.pubxml|\.pfx$|\.p12$|\.key$|id_rsa)/i;

export function isSensitiveFile(relativePath) {
  return SENSITIVE_FILE_PATTERN.test(relativePath);
}

/**
 * A base64-looking run that is actually a git sha, a hash, or an identifier is not a secret.
 * Checked before redacting so component names and commit ids survive.
 */
function looksBenign(match) {
  if (/^[0-9a-f]{40}$/i.test(match)) return true;              // git sha
  if (/^sha256:[0-9a-f]{64}$/i.test(match)) return true;        // our own content hashes
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(match) && !/[0-9]/.test(match)) return true; // one long word
  if (/\.(cs|ts|tsx|json|md|yml|yaml|csproj|slnx|css|html|mjs|js)$/i.test(match)) return true; // a file path
  if (match.includes("/") && !match.includes("+") && !match.includes("=")) return true;         // a path segment run
  return false;
}

/**
 * Redacts a single string. Returns the cleaned string plus any findings.
 *
 * The replacement names the reason, so a reader of the documentation can tell "a secret was here
 * and was removed" from "this field was empty" — an important difference when auditing.
 */
export function scrubString(value, context = "") {
  if (typeof value !== "string" || value.length === 0) {
    return { value, findings: [] };
  }

  let output = value;
  const findings = [];

  for (const { name, pattern, isFalsePositive } of VALUE_PATTERNS) {
    output = output.replace(pattern, (match, ...groups) => {
      if (name === "long-base64-secret" && looksBenign(match)) return match;
      if (isFalsePositive && isFalsePositive(match, ...groups)) return match;
      findings.push({ kind: name, context, sample: `${match.slice(0, 6)}…(${match.length} chars)` });
      return `[REDACTED:${name}]`;
    });
  }

  return { value: output, findings };
}

/**
 * Deep-scrubs an entity immediately before writing.
 *
 * Also redacts the VALUE of any object key whose NAME looks like a credential, which catches the
 * case a pure value-pattern scan misses: a short password that looks like an ordinary word.
 */
export function scrub(entity, { context = "" } = {}) {
  const findings = [];

  function walk(node, trail) {
    if (typeof node === "string") {
      const result = scrubString(node, `${context}${trail}`);
      findings.push(...result.findings);
      return result.value;
    }
    if (Array.isArray(node)) {
      return node.map((item, index) => walk(item, `${trail}[${index}]`));
    }
    if (node && typeof node === "object") {
      const out = {};
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === "string" && SECRET_KEY_PATTERN.test(key) && value.length > 0) {
          findings.push({ kind: "secret-key-name", context: `${context}${trail}.${key}`, sample: `(${value.length} chars)` });
          out[key] = "[REDACTED:secret-key-name]";
          continue;
        }
        out[key] = walk(value, `${trail}.${key}`);
      }
      return out;
    }
    return node;
  }

  return { entity: walk(entity, ""), findings };
}

/**
 * The sanctioned way to document configuration: name the key, say where it is set, never carry the
 * value. "This deployment reads Jwt:SigningKey from app settings" is documentation; the key itself
 * is not.
 */
export function describeConfigKey(key, { source, required = true, purpose = null }) {
  return {
    key,
    source,
    required,
    purpose,
    value: null,
    value_policy: "not-captured: credential-bearing configuration is referenced, never copied",
  };
}
