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
 * *own* `$type` property. The private validation projection below supplies
 * effective inherited types, including `$extends` group references, so valid
 * lossless source documents do not need authored discriminator properties.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import { mergeAndExpandExtends } from './resolve.ts';
import type { TokenDocument, ValidationIssue } from './types.ts';
import { TokenValidationError } from './types.ts';

const TOKEN_TYPES = new Set([
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'strokeStyle',
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
]);

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

function isTokenDocument(value: unknown): value is TokenDocument {
  return isJsonSchemaDocument(value);
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

function isTokenType(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_TYPES.has(value);
}

/**
 * Adds effective ancestor types to a validation-only copy of a token document.
 * The DTCG schema discriminates token values using each token's own `$type`,
 * while the format allows a token to inherit that type from its nearest group.
 * Keeping this projection private preserves authored source and its metadata.
 */
type GroupIndex = Map<string, Record<string, unknown>>;

function isTokenNode(value: Record<string, unknown>): boolean {
  return '$value' in value || '$ref' in value;
}

function collectGroups(value: unknown, path: string, groups: GroupIndex): void {
  if (!isJsonSchemaDocument(value) || isTokenNode(value)) return;
  groups.set(path, value);
  for (const [name, child] of Object.entries(value)) {
    if (!name.startsWith('$')) collectGroups(child, path ? `${path}.${name}` : name, groups);
  }
}

function projectInheritedTypes(
  value: unknown,
  lookupDocuments: readonly unknown[] = [],
  source = '$',
): unknown {
  const groups: GroupIndex = new Map();
  if (isTokenDocument(value)) {
    try {
      const contextDocuments = lookupDocuments.filter(isTokenDocument);
      // Check the composed context before indexing the source's own groups:
      // a partial source override must not hide an inherited extension cycle.
      if (contextDocuments.length > 0) mergeAndExpandExtends(contextDocuments);
      const documents = [value];
      collectGroups(
        mergeAndExpandExtends(
          documents,
          contextDocuments.length > 0 ? contextDocuments : documents,
        ),
        '',
        groups,
      );
    } catch (error) {
      // A failed composition cannot be replaced with raw groups: a later
      // partial group would hide inherited extension edges and their cycles.
      if (error instanceof TokenValidationError)
        throw new TokenValidationError(
          error.issues.map(({ path, reason }) => ({
            path: path ? `${source}.${path}` : source,
            reason,
          })),
        );
      throw error;
    }
  }
  function project(node: unknown, path: string, inheritedType?: string): unknown {
    if (Array.isArray(node)) return node.map((entry) => entry);
    if (!isJsonSchemaDocument(node)) return node;
    const token = isTokenNode(node);
    const ownType = token ? undefined : groups.get(path)?.['$type'];
    const groupType = isTokenType(ownType) ? ownType : inheritedType;
    const projected: Record<string, unknown> = {};
    const defineProjectedProperty = (key: string, entry: unknown): void => {
      Object.defineProperty(projected, key, {
        configurable: true,
        enumerable: true,
        value: entry,
        writable: true,
      });
    };
    for (const [key, entry] of Object.entries(node)) {
      if (key === '$root' && isJsonSchemaDocument(entry))
        defineProjectedProperty(key, project(entry, path, groupType));
      else if (!key.startsWith('$') && !token)
        defineProjectedProperty(key, project(entry, path ? `${path}.${key}` : key, groupType));
      else defineProjectedProperty(key, entry);
    }
    // `$ref` has no value discriminator. Leaving it untouched ensures that
    // unresolved or cyclic aliases cannot gain acceptance through the copy.
    if (token && '$value' in node && node['$type'] === undefined && groupType)
      defineProjectedProperty('$type', groupType);
    return projected;
  }

  return project(value, '');
}

function runSchemaValidation(
  validator: ValidateFunction,
  document: unknown,
  source: string,
  lookupDocuments: readonly unknown[] = [],
): void {
  const schemaDocument =
    validator === getFormatValidator()
      ? projectInheritedTypes(document, lookupDocuments, source)
      : document;
  if (validator(schemaDocument)) return;
  const errors = [...(validator.errors ?? [])].toSorted(bySpecificity);
  const issues: ValidationIssue[] = errors.map((error) => ({
    path: instancePathToTokenPath(source, error.instancePath),
    reason: describeAjvError(error),
  }));
  throw new TokenValidationError(issues);
}

/** Validates a token document against the official DTCG 2025.10 format JSON Schema. */
export function validateTokenDocumentSchema(
  document: unknown,
  source = '$',
  lookupDocuments: readonly unknown[] = [],
): void {
  runSchemaValidation(getFormatValidator(), document, source, lookupDocuments);
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
