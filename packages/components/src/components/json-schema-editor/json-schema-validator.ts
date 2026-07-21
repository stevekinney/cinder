/**
 * Ajv wrappers for JSON Schema meta-schema validation, compilability checks,
 * and input normalisation.
 *
 * Two distinct validation signals are exposed:
 *  - validateMetaSchema: does the document conform to the JSON Schema
 *    meta-schema for the chosen draft?
 *  - tryCompile: can Ajv compile this schema into a validator? Catches
 *    issues meta-schema validation misses (unresolved $ref, unsupported
 *    format, etc.).
 *
 * tryCompile uses a fresh Ajv instance per call so iterating on a schema
 * with a stable $id never trips the "schema already exists" cache error.
 *
 * Ajv (~120KB across the three draft builds) is dynamically imported on
 * first use rather than declared as a static dependency — mirrors the
 * pattern in schema-form/schema-form-validation.ts. Both exported
 * validation functions are therefore async.
 */

import type Ajv from 'ajv';
import type Ajv2019 from 'ajv/dist/2019.js';
import type Ajv2020 from 'ajv/dist/2020.js';

import type {
  JsonSchemaDraft,
  JsonSchemaKnownDraft,
  JsonSchemaValidationError,
  JsonSchemaValue,
} from './json-schema-editor-types.ts';

const DRAFT_2020_IDS = new Set([
  'https://json-schema.org/draft/2020-12/schema',
  'http://json-schema.org/draft/2020-12/schema',
]);
const DRAFT_2019_IDS = new Set([
  'https://json-schema.org/draft/2019-09/schema',
  'http://json-schema.org/draft/2019-09/schema',
]);
const DRAFT_07_IDS = new Set([
  'http://json-schema.org/draft-07/schema#',
  'http://json-schema.org/draft-07/schema',
  'https://json-schema.org/draft-07/schema',
  'https://json-schema.org/draft-07/schema#',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getSchemaId(schema: unknown): string | undefined {
  if (!isObject(schema)) return undefined;
  const id = schema['$schema'];
  return typeof id === 'string' ? id : undefined;
}

/**
 * Detect which draft a schema declares via $schema. Returns '2020-12' when
 * absent (newest stable). Returns 'unknown' for unrecognised values so
 * callers can fall back deliberately.
 */
export function detectDraft(schema: unknown): JsonSchemaDraft {
  const id = getSchemaId(schema);
  if (!id) return '2020-12';
  if (DRAFT_2020_IDS.has(id)) return '2020-12';
  if (DRAFT_2019_IDS.has(id)) return '2019-09';
  if (DRAFT_07_IDS.has(id)) return 'draft-07';
  return 'unknown';
}

function resolveDraft(draft: JsonSchemaDraft | undefined): JsonSchemaKnownDraft {
  if (!draft || draft === 'unknown') return '2020-12';
  return draft;
}

// Dynamically imported Ajv constructors, cached so repeated validation calls
// don't re-import. Each promise resolves once; concurrent callers await the
// same in-flight import rather than triggering duplicate requests.
let ajvClassPromise: Promise<typeof Ajv> | null = null;
let ajv2019ClassPromise: Promise<typeof Ajv2019> | null = null;
let ajv2020ClassPromise: Promise<typeof Ajv2020> | null = null;

function loadAjv(): Promise<typeof Ajv> {
  ajvClassPromise ??= import('ajv').then((module) => module.default);
  return ajvClassPromise;
}

function loadAjv2019(): Promise<typeof Ajv2019> {
  ajv2019ClassPromise ??= import('ajv/dist/2019.js').then((module) => module.default);
  return ajv2019ClassPromise;
}

function loadAjv2020(): Promise<typeof Ajv2020> {
  ajv2020ClassPromise ??= import('ajv/dist/2020.js').then((module) => module.default);
  return ajv2020ClassPromise;
}

// Long-lived meta-schema validators. Safe to share — they don't compile the
// user's schema, only validate against the meta-schema.
let metaAjv2020: Ajv2020 | null = null;
let metaAjv2019: Ajv2019 | null = null;
let metaAjv07: Ajv | null = null;

async function getMetaValidator(draft: JsonSchemaKnownDraft): Promise<Ajv | Ajv2020 | Ajv2019> {
  if (draft === '2020-12') {
    if (!metaAjv2020) {
      const Ajv2020Class = await loadAjv2020();
      metaAjv2020 = new Ajv2020Class({ strict: false, allErrors: true });
    }
    return metaAjv2020;
  }
  if (draft === '2019-09') {
    if (!metaAjv2019) {
      const Ajv2019Class = await loadAjv2019();
      metaAjv2019 = new Ajv2019Class({ strict: false, allErrors: true });
    }
    return metaAjv2019;
  }
  if (!metaAjv07) {
    const AjvClass = await loadAjv();
    metaAjv07 = new AjvClass({ strict: false, allErrors: true });
  }
  return metaAjv07;
}

function ajvErrorsToValidationErrors(
  errors: { instancePath?: string; message?: string; keyword?: string }[] | null | undefined,
): JsonSchemaValidationError[] {
  if (!errors) return [];
  return errors.map((error) => ({
    path: error.instancePath ?? '',
    message: error.message ?? 'Validation error',
    keyword: error.keyword ?? '',
  }));
}

/**
 * Validate a schema document against the meta-schema for the chosen draft.
 * Boolean schemas (true / false) are always valid full-document schemas.
 */
export async function validateMetaSchema(
  schema: unknown,
  draft?: JsonSchemaDraft,
): Promise<{ valid: boolean; errors: JsonSchemaValidationError[] }> {
  if (typeof schema === 'boolean') return { valid: true, errors: [] };
  if (!isObject(schema)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Schema must be an object or boolean', keyword: '' }],
    };
  }

  const resolved = resolveDraft(draft ?? detectDraft(schema));
  try {
    // getMetaValidator's dynamic import can reject (e.g. the module fails
    // to load); ajv.validateSchema can throw synchronously (a schema
    // referencing a meta-schema URI the instance doesn't know about, e.g.
    // cross-draft $schema references). Both are schema-validation failures
    // from the caller's perspective, not unhandled exceptions — the editor
    // should surface either as a validation error, not crash the host.
    const ajv = await getMetaValidator(resolved);
    const valid = ajv.validateSchema(schema);
    return {
      valid: Boolean(valid),
      errors: ajvErrorsToValidationErrors(ajv.errors),
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          path: '',
          message: error instanceof Error ? error.message : 'Meta-schema validation failed',
          keyword: '',
        },
      ],
    };
  }
}

/**
 * Try to compile the schema. Surfaces unresolved $refs, unsupported formats,
 * and other compile-time errors that meta-schema validation misses.
 *
 * Each call uses a fresh Ajv instance so repeated compilation of a schema
 * with a stable $id does not collide with Ajv's internal cache.
 */
export async function tryCompile(
  schema: unknown,
  draft?: JsonSchemaDraft,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof schema === 'boolean') return { ok: true };
  if (!isObject(schema)) {
    return { ok: false, error: 'Schema must be an object or boolean' };
  }

  const resolved = resolveDraft(draft ?? detectDraft(schema));
  try {
    // The dynamic Ajv-class import can reject as readily as ajv.compile can
    // throw — both are covered by this one try/catch so tryCompile always
    // resolves to { ok } rather than letting an import failure surface as
    // an unhandled rejection.
    let ajv: Ajv | Ajv2020 | Ajv2019;
    if (resolved === '2020-12') {
      const Ajv2020Class = await loadAjv2020();
      ajv = new Ajv2020Class({ strict: false, addUsedSchema: false });
    } else if (resolved === '2019-09') {
      const Ajv2019Class = await loadAjv2019();
      ajv = new Ajv2019Class({ strict: false, addUsedSchema: false });
    } else {
      const AjvClass = await loadAjv();
      ajv = new AjvClass({ strict: false, addUsedSchema: false });
    }

    ajv.compile(schema);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type ParsePosition = { line: number; column: number };

function extractParsePosition(error: SyntaxError, source: string): ParsePosition | undefined {
  // V8/Bun: SyntaxError.message often includes "at position N" or
  // "in JSON at position N". Best-effort extraction; tests assert message
  // presence only, not line/col.
  const positionMatch = error.message.match(/position (\d+)/);
  const positionString = positionMatch?.[1];
  if (!positionString) return undefined;
  const offset = Number.parseInt(positionString, 10);
  if (Number.isNaN(offset) || offset < 0 || offset > source.length) return undefined;

  let line = 1;
  let column = 1;
  for (let i = 0; i < offset; i += 1) {
    if (source[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function tryParseJson(
  text: string,
):
  | { ok: true; value: unknown }
  | { ok: false; error: { message: string; line?: number; column?: number } } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      const position = extractParsePosition(error, text);
      const errorPayload: { message: string; line?: number; column?: number } = {
        message: error.message,
      };
      if (position) {
        errorPayload.line = position.line;
        errorPayload.column = position.column;
      }
      return { ok: false, error: errorPayload };
    }
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Strict JSON-compatibility check. Returns the offending path when the value
 * cannot be safely round-tripped through JSON.stringify without loss.
 *
 * This catches what JSON.stringify would silently drop or reject:
 * undefined, functions, symbols, BigInt, NaN, ±Infinity, and cycles.
 */
function findJsonIncompatibility(value: unknown, path: string, seen: Set<unknown>): string | null {
  if (value === null) return null;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'boolean') return null;
  if (valueType === 'number') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return `non-finite number at ${path || 'root'}`;
    }
    return null;
  }
  if (valueType === 'undefined') return `undefined at ${path || 'root'}`;
  if (valueType === 'function') return `function at ${path || 'root'}`;
  if (valueType === 'symbol') return `symbol at ${path || 'root'}`;
  if (valueType === 'bigint') return `bigint at ${path || 'root'}`;

  if (seen.has(value)) return `cycle at ${path || 'root'}`;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const error = findJsonIncompatibility(value[i], `${path}[${i}]`, seen);
      if (error) return error;
    }
    seen.delete(value);
    return null;
  }

  if (!isObject(value)) return null;

  const proto = Object.getPrototypeOf(value);
  if (proto !== null && proto !== Object.prototype) {
    const constructorName: string =
      typeof proto.constructor?.name === 'string' ? proto.constructor.name : 'unknown';
    return `non-plain object (${constructorName}) at ${path || 'root'}`;
  }
  for (const [key, child] of Object.entries(value)) {
    const error = findJsonIncompatibility(child, `${path}.${key}`, seen);
    if (error) return error;
  }
  seen.delete(value);
  return null;
}

const PRETTY_INDENT = 2;

/**
 * Single entry point for accepting a schema input from a parent. Handles
 * both string and object inputs and returns the raw + canonical text views
 * the editor needs.
 */
export function normaliseSchemaInput(
  input: JsonSchemaValue | string,
):
  | { ok: true; rawText: string; canonicalText: string; schema: JsonSchemaValue }
  | { ok: false; rawText: string; error: string } {
  if (typeof input === 'string') {
    const parsed = tryParseJson(input);
    if (!parsed.ok) {
      return { ok: false, rawText: input, error: parsed.error.message };
    }
    if (typeof parsed.value !== 'boolean' && !isObject(parsed.value)) {
      return {
        ok: false,
        rawText: input,
        error: 'Top-level schema must be an object or boolean',
      };
    }
    const schema = parsed.value as JsonSchemaValue;
    return {
      ok: true,
      rawText: input,
      canonicalText: JSON.stringify(schema, null, PRETTY_INDENT),
      schema,
    };
  }

  if (typeof input === 'boolean') {
    return {
      ok: true,
      rawText: JSON.stringify(input),
      canonicalText: JSON.stringify(input, null, PRETTY_INDENT),
      schema: input,
    };
  }

  if (!isObject(input)) {
    return {
      ok: false,
      rawText: '',
      error: 'Top-level schema must be an object or boolean',
    };
  }

  const incompatibility = findJsonIncompatibility(input, '', new Set());
  if (incompatibility) {
    return { ok: false, rawText: '', error: incompatibility };
  }

  return {
    ok: true,
    rawText: JSON.stringify(input),
    canonicalText: JSON.stringify(input, null, PRETTY_INDENT),
    schema: input,
  };
}
