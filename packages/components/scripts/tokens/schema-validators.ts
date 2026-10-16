/**
 * Generates the standalone DTCG schema validators the token runtime imports.
 *
 * Ajv compiles a schema with `new Function`, which a browser under a
 * Content-Security-Policy without `unsafe-eval` refuses, and its schema files
 * are read from disk. The runtime therefore ships validators generated here,
 * at generation time, from the vendored schemas: plain ES modules with no
 * imports, no `eval`, and no filesystem access. `tokens:check` fails when
 * they drift from the schemas or from the installed Ajv.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone';

import {
  REGENERATE_COMMAND,
  runtimeDirectory,
  schemaDirectory,
} from './generator-configuration.ts';

/**
 * The two `format` keywords the vendored DTCG schemas actually apply. Ajv
 * treats an unknown format as unconstrained, so these are registered with
 * `ajv-formats`' real validators rather than no-op stubs -- otherwise a
 * malformed `$ref` (a bad percent-escape in a token JSON Pointer, say) would
 * sail through the gate that exists to catch exactly that.
 */
const SCHEMA_FORMATS = ['uri-reference', 'json-pointer-uri-fragment'] as const;

const VALIDATORS = [
  { schema: 'dtcg-format-2025-10.json', module: 'format-validator', name: 'format' },
  { schema: 'dtcg-resolver-2025-10.json', module: 'resolver-validator', name: 'resolver' },
] as const;

function header(schema: string): string {
  return `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Standalone validator for scripts/tokens/schemas/${schema}.
 * Regenerate: ${REGENERATE_COMMAND}
 */
`;
}

function declaration(name: string, schema: string): string {
  return `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Types for the standalone ${name} validator generated from
 * scripts/tokens/schemas/${schema}.
 * Regenerate: ${REGENERATE_COMMAND}
 */

import type { ErrorObject } from 'ajv';

/** A compiled DTCG schema validator. \`errors\` is set by the most recent failing call. */
export type StandaloneValidator = ((data: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};

export const validate: StandaloneValidator;
declare const validator: StandaloneValidator;
export default validator;
`;
}

/** Absolute output path -> generated content, for every standalone validator module. */
export function buildSchemaValidatorOutputs(): Map<string, string> {
  const outputs = new Map<string, string>();
  for (const { schema, module, name } of VALIDATORS) {
    const parsed: unknown = JSON.parse(readFileSync(join(schemaDirectory, schema), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`${schema} did not parse to a JSON object`);
    }
    // Ajv instances cannot share `$id`s, so each schema gets its own.
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      logger: false,
      addUsedSchema: false,
      code: { source: true, esm: true },
    });
    addFormats(ajv, [...SCHEMA_FORMATS]);
    const code = standaloneCode(ajv, ajv.compile(parsed));
    if (/\bnew Function\b|\beval\(|\brequire\(/.test(code)) {
      throw new Error(`The standalone ${name} validator is not self-contained.`);
    }
    outputs.set(join(runtimeDirectory, `${module}.generated.js`), header(schema) + code + '\n');
    outputs.set(join(runtimeDirectory, `${module}.generated.d.ts`), declaration(name, schema));
  }
  return outputs;
}
