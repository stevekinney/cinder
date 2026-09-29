/**
 * Placeholder definitions normalization: validates the exclusive `schema` or
 * `candidates` arm once and produces the catalog every placeholder feature
 * shares. `normalizePlaceholderDefinitions` is re-exported by
 * `template-placeholders.ts`.
 *
 * @module
 */

import {
  CatalogCollector,
  buildCandidate,
  classifyPath,
  escapePointerSegment,
  isPlainObject,
  parseSchemaTypes,
  readDenseArray,
  readOwn,
  type PlainObject,
} from './placeholder-definition-data.js';
import { collectSchema } from './placeholder-schema-catalog.js';
import type {
  NormalizedPlaceholderDefinitions,
  PlaceholderCandidate,
  PlaceholderSchemaType,
} from './types.js';

/** Fields an explicit candidate may declare. */
const CANDIDATE_FIELDS = new Set(['path', 'types', 'title', 'description']);

/** Keys a definitions object may declare. */
const DEFINITION_FIELDS = new Set(['schema', 'candidates']);

// ─────────────────────────────────────────────────────────────────────────────
// Explicit candidates
// ─────────────────────────────────────────────────────────────────────────────

/** An optional candidate field read: `valid` is false once a diagnostic was reported. */
interface FieldRead<T> {
  readonly valid: boolean;
  readonly value: T | undefined;
}

const ABSENT_FIELD: FieldRead<never> = { valid: true, value: undefined };
const INVALID_FIELD: FieldRead<never> = { valid: false, value: undefined };

/** Stands in for an accessor so it is rejected without being invoked. */
const ACCESSOR_MARKER = Symbol('accessor');

/** Read an optional field; absent and explicit `undefined` are both absent. */
function readOptionalField(element: PlainObject, field: string): unknown {
  const read = readOwn(element, field);
  if (read.status === 'accessor') return ACCESSOR_MARKER;
  return read.status === 'data' ? read.value : undefined;
}

/** Read the non-empty, addressable `path` of an explicit candidate. */
function readCandidatePath(
  element: PlainObject,
  pointer: string,
  collector: CatalogCollector,
): FieldRead<string> {
  const value = readOptionalField(element, 'path');
  if (typeof value !== 'string' || value === '') {
    collector.definition(
      'invalid_candidate',
      `${pointer}/path`,
      'Candidate "path" must be a non-empty string data property.',
    );
    return INVALID_FIELD;
  }
  const problem = classifyPath(value);
  if (problem === undefined) return { valid: true, value };
  collector.definition(
    problem,
    `${pointer}/path`,
    problem === 'blocked_path'
      ? 'Candidate path contains a reserved segment.'
      : 'Candidate path must be dot-separated ASCII identifiers.',
    value,
  );
  return INVALID_FIELD;
}

/** Read optional `types`: a non-empty array of distinct supported names. */
function readCandidateTypes(
  element: PlainObject,
  pointer: string,
  path: string | undefined,
  collector: CatalogCollector,
): FieldRead<readonly PlaceholderSchemaType[]> {
  const value = readOptionalField(element, 'types');
  if (value === undefined) return ABSENT_FIELD;
  const types = Array.isArray(value) ? parseSchemaTypes(value) : undefined;
  if (types !== undefined) return { valid: true, value: types };
  collector.definition(
    'invalid_candidate',
    `${pointer}/types`,
    'Candidate "types" must be a non-empty array of distinct supported type names.',
    path,
  );
  return INVALID_FIELD;
}

/** Read an optional display string (`title` or `description`). */
function readCandidateText(
  element: PlainObject,
  field: 'title' | 'description',
  pointer: string,
  path: string | undefined,
  collector: CatalogCollector,
): FieldRead<string> {
  const value = readOptionalField(element, field);
  if (value === undefined) return ABSENT_FIELD;
  if (typeof value === 'string') return { valid: true, value };
  collector.definition(
    'invalid_candidate',
    `${pointer}/${field}`,
    `Candidate "${field}" must be a string data property when present.`,
    path,
  );
  return INVALID_FIELD;
}

/**
 * The outcome of validating one explicit candidate. `path` is set whenever the
 * declared path is addressable, even if other fields are invalid, so duplicate
 * detection covers every declaration; `candidate` is set only when the whole
 * entry is valid.
 */
interface CandidateValidation {
  readonly path: string | undefined;
  readonly candidate: PlaceholderCandidate | undefined;
}

const UNUSABLE_CANDIDATE: CandidateValidation = { path: undefined, candidate: undefined };

/** Validate one explicit candidate element, normalizing it when valid. */
function validateCandidate(
  value: unknown,
  pointer: string,
  collector: CatalogCollector,
): CandidateValidation {
  if (!isPlainObject(value)) {
    collector.definition('invalid_candidate', pointer, 'Candidates must be plain objects.');
    return UNUSABLE_CANDIDATE;
  }
  let knownFields = true;
  for (const field of Object.keys(value)) {
    if (!CANDIDATE_FIELDS.has(field)) {
      collector.definition(
        'invalid_candidate',
        `${pointer}/${escapePointerSegment(field)}`,
        'Candidates may only declare path, types, title and description.',
      );
      knownFields = false;
    }
  }
  const path = readCandidatePath(value, pointer, collector);
  const types = readCandidateTypes(value, pointer, path.value, collector);
  const title = readCandidateText(value, 'title', pointer, path.value, collector);
  const description = readCandidateText(value, 'description', pointer, path.value, collector);
  const valid = knownFields && types.valid && title.valid && description.valid;
  return {
    path: path.value,
    candidate:
      valid && path.value !== undefined
        ? buildCandidate(path.value, types.value, title.value, description.value)
        : undefined,
  };
}

/** Validate the explicit candidates arm, collecting normalized candidates. */
function collectCandidates(value: unknown, collector: CatalogCollector): void {
  const elements = readDenseArray(value);
  if (elements === undefined) {
    collector.definition(
      'invalid_definitions',
      '/candidates',
      'Candidates must be a dense array of own data elements.',
    );
    return;
  }
  const seen = new Set<string>();
  elements.forEach((element, index) => {
    const pointer = `/candidates/${index}`;
    const { path, candidate } = validateCandidate(element, pointer, collector);
    if (path === undefined) return;
    if (seen.has(path)) {
      collector.definition(
        'duplicate_candidate',
        `${pointer}/path`,
        'Candidate path is declared more than once.',
        path,
      );
      return;
    }
    seen.add(path);
    if (candidate !== undefined) collector.candidates.push(candidate);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Read one definitions arm; explicit `undefined` counts as absent. */
function readDefinitionArm(
  definitions: PlainObject,
  key: 'schema' | 'candidates',
  collector: CatalogCollector,
): { present: boolean; value: unknown } {
  const read = readOwn(definitions, key);
  if (read.status === 'accessor') {
    collector.definition(
      'invalid_definitions',
      `/${key}`,
      'Definition fields must be data properties, not accessors.',
    );
    return { present: true, value: undefined };
  }
  return read.status === 'data' && read.value !== undefined
    ? { present: true, value: read.value }
    : { present: false, value: undefined };
}

/**
 * Normalize placeholder definitions once into the catalog every placeholder
 * feature shares.
 *
 * `definitions` is checked at runtime even though its type is
 * {@link PlaceholderDefinitions}: it must be a plain object with exactly one
 * of `schema` or `candidates`. A non-plain value, both arms or neither arm
 * produces `invalid_definitions` at configuration property `definitions`;
 * any other key produces `invalid_definitions` at its own definition pointer.
 * The schema arm follows {@link buildPlaceholderCandidatesFromJsonSchema}.
 * Explicit candidates must be own-data plain objects with a non-empty
 * addressable `path` and optional `types`, `title` and `description`
 * (explicit `undefined` counts as absent); unknown fields, invalid metadata,
 * malformed or reserved paths and later duplicates are diagnosed at their
 * `/candidates/<index>` pointer.
 *
 * Plain data means an object whose prototype is `null` or this realm's
 * `Object.prototype`, read through own data property descriptors: getters
 * are never invoked, and class instances or foreign-realm objects are
 * rejected. Executable Proxy objects are not supported.
 *
 * Any diagnostic disables the whole catalog: `enabled` is `false` and
 * callers must not complete or fill from it, while `candidates` still lists
 * the valid partial entries. A valid empty catalog is `enabled` and permits
 * no paths.
 *
 * @param definitions - Caller-supplied definitions, validated as untrusted data.
 * @returns Sorted candidates, ordered deduplicated issues, and whether the catalog is usable.
 */
export function normalizePlaceholderDefinitions(
  definitions: unknown,
): NormalizedPlaceholderDefinitions {
  const collector = new CatalogCollector();
  if (!isPlainObject(definitions)) {
    collector.configuration(
      'invalid_definitions',
      'definitions',
      'Placeholder definitions must be a plain object.',
    );
  } else {
    for (const key of Object.keys(definitions)) {
      if (!DEFINITION_FIELDS.has(key)) {
        collector.definition(
          'invalid_definitions',
          `/${escapePointerSegment(key)}`,
          'Placeholder definitions may only declare "schema" or "candidates".',
        );
      }
    }
    const schema = readDefinitionArm(definitions, 'schema', collector);
    const candidates = readDefinitionArm(definitions, 'candidates', collector);
    if (schema.present === candidates.present) {
      collector.configuration(
        'invalid_definitions',
        'definitions',
        'Placeholder definitions must declare exactly one of "schema" or "candidates".',
      );
    } else if (schema.present) {
      if (schema.value !== undefined) collectSchema(schema.value, collector);
    } else if (candidates.value !== undefined) {
      collectCandidates(candidates.value, collector);
    }
  }
  const { candidates, issues } = collector.result();
  return { candidates, issues, enabled: issues.length === 0 };
}
