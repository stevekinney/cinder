/**
 * Placeholder value lookup, JSON formatting and literal-text encoding.
 *
 * Values are read through own property descriptors, so accessors and
 * `toJSON` never run, and only plain JSON data is formatted. Encoding turns a
 * formatted replacement into Markdown source that renders as literal text.
 *
 * @internal
 * @module
 */

import { isPlainObject, readDenseArray, readOwn } from './placeholder-definition-data.js';
import type { PlaceholderSchemaType } from './types.js';

/** The outcome of looking up one declared path in the supplied values. */
export type PlaceholderValueLookup =
  | { readonly status: 'missing' }
  | { readonly status: 'invalid' }
  | { readonly status: 'found'; readonly value: unknown };

const MISSING: PlaceholderValueLookup = { status: 'missing' };
const INVALID: PlaceholderValueLookup = { status: 'invalid' };

/** A JSON scalar other than a string, which is always a successful value. */
function isJsonPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'string'
  );
}

/**
 * Look up a dotted path through own data properties of plain objects.
 *
 * An absent own property, or a JSON primitive or array where an object is
 * needed, is `missing`. An accessor, an own `undefined`, or any other
 * non-plain intermediate is `invalid`. The final value is returned
 * unvalidated; {@link formatPlaceholderValue} checks it.
 */
export function lookupPlaceholderValue(
  values: object,
  segments: readonly string[],
): PlaceholderValueLookup {
  let current: unknown = values;
  for (const segment of segments) {
    if (!isPlainObject(current)) {
      return isJsonPrimitive(current) || Array.isArray(current) ? MISSING : INVALID;
    }
    const read = readOwn(current, segment);
    if (read.status === 'absent') return MISSING;
    if (read.status === 'accessor') return INVALID;
    current = read.value;
  }
  return { status: 'found', value: current };
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

type SerializationWork =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly value: unknown }
  | { readonly kind: 'leave'; readonly container: object };

/** Queue an array's elements, or return `false` when it is not dense plain data. */
function queueArray(array: unknown[], stack: SerializationWork[]): boolean {
  const elements = readDenseArray(array);
  if (elements === undefined) return false;
  stack.push({ kind: 'leave', container: array }, { kind: 'text', text: ']' });
  for (let index = elements.length - 1; index >= 0; index--) {
    stack.push({ kind: 'value', value: elements[index] });
    if (index > 0) stack.push({ kind: 'text', text: ',' });
  }
  stack.push({ kind: 'text', text: '[' });
  return true;
}

/** Queue an object's members with sorted keys, or return `false` for an accessor. */
function queueObject(object: object, stack: SerializationWork[]): boolean {
  const keys = Object.keys(object).toSorted(compareCodeUnits);
  const members: unknown[] = [];
  for (const key of keys) {
    const read = readOwn(object, key);
    if (read.status !== 'data') return false;
    members.push(read.value);
  }
  stack.push({ kind: 'leave', container: object }, { kind: 'text', text: '}' });
  for (let index = keys.length - 1; index >= 0; index--) {
    stack.push({ kind: 'value', value: members[index] });
    stack.push({ kind: 'text', text: `${JSON.stringify(keys[index])}:` });
    if (index > 0) stack.push({ kind: 'text', text: ',' });
  }
  stack.push({ kind: 'text', text: '{' });
  return true;
}

/** Serialize a scalar, or return `undefined` when it is not JSON. */
function serializeScalar(value: unknown): string | undefined {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  return undefined;
}

/**
 * Serialize plain JSON data as compact JSON with recursively sorted object
 * keys and original array order, iteratively so depth is not limited by the
 * call stack. Returns `undefined` for `undefined`, bigint, symbols,
 * functions, non-finite numbers, sparse arrays, accessors, cycles and
 * non-plain objects anywhere in the value. Shared acyclic references are
 * serialized at each position.
 */
export function serializePlaceholderJson(value: unknown): string | undefined {
  const parts: string[] = [];
  const ancestors = new Set<object>();
  const stack: SerializationWork[] = [{ kind: 'value', value }];
  while (stack.length > 0) {
    const work = stack.pop()!;
    if (work.kind === 'text') {
      parts.push(work.text);
      continue;
    }
    if (work.kind === 'leave') {
      ancestors.delete(work.container);
      continue;
    }
    const current = work.value;
    if (current === null || typeof current !== 'object') {
      const scalar = serializeScalar(current);
      if (scalar === undefined) return undefined;
      parts.push(scalar);
      continue;
    }
    if (ancestors.has(current)) return undefined;
    ancestors.add(current);
    const queued = Array.isArray(current)
      ? queueArray(current, stack)
      : isPlainObject(current) && queueObject(current, stack);
    if (!queued) return undefined;
  }
  return parts.join('');
}

/** A value formatted for replacement: strings stay raw, everything else is JSON text. */
export interface FormattedPlaceholderValue {
  readonly kind: 'string' | 'json';
  readonly text: string;
}

/**
 * Format a referenced value, or return `undefined` when it is not plain JSON
 * data. Strings are unchanged; numbers use JSON serialization (`-0` becomes
 * `0`); booleans and null become `true`, `false` and `null`; arrays and
 * objects become compact JSON with sorted keys.
 */
export function formatPlaceholderValue(value: unknown): FormattedPlaceholderValue | undefined {
  if (typeof value === 'string') return { kind: 'string', text: value };
  const text = serializePlaceholderJson(value);
  return text === undefined ? undefined : { kind: 'json', text };
}

/** Whether a valid JSON value satisfies declared types; omitted types accept any value. */
export function matchesPlaceholderTypes(
  value: unknown,
  types: readonly PlaceholderSchemaType[] | undefined,
): boolean {
  if (types === undefined) return true;
  return types.some((type) => {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'integer':
        return Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'null':
        return value === null;
      case 'object':
        return isPlainObject(value);
      case 'array':
        return Array.isArray(value);
    }
  });
}

/**
 * Replace U+0000 and isolated UTF-16 surrogates with visible lowercase JSON
 * escape text (`\u0000`, `\ud800`), which cannot round-trip through HTML
 * text. Valid surrogate pairs and every other character are kept.
 */
function escapeUnrepresentable(text: string): string {
  let result = '';
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    const isHigh = code >= 0xd800 && code <= 0xdbff;
    const next = text.charCodeAt(index + 1);
    if (isHigh && next >= 0xdc00 && next <= 0xdfff) {
      result += text.slice(index, index + 2);
      index++;
    } else if (code === 0 || (code >= 0xd800 && code <= 0xdfff)) {
      result += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      result += text[index];
    }
  }
  return result;
}

function isPassThrough(codePoint: number): boolean {
  return (
    (codePoint >= 0x30 && codePoint <= 0x39) ||
    (codePoint >= 0x41 && codePoint <= 0x5a) ||
    (codePoint >= 0x61 && codePoint <= 0x7a) ||
    codePoint >= 0xa0
  );
}

/**
 * Encode replacement text so Markdown renders it literally.
 *
 * U+0000 and isolated surrogates first become visible escape text. ASCII
 * letters and digits and code points at or above U+00A0 are kept; every
 * other code point, including whitespace, line breaks and all ASCII
 * punctuation, becomes a decimal character reference such as `&#42;`.
 */
export function encodeLiteralReplacement(text: string): string {
  let result = '';
  for (const character of escapeUnrepresentable(text)) {
    const codePoint = character.codePointAt(0)!;
    result += isPassThrough(codePoint) ? character : `&#${codePoint};`;
  }
  return result;
}
