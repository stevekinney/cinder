/**
 * CSP-safe wrappers for JSON Schema meta-schema validation, compilability
 * checks, and input normalisation, built on the shared interpreted
 * validation boundary in `utilities/json-schema-interpreter.ts`.
 *
 * Two distinct validation signals are exposed:
 *  - validateMetaSchema: does the document conform to the JSON Schema
 *    meta-schema for the chosen draft? Blind to whether $refs resolve.
 *  - tryCompile: can this schema actually be used to validate data?
 *    Catches issues meta-schema validation misses (unresolved $ref,
 *    unsupported format, bad regex, etc.).
 *
 * Previously built on Ajv, whose `compile()` code-generates a validator
 * with `new Function` — that fails under a Content-Security-Policy without
 * `unsafe-eval`. json-schema-library's `compileSchema` builds a schema-node
 * interpreter instead: it walks the schema and evaluates keywords as plain
 * function calls, so it works under that CSP.
 *
 * Both exported functions stay async: `compileInterpreted` dynamically
 * imports json-schema-library (mirroring the previous Ajv dynamic import),
 * so validation isn't in this component's static bundle unless it runs.
 */

import {
  compileInterpreted,
  dedupeInterpreterErrors,
  isRefResolutionSchemaError,
  stripPointerHash,
} from '../../utilities/json-schema-interpreter.ts';
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

/**
 * A caller-supplied `draft` override that contradicts the schema's own
 * explicit `$schema` declaration is a real correctness problem, not a
 * "pick one" ambiguity — the schema was authored for a different draft.
 * Only fires when `$schema` is present and recognised; the common override
 * case (no `$schema` at all, caller picks a draft deliberately) never
 * mismatches against itself.
 */
function explicitDraftMismatch(
  schema: Record<string, unknown>,
  draftOverride: JsonSchemaDraft | undefined,
): JsonSchemaValidationError | null {
  if (!draftOverride || draftOverride === 'unknown') return null;
  const declared = getSchemaId(schema) ? detectDraft(schema) : undefined;
  if (!declared || declared === 'unknown' || declared === draftOverride) return null;
  return {
    path: '',
    message: `Schema declares $schema for ${declared}, which does not match the requested draft override ${draftOverride}.`,
    keyword: 'schema-mismatch',
  };
}

function toValidationError(error: {
  code: string;
  message: string;
  pointer: string;
}): JsonSchemaValidationError {
  return { path: stripPointerHash(error.pointer), message: error.message, keyword: error.code };
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

  const mismatch = explicitDraftMismatch(schema, draft);
  if (mismatch) return { valid: false, errors: [mismatch] };

  const resolved = resolveDraft(draft ?? detectDraft(schema));
  try {
    // compileInterpreted's dynamic import can reject (e.g. the module fails
    // to load); json-schema-library can throw synchronously for a
    // sufficiently malformed schema. Both are schema-validation failures
    // from the caller's perspective, not unhandled exceptions — the editor
    // should surface either as a validation error, not crash the host.
    const compiled = await compileInterpreted(schema, resolved);
    // Structural shape only — blind to whether $refs resolve, matching
    // what a real JSON-Schema-meta-schema check would say. tryCompile
    // covers ref resolution.
    const errors = compiled.schemaErrors.filter((error) => !isRefResolutionSchemaError(error));
    return { valid: errors.length === 0, errors: errors.map(toValidationError) };
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
 * Each call compiles fresh, so iterating on a schema with a stable $id
 * never collides with a previous call's state.
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
    // The dynamic json-schema-library import can reject as readily as
    // compilation can throw — both are covered by this one try/catch so
    // tryCompile always resolves to { ok } rather than letting an import
    // failure surface as an unhandled rejection.
    const compiled = await compileInterpreted(schema, resolved);
    const errors = dedupeInterpreterErrors([...compiled.schemaErrors, ...compiled.refErrors]);
    if (errors.length > 0) {
      return { ok: false, error: errors.map((error) => error.message).join('; ') };
    }
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
    const schema = parsed.value;
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
