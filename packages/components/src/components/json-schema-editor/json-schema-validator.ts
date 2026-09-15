/**
 * JSON Schema runtime helpers for meta-schema validation, compilability checks,
 * and input normalisation.
 *
 * Two distinct validation signals are exposed:
 *  - validateMetaSchema: does the document conform to the JSON Schema
 *    meta-schema for the chosen draft?
 *  - tryCompile: can the runtime compile this schema into a validator? Catches
 *    issues meta-schema validation misses (unresolved $ref, unsupported
 *    format, etc.).
 *
 * Both exported validation functions remain asynchronous for debounced editor
 * callers and form actions.
 */

import { detectJsonSchemaDraft } from '../../utilities/json-schema-draft.ts';
import { createRetryingLoaderCache } from '../../utilities/retrying-loader-cache.ts';
import type {
  JsonSchemaDraft,
  JsonSchemaKnownDraft,
  JsonSchemaValidationError,
  JsonSchemaValue,
} from './json-schema-editor-types.ts';

const loadJsonSchemaRuntime = createRetryingLoaderCache(
  () => import('../../utilities/json-schema-runtime.ts'),
);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Detect which draft a schema declares via $schema. Returns '2020-12' when
 * absent (newest stable). Returns 'unknown' for unrecognised values so
 * callers can fall back deliberately.
 */
export function detectDraft(schema: unknown): JsonSchemaDraft {
  return detectJsonSchemaDraft(schema);
}

function resolveDraft(draft: JsonSchemaDraft | undefined): JsonSchemaKnownDraft {
  if (!draft || draft === 'unknown') return '2020-12';
  return draft;
}

function runtimeErrorsToValidationErrors(
  errors: { data?: { pointer?: string }; message?: string; code?: unknown }[] | undefined,
): JsonSchemaValidationError[] {
  return (errors ?? []).map((error) => ({
    path: error.data?.pointer?.replace(/^#/, '') ?? '',
    message: error.message ?? 'Validation error',
    keyword: typeof error.code === 'string' ? error.code : '',
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
    // Unresolved references are reported by the compile phase separately from
    // the schema document's own meta-schema errors.
    const { compileJsonSchemaRuntime } = await loadJsonSchemaRuntime();
    const node = compileJsonSchemaRuntime(schema, resolved, { throwOnInvalidRef: false });
    const errors = runtimeErrorsToValidationErrors(
      node.schemaErrors?.filter(
        (error) =>
          error.code !== 'ref-error' && !error.message.includes('Invalid $ref to missing target'),
      ),
    );
    return {
      valid: errors.length === 0,
      errors,
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
 * Each call builds an independent interpreted schema node, so repeated
 * compilation of a schema with a stable $id remains safe.
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
    // The runtime module load and interpreted compilation can both reject;
    // this one try/catch keeps the async editor contract intact.
    const { compileJsonSchemaRuntime } = await loadJsonSchemaRuntime();
    const node = compileJsonSchemaRuntime(schema, resolved);
    const errors = runtimeErrorsToValidationErrors(node.schemaErrors);
    if (errors.length > 0) return { ok: false, error: errors[0]?.message ?? 'Invalid JSON Schema' };
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
