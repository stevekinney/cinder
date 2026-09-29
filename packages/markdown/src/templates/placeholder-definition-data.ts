/**
 * Shared internals for placeholder catalog extraction: plain-data reads that
 * never invoke accessors, schema type parsing, JSON Pointer escaping, and
 * deterministic diagnostic collection.
 *
 * Plain data means an object whose prototype is `null` or this realm's
 * `Object.prototype`, read through own property descriptors so getters and
 * `toJSON` never run. Executable Proxy objects are outside the supported data
 * contract: their descriptor traps can run, and JavaScript cannot reliably
 * detect every proxy, so no no-trap guarantee is made for them.
 *
 * @internal
 * @module
 */

import { isReservedSegment, PLACEHOLDER_SEGMENT_PATTERN } from './placeholder-security.js';
import type {
  PlaceholderCandidate,
  PlaceholderCatalogResult,
  PlaceholderDiagnostic,
  PlaceholderDiagnosticCode,
  PlaceholderSchemaType,
} from './types.js';

/** Declared JSON types in their normalized order. */
const SCHEMA_TYPE_ORDER: readonly PlaceholderSchemaType[] = [
  'string',
  'number',
  'integer',
  'boolean',
  'null',
  'object',
  'array',
];

/** The outcome of reading one own property through its descriptor. */
export type OwnRead =
  | { readonly status: 'absent' }
  | { readonly status: 'accessor' }
  | { readonly status: 'data'; readonly value: unknown };

const ABSENT: OwnRead = { status: 'absent' };
const ACCESSOR: OwnRead = { status: 'accessor' };

/** A plain-data object as accepted by {@link isPlainObject}. */
export type PlainObject = Readonly<Record<string, unknown>>;

/**
 * A plain object's prototype is `null` or this realm's `Object.prototype`.
 * Arrays, class instances and foreign-realm objects are not plain.
 */
export function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

/** Read an own property without invoking accessors or walking the prototype chain. */
export function readOwn(object: object, key: string): OwnRead {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) return ABSENT;
  if (!('value' in descriptor)) return ACCESSOR;
  return { status: 'data', value: descriptor.value };
}

/** Return the elements of a dense array of own data elements, or `undefined`. */
export function readDenseArray(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const elements: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const element = readOwn(value, String(index));
    if (element.status !== 'data') return undefined;
    elements.push(element.value);
  }
  return elements;
}

/** Escape one RFC 6901 JSON Pointer reference token. */
export function escapePointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Parse a declared `type`/`types` value into normalized schema types.
 * Returns `undefined` for an empty list, duplicates, unknown names, or any
 * value that is neither a known type string nor a dense array of them.
 */
export function parseSchemaTypes(value: unknown): readonly PlaceholderSchemaType[] | undefined {
  if (typeof value === 'string') {
    return isSchemaType(value) ? [value] : undefined;
  }
  const elements = readDenseArray(value);
  if (elements === undefined || elements.length === 0) return undefined;
  const declared = new Set<PlaceholderSchemaType>();
  for (const element of elements) {
    if (typeof element !== 'string' || !isSchemaType(element) || declared.has(element)) {
      return undefined;
    }
    declared.add(element);
  }
  return SCHEMA_TYPE_ORDER.filter((type) => declared.has(type));
}

function isSchemaType(value: string): value is PlaceholderSchemaType {
  return (SCHEMA_TYPE_ORDER as readonly string[]).includes(value);
}

/** Classify a dotted path: `undefined` when addressable, otherwise the failing code. */
export function classifyPath(path: string): 'invalid_path_format' | 'blocked_path' | undefined {
  const segments = path.split('.');
  if (!segments.every((segment) => PLACEHOLDER_SEGMENT_PATTERN.test(segment))) {
    return 'invalid_path_format';
  }
  return segments.some(isReservedSegment) ? 'blocked_path' : undefined;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function locationKey(diagnostic: PlaceholderDiagnostic): string {
  const { location } = diagnostic;
  return location.kind === 'definition'
    ? location.pointer
    : location.kind === 'configuration'
      ? location.property
      : '';
}

/**
 * Order a diagnostics list deterministically and remove identical duplicates.
 *
 * Definition and configuration diagnostics sort first, by JSON Pointer or
 * configuration property (in code-unit order) and then by `code`. Token
 * diagnostics follow, ordered by their token's `startOffset` and then by
 * `code`. Within either group, `message` and then `path` break any remaining
 * tie. Two diagnostics are identical duplicates, and only the first is kept,
 * when their `code`, `message`, `path` and `location` all match.
 *
 * The catalog extractor and the resolver both use this to order and
 * deduplicate their own diagnostics before returning them; it is exported so
 * other callers building a diagnostics list from the same primitives, such
 * as an editor's live validation, apply the identical ordering and
 * deduplication rule instead of reimplementing it.
 *
 * @param diagnostics - Diagnostics in any order, possibly with duplicates.
 * @returns A new array, ordered and deduplicated as described above.
 */
export function sortPlaceholderDiagnostics(
  diagnostics: readonly PlaceholderDiagnostic[],
): PlaceholderDiagnostic[] {
  const unique = new Map<string, PlaceholderDiagnostic>();
  for (const diagnostic of diagnostics) {
    const key = JSON.stringify([
      diagnostic.code,
      diagnostic.message,
      diagnostic.path ?? null,
      diagnostic.location,
    ]);
    if (!unique.has(key)) unique.set(key, diagnostic);
  }
  return [...unique.values()].toSorted((left, right) => {
    const leftToken = left.location.kind === 'token';
    const rightToken = right.location.kind === 'token';
    if (leftToken !== rightToken) return leftToken ? 1 : -1;
    const byLocation =
      left.location.kind === 'token' && right.location.kind === 'token'
        ? left.location.startOffset - right.location.startOffset
        : compareCodeUnits(locationKey(left), locationKey(right));
    return (
      byLocation ||
      compareCodeUnits(left.code, right.code) ||
      compareCodeUnits(left.message, right.message) ||
      compareCodeUnits(left.path ?? '', right.path ?? '')
    );
  });
}

/** Accumulates candidates and diagnostics during one extraction. */
export class CatalogCollector {
  readonly candidates: PlaceholderCandidate[] = [];
  readonly issues: PlaceholderDiagnostic[] = [];

  definition(
    code: PlaceholderDiagnosticCode,
    pointer: string,
    message: string,
    path?: string,
  ): void {
    this.issues.push({
      code,
      message,
      ...(path === undefined ? {} : { path }),
      location: { kind: 'definition', pointer },
    });
  }

  configuration(code: PlaceholderDiagnosticCode, property: string, message: string): void {
    this.issues.push({ code, message, location: { kind: 'configuration', property } });
  }

  result(): PlaceholderCatalogResult {
    return {
      candidates: this.candidates.toSorted((left, right) =>
        compareCodeUnits(left.path, right.path),
      ),
      issues: sortPlaceholderDiagnostics(this.issues),
    };
  }
}

/** Build a candidate that omits absent optional metadata instead of storing `undefined`. */
export function buildCandidate(
  path: string,
  types: readonly PlaceholderSchemaType[] | undefined,
  title: string | undefined,
  description: string | undefined,
): PlaceholderCandidate {
  return {
    path,
    ...(types === undefined ? {} : { types }),
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
  };
}
