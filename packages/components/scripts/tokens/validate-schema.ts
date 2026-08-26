/**
 * First-pass structural validation against the official DTCG 2025.10 JSON
 * Schemas (vendored under `./schemas`, see that directory's README.md).
 *
 * This layer catches shape violations JSON Schema can express directly:
 * required composite members, enum membership, value types, and pattern
 * constraints. It intentionally runs *before* the hand-rolled semantic
 * checks in `validate.ts`, which cover rules JSON Schema structurally
 * cannot express -- `$type` inheritance from an ancestor group, alias and
 * `$extends` cycle detection, resolver axis ordering, and Cinder's own
 * token-name restrictions.
 *
 * The official schema's per-type value discriminator keys off a token's
 * *own* `$type` property. A token that relies on inherited `$type` (typed
 * only by an ancestor group) can produce ambiguous `oneOf` matches here for
 * value shapes that overlap with another type's shape (observed for scalar
 * types such as `strokeStyle` and for `typography`'s composite `lineHeight`
 * branch). Every document in the real corpus today uses only object-shaped
 * `color`/`dimension`/`duration` values, which do not hit this ambiguity --
 * verified empirically against every file under `src/tokens`. A future
 * corpus addition that inherits a scalar-shaped type without a local
 * `$type` could trip a false positive here; if that happens, the fix is to
 * add a local `$type` to the token, not to weaken this gate.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import type { ValidationIssue } from './types.ts';
import { TokenValidationError } from './types.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = join(scriptDirectory, 'schemas');

/**
 * The two `format` keywords the vendored DTCG schemas actually apply. Ajv
 * treats an unknown format as unconstrained, so these are registered with
 * `ajv-formats`' real validators rather than no-op stubs — otherwise a
 * malformed `$ref` (a bad percent-escape in a token JSON Pointer, say) would
 * sail through the official-schema gate that exists to catch exactly that.
 */
const SCHEMA_FORMATS = ['uri-reference', 'json-pointer-uri-fragment'] as const;

function isJsonSchemaDocument(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadSchema(fileName: string): object {
  const parsed: unknown = JSON.parse(readFileSync(join(schemaDirectory, fileName), 'utf8'));
  if (!isJsonSchemaDocument(parsed)) throw new Error(`${fileName} did not parse to a JSON object`);
  return parsed;
}

function createValidator(schema: object): ValidateFunction {
  const ajv = new Ajv({ allErrors: true, strict: false, logger: false, addUsedSchema: false });
  addFormats(ajv, [...SCHEMA_FORMATS]);
  return ajv.compile(schema);
}

let formatValidator: ValidateFunction | undefined;
let resolverValidator: ValidateFunction | undefined;

/** Ajv instances cannot share `$id`s, so the format and resolver schemas each get their own. */
function getFormatValidator(): ValidateFunction {
  formatValidator ??= createValidator(loadSchema('dtcg-format-2025-10.json'));
  return formatValidator;
}

function getResolverValidator(): ValidateFunction {
  resolverValidator ??= createValidator(loadSchema('dtcg-resolver-2025-10.json'));
  return resolverValidator;
}

function decodeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

function instancePathToTokenPath(source: string, instancePath: string): string {
  if (!instancePath) return source;
  const segments = instancePath.slice(1).split('/').map(decodeJsonPointerSegment);
  return [source, ...segments].join('.');
}

function describeAjvError(error: ErrorObject): string {
  switch (error.keyword) {
    case 'additionalProperties': {
      const propertyName = (error.params as { additionalProperty?: string }).additionalProperty;
      return `must NOT have additional property '${propertyName}'`;
    }
    case 'required': {
      const propertyName = (error.params as { missingProperty?: string }).missingProperty;
      return `must have required property '${propertyName}'`;
    }
    case 'enum': {
      const allowedValues = (error.params as { allowedValues?: unknown[] }).allowedValues ?? [];
      return `must be one of ${JSON.stringify(allowedValues)}`;
    }
    case 'const': {
      const allowedValue = (error.params as { allowedValue?: unknown }).allowedValue;
      return `must equal ${JSON.stringify(allowedValue)}`;
    }
    default:
      return error.message ?? 'failed schema validation';
  }
}

/** Longer JSON Pointers are more specific; surfacing those first keeps sibling `oneOf` noise last. */
function bySpecificity(left: ErrorObject, right: ErrorObject): number {
  return right.instancePath.length - left.instancePath.length;
}

function runSchemaValidation(validator: ValidateFunction, document: unknown, source: string): void {
  if (validator(document)) return;
  const errors = [...(validator.errors ?? [])].toSorted(bySpecificity);
  const issues: ValidationIssue[] = errors.map((error) => ({
    path: instancePathToTokenPath(source, error.instancePath),
    reason: describeAjvError(error),
  }));
  throw new TokenValidationError(issues);
}

/** Validates a token document against the official DTCG 2025.10 format JSON Schema. */
export function validateTokenDocumentSchema(document: unknown, source = '$'): void {
  runSchemaValidation(getFormatValidator(), document, source);
}

/**
 * Validates a document against the official DTCG 2025.10 resolver JSON Schema.
 *
 * Wired into `assertValidResolverDocument` as its first-pass gate, alongside
 * the token-document equivalent above.
 *
 * `cinder.resolver.json` previously used an array-of-`{name, source}` shape
 * for `sets`/`modifiers` and a plain string array for `resolutionOrder`, while
 * declaring the official schema's `$schema` URI. Those are genuinely different
 * document models, not a naming quibble: the official schema keys `sets` and
 * `modifiers` by name (`{ sources: [...] }` / `{ contexts: { [value]: sources[] } }`)
 * and requires `resolutionOrder` entries to be `{ "$ref": "#/sets/..." }`
 * reference objects -- see the `resolver/set.json`, `resolver/modifier.json`,
 * and `resolver/resolutionOrder.json` definitions embedded in the vendored
 * file. The document was migrated to the conformant shape rather than leaving
 * this validator unwired, and a regression test pins the old shape as
 * rejected so it cannot come back.
 */
export function validateResolverDocumentSchema(document: unknown, source = '$'): void {
  runSchemaValidation(getResolverValidator(), document, source);
}
