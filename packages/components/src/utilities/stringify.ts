/**
 * Defensive JSON stringification utilities.
 *
 * JSON.stringify() can throw on:
 * - Circular references
 * - BigInt values
 * - Objects with toJSON() that throws
 * - Certain proxy objects
 *
 * These utilities provide fallback behavior for safe serialization.
 */

/**
 * Stringify a value with fallback for circular refs/BigInt/etc.
 *
 * - Strings are returned as-is (preserves formatting like file contents with newlines)
 * - null/undefined returns empty string
 * - Objects/arrays are JSON-stringified with indentation
 * - On serialization failure, falls back to a sentinel for non-primitive values
 *
 * @param value - The value to stringify
 * @param indent - Number of spaces for indentation (default: 2)
 * @returns The stringified value, or a sentinel on failure for non-primitive values
 *
 * @example
 * ```ts
 * stringify({ foo: 'bar' }); // '{\n  "foo": "bar"\n}'
 * stringify('hello');        // 'hello' (unchanged)
 * stringify(null);           // ''
 * stringify(circularRef);    // '[object Object]' (fallback)
 * ```
 */
export function stringify(value: unknown, indent: number = 2): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';

  try {
    const serializedValue = JSON.stringify(value, null, indent);
    if (serializedValue !== undefined) return serializedValue;
    return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'symbol'
      ? String(value)
      : '[Unserializable value]';
  } catch {
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint' ||
      typeof value === 'symbol'
    ) {
      return String(value);
    }
    return '[Unserializable value]';
  }
}

/**
 * Stringify a value, returning null on failure instead of a fallback string.
 *
 * Use this when you need to distinguish between successful serialization
 * and failure (e.g., to show different UI for unserializable content).
 *
 * - null/undefined returns null
 * - Strings are returned as-is (preserves formatting)
 * - Objects/arrays are JSON-stringified with indentation
 * - On serialization failure, returns null
 *
 * @param value - The value to stringify
 * @param indent - Number of spaces for indentation (default: 2)
 * @returns The stringified value, or null on failure
 *
 * @example
 * ```ts
 * stringifyOrNull({ foo: 'bar' }); // '{\n  "foo": "bar"\n}'
 * stringifyOrNull('hello');        // 'hello' (unchanged)
 * stringifyOrNull(null);           // null
 * stringifyOrNull(circularRef);    // null (serialization failed)
 * ```
 */
export function stringifyOrNull(value: unknown, indent: number = 2): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, indent) ?? null;
  } catch {
    return null;
  }
}
