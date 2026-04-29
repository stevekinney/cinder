/**
 * Shared security constants for placeholder path validation and resolution.
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
 * This constant is shared across:
 * - `template-placeholders.ts`: Runtime placeholder resolution
 * - `applications/web/src/lib/validators/placeholder-path.ts`: Validation layer
 * - `applications/web/src/lib/utilities/preview-composer.ts`: Preview rendering
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
