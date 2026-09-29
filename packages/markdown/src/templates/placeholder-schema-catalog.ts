/**
 * JSON Schema subset traversal for placeholder catalogs.
 *
 * This is catalog extraction, not instance validation. Traversal is
 * iterative, so deeply nested schemas cannot overflow the call stack.
 * `buildPlaceholderCandidatesFromJsonSchema` is re-exported by
 * `template-placeholders.ts`.
 *
 * @module
 */

import {
  buildCandidate,
  CatalogCollector,
  escapePointerSegment,
  isPlainObject,
  parseSchemaTypes,
  readOwn,
  type PlainObject,
} from './placeholder-definition-data.js';
import { isReservedSegment, PLACEHOLDER_SEGMENT_PATTERN } from './placeholder-security.js';
import type { JsonSchemaObject, PlaceholderCatalogResult, PlaceholderSchemaType } from './types.js';

/** Structure-changing keywords the catalog subset rejects at traversal positions. */
const UNSUPPORTED_KEYWORDS = [
  '$ref',
  'allOf',
  'anyOf',
  'oneOf',
  'if',
  'then',
  'else',
  'patternProperties',
] as const;

/** A declared property waiting to be visited. */
interface PropertyFrame {
  readonly kind: 'property';
  readonly properties: PlainObject;
  readonly key: string;
  readonly parentPointer: string;
  readonly parentPath: string;
}

/** Marks the end of a schema node's subtree so it leaves the active ancestry. */
interface LeaveFrame {
  readonly kind: 'leave';
  readonly node: object;
}

type TraversalFrame = PropertyFrame | LeaveFrame;

/** Report unsupported structure-changing keywords on one traversal position. */
function reportUnsupportedKeywords(
  node: PlainObject,
  pointer: string,
  collector: CatalogCollector,
): void {
  for (const keyword of UNSUPPORTED_KEYWORDS) {
    if (readOwn(node, keyword).status !== 'absent') {
      collector.definition(
        'unsupported_schema',
        `${pointer}/${escapePointerSegment(keyword)}`,
        `The "${keyword}" keyword is not supported in placeholder schemas.`,
      );
    }
  }
  const additional = readOwn(node, 'additionalProperties');
  if (additional.status === 'accessor') {
    collector.definition(
      'invalid_schema',
      `${pointer}/additionalProperties`,
      'Schema keywords must be data properties, not accessors.',
    );
  } else if (additional.status === 'data' && typeof additional.value !== 'boolean') {
    collector.definition(
      'unsupported_schema',
      `${pointer}/additionalProperties`,
      'Schema-valued "additionalProperties" is not supported in placeholder schemas.',
    );
  }
}

/** Read an optional display string (`title` or `description`) from a schema node. */
function readSchemaText(
  node: PlainObject,
  keyword: 'title' | 'description',
  pointer: string,
  path: string,
  collector: CatalogCollector,
): string | undefined {
  const read = readOwn(node, keyword);
  if (read.status === 'absent') return undefined;
  if (read.status === 'data' && typeof read.value === 'string') return read.value;
  collector.definition(
    'invalid_schema',
    `${pointer}/${keyword}`,
    `The "${keyword}" keyword must be a string data property.`,
    path,
  );
  return undefined;
}

/**
 * Read the `properties` of a traversable schema node, reporting a malformed
 * value. Returns `undefined` when absent or invalid.
 */
function readSchemaProperties(
  node: PlainObject,
  pointer: string,
  collector: CatalogCollector,
  path?: string,
): PlainObject | undefined {
  const read = readOwn(node, 'properties');
  if (read.status === 'absent') return undefined;
  if (read.status === 'data' && isPlainObject(read.value)) return read.value;
  collector.definition(
    'invalid_schema',
    `${pointer}/properties`,
    'The "properties" keyword must be a plain object data property.',
    path,
  );
  return undefined;
}

function pushProperties(
  stack: TraversalFrame[],
  properties: PlainObject,
  parentPointer: string,
  parentPath: string,
): void {
  for (const key of Object.keys(properties)) {
    stack.push({ kind: 'property', properties, key, parentPointer, parentPath });
  }
}

/**
 * Visit one declared property: validate its key and schema, emit its
 * candidate, and return its nested `properties` when they should be walked.
 */
function visitProperty(
  frame: PropertyFrame,
  ancestry: ReadonlySet<object>,
  collector: CatalogCollector,
): { node: PlainObject; pointer: string; path: string; properties: PlainObject } | undefined {
  const pointer = `${frame.parentPointer}/properties/${escapePointerSegment(frame.key)}`;
  const path = frame.parentPath === '' ? frame.key : `${frame.parentPath}.${frame.key}`;

  if (!PLACEHOLDER_SEGMENT_PATTERN.test(frame.key)) {
    collector.definition(
      'invalid_path_format',
      pointer,
      'Property names must be ASCII identifiers to be addressable as placeholders.',
      path,
    );
    return undefined;
  }
  if (isReservedSegment(frame.key)) {
    collector.definition('blocked_path', pointer, 'Property name is reserved.', path);
    return undefined;
  }

  const read = readOwn(frame.properties, frame.key);
  if (read.status !== 'data' || !isPlainObject(read.value)) {
    collector.definition(
      'invalid_schema',
      pointer,
      'Property schemas must be plain object data properties.',
      path,
    );
    return undefined;
  }
  const node = read.value;
  if (ancestry.has(node)) {
    collector.definition(
      'cyclic_schema',
      pointer,
      'Property schema refers back to an enclosing schema.',
      path,
    );
    return undefined;
  }

  reportUnsupportedKeywords(node, pointer, collector);

  const typeRead = readOwn(node, 'type');
  let types: readonly PlaceholderSchemaType[] | undefined;
  if (typeRead.status !== 'absent') {
    types = typeRead.status === 'data' ? parseSchemaTypes(typeRead.value) : undefined;
    if (types === undefined) {
      collector.definition(
        'invalid_schema',
        `${pointer}/type`,
        'The "type" keyword must be a supported type name or a non-empty list of distinct supported type names.',
        path,
      );
      return undefined;
    }
  }

  const title = readSchemaText(node, 'title', pointer, path, collector);
  const description = readSchemaText(node, 'description', pointer, path, collector);
  collector.candidates.push(buildCandidate(path, types, title, description));

  const properties = readSchemaProperties(node, pointer, collector, path);
  if (properties === undefined) return undefined;
  if (types !== undefined && !types.includes('object')) {
    collector.definition(
      'invalid_schema',
      `${pointer}/properties`,
      'Nested "properties" require an absent type or a type that includes "object".',
      path,
    );
    return undefined;
  }
  return { node, pointer, path, properties };
}

/** Walk a schema iteratively, collecting candidates and diagnostics. */
export function collectSchema(schema: unknown, collector: CatalogCollector): void {
  const rootPointer = '/schema';
  if (!isPlainObject(schema)) {
    collector.definition('invalid_schema', rootPointer, 'The schema must be a plain object.');
    return;
  }
  const rootType = readOwn(schema, 'type');
  if (
    rootType.status === 'accessor' ||
    (rootType.status === 'data' && rootType.value !== 'object')
  ) {
    collector.definition(
      'invalid_schema',
      `${rootPointer}/type`,
      'The root schema "type" must be "object" or absent.',
    );
    return;
  }
  reportUnsupportedKeywords(schema, rootPointer, collector);
  const rootProperties = readSchemaProperties(schema, rootPointer, collector);
  if (rootProperties === undefined) return;

  const ancestry = new Set<object>([schema]);
  const stack: TraversalFrame[] = [];
  pushProperties(stack, rootProperties, rootPointer, '');

  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    if (frame.kind === 'leave') {
      ancestry.delete(frame.node);
      continue;
    }
    const visited = visitProperty(frame, ancestry, collector);
    if (visited === undefined) continue;
    ancestry.add(visited.node);
    stack.push({ kind: 'leave', node: visited.node });
    pushProperties(stack, visited.properties, visited.pointer, visited.path);
  }
}

/**
 * Extract placeholder candidates from the supported JSON Schema subset.
 *
 * Supports a root object schema (`type: 'object'` or absent) and recursively
 * declared `properties`. Every declared property emits a candidate, including
 * intermediate objects and whole arrays; `items` never creates indexed paths.
 * Candidate `types` come from `type` (a name or a list such as
 * `['string', 'null']`); an absent `type` is unknown. `title` and
 * `description` are display metadata. `required`, `enum`, `const`,
 * `default`, `examples`, `format`, numeric and string constraints, unused
 * `$defs` and boolean `additionalProperties` are inert: they are neither
 * enforced nor turned into values or suggestions.
 *
 * Diagnostics use JSON Pointers relative to the definitions object, so they
 * start with `/schema`:
 * - `unsupported_schema` for `$ref`, `allOf`, `anyOf`, `oneOf`,
 *   `if`/`then`/`else`, `patternProperties` and schema-valued
 *   `additionalProperties` on the root or any property schema. Their contents
 *   are never followed and no URL is fetched.
 * - `invalid_schema` for a malformed root, `type`, `properties`, `title`,
 *   `description`, non-plain or accessor schema data. A malformed property
 *   `type` omits that property and its descendants; valid siblings remain.
 * - `invalid_path_format` and `blocked_path` for property names that are not
 *   ASCII identifiers or are reserved, omitting their subtrees.
 * - `cyclic_schema` when a property schema repeats one of its ancestors.
 *   Shared schema objects at different acyclic paths are visited at each path.
 *
 * Any diagnostic means the catalog must not be used for completion or fill;
 * the returned candidates are the valid partial result.
 *
 * @param schema - JSON Schema object from the `schema` definitions arm.
 * @returns Candidates sorted by path in code-unit order, and ordered issues.
 */
export function buildPlaceholderCandidatesFromJsonSchema(
  schema: JsonSchemaObject,
): PlaceholderCatalogResult {
  const collector = new CatalogCollector();
  collectSchema(schema, collector);
  return collector.result();
}
