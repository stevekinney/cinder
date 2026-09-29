/**
 * Shared security predicates for placeholder path validation and resolution.
 *
 * DEP-625: Prototype pollution prevention.
 * DEP-617 learning: Security constants that enforce the same invariant across layers
 * must live in one place and be imported where needed.
 *
 * @module
 */

/**
 * Reserved segments that must never be resolved in placeholder paths.
 *
 * Accessing these property names can pollute prototypes, invoke built-in methods,
 * or traverse the prototype chain in unexpected ways. All reserved segments are
 * checked case-insensitively to prevent bypasses like `__PROTO__` or `Constructor`.
 *
 * Shared by schema traversal, explicit candidate validation and runtime
 * resolution through {@link isReservedSegment}.
 */
export const RESERVED_SEGMENTS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__definegetter__',
  '__definesetter__',
  '__lookupgetter__',
  '__lookupsetter__',
  'hasownproperty',
  'isprototypeof',
  'propertyisenumerable',
  'tostring',
  'tolocalestring',
  'valueof',
]);

/** One addressable path segment: an ASCII identifier with no dots. */
export const PLACEHOLDER_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Whether a segment names a reserved or dunder property.
 *
 * Reserved names from {@link RESERVED_SEGMENTS} match case-insensitively, and
 * every segment starting with `__` is reserved. This is the single predicate
 * shared by JSON Schema traversal, explicit candidate validation and value
 * resolution.
 */
export function isReservedSegment(segment: string): boolean {
  return RESERVED_SEGMENTS.has(segment.toLowerCase()) || segment.startsWith('__');
}

/**
 * Whether a segment is unusable as a placeholder path segment.
 *
 * DEP-625: Central security validation to prevent prototype pollution. A
 * segment is blocked when it is empty (for example from `user..name`), is not
 * an ASCII identifier matching {@link PLACEHOLDER_SEGMENT_PATTERN}, or is
 * reserved according to {@link isReservedSegment}.
 */
export function isBlockedSegment(segment: string): boolean {
  return !PLACEHOLDER_SEGMENT_PATTERN.test(segment) || isReservedSegment(segment);
}
