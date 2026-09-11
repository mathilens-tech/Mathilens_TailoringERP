/**
 * JSON Schema validation, draft 2020-12, via AJV.
 *
 * Every schema is registered under its bare filename `$id`, so cross-file references read as
 * `common.schema.json#/$defs/confidence` — short enough to be readable in the schemas themselves,
 * and unambiguous because the whole set is loaded into one instance.
 *
 * `strict: false` because several schemas carry `$comment` and description prose that AJV's strict
 * mode objects to; `allErrors` because a validation run should report everything wrong with a file
 * at once rather than one problem per run.
 */

import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { SCHEMAS } from "./paths.mjs";

let cached = null;

export function loadValidators() {
  if (cached) return cached;

  const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);

  const files = fs.readdirSync(SCHEMAS).filter((f) => f.endsWith(".schema.json"));
  const schemas = {};

  for (const file of files) {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS, file), "utf8"));
    ajv.addSchema(schema, schema.$id ?? file);
    schemas[schema.$id ?? file] = schema;
  }

  cached = { ajv, schemas, files };
  return cached;
}

/** Validate against a whole-file schema, e.g. `component.schema.json`. */
export function validateAgainst(schemaId, data) {
  const { ajv } = loadValidators();
  const validate = ajv.getSchema(schemaId);
  if (!validate) throw new Error(`Unknown schema: ${schemaId}`);
  const ok = validate(data);
  return { ok, errors: ok ? [] : formatErrors(validate.errors) };
}

/** Validate against a `$defs` entry, e.g. `support.schema.json#/$defs/risk`. */
export function validateAgainstDef(schemaId, defName, data) {
  const { ajv } = loadValidators();
  const ref = `${schemaId}#/$defs/${defName}`;
  const validate = ajv.getSchema(ref);
  if (!validate) throw new Error(`Unknown schema definition: ${ref}`);
  const ok = validate(data);
  return { ok, errors: ok ? [] : formatErrors(validate.errors) };
}

function formatErrors(errors) {
  return (errors ?? []).map((e) => {
    const where = e.instancePath || "(root)";
    const extra = e.params && Object.keys(e.params).length ? ` ${JSON.stringify(e.params)}` : "";
    return `${where} ${e.message}${extra}`;
  });
}
