/**
 * Maps a prop's TypeScript type string to a {@link ControlKind} discriminated union.
 *
 * This is the single source of truth for type→control mapping. The static analyzer
 * (`analyze.ts`) calls {@link inferControlKind} after extracting type text from ts-morph;
 * the wrapper generator calls {@link defaultForControl} when no explicit defaultValue
 * is available.
 */

/** Discriminated union describing the kind of UI control for a single prop. */
export type ControlKind =
  | { kind: 'text' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'select'; options: string[] }
  | { kind: 'snippet' }
  | { kind: 'unknown'; rawType: string };

/** Regex matching a single-quoted string literal arm: `'foo'`. */
const SINGLE_QUOTED_PATTERN = /^'[^']+'$/;

/** Regex matching a double-quoted string literal arm: `"foo"`. */
const DOUBLE_QUOTED_PATTERN = /^"[^"]+"$/;

/** Returns true when a single type arm is a quoted string literal. */
function isQuotedLiteral(arm: string): boolean {
  return SINGLE_QUOTED_PATTERN.test(arm) || DOUBLE_QUOTED_PATTERN.test(arm);
}

/**
 * Returns true when every arm of a ` | `-separated type string is a quoted
 * string literal — i.e., the whole type is a union of string literals.
 */
function isStringLiteralUnion(typeText: string): boolean {
  const arms = typeText.split(' | ');
  if (arms.length < 1) return false;
  return arms.every((arm) => isQuotedLiteral(arm.trim()));
}

/**
 * Strips a single pair of surrounding single or double quotes from a string.
 * `"'primary'"` → `"primary"`.
 */
function stripQuotes(literal: string): string {
  const trimmed = literal.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Infer the {@link ControlKind} from a TypeScript type string (already resolved to text).
 *
 * Rules (applied in order, first match wins):
 *  1. `'boolean'`                                      → `{ kind: 'boolean' }`
 *  2. `'number'`                                       → `{ kind: 'number' }`
 *  3. `'string'`                                       → `{ kind: 'text' }`
 *  4. Union of all quoted string literals              → `{ kind: 'select', options: [...] }`
 *  5. Type starts with `'Snippet'`                    → `{ kind: 'snippet' }`
 *  6. Anything else                                    → `{ kind: 'unknown', rawType: typeText }`
 */
export function inferControlKind(typeText: string): ControlKind {
  const trimmed = typeText.trim();

  if (trimmed === 'boolean') return { kind: 'boolean' };
  if (trimmed === 'number') return { kind: 'number' };
  if (trimmed === 'string') return { kind: 'text' };

  if (isStringLiteralUnion(trimmed)) {
    const options = trimmed.split(' | ').map((arm) => stripQuotes(arm));
    return { kind: 'select', options };
  }

  if (trimmed.startsWith('Snippet')) return { kind: 'snippet' };

  return { kind: 'unknown', rawType: trimmed };
}

/**
 * Produce a default value appropriate for a new control instance of the given kind.
 *
 * Used by the wrapper generator when no explicit `defaultValue` is available on
 * the prop manifest.
 *
 * - `boolean`  → `false`
 * - `number`   → `0`
 * - `text`     → `''`
 * - `select`   → first option string (or `''` if the options array is empty)
 * - `snippet`  → `undefined`
 * - `unknown`  → `undefined`
 */
export function defaultForControl(control: ControlKind): unknown {
  switch (control.kind) {
    case 'boolean':
      return false;
    case 'number':
      return 0;
    case 'text':
      return '';
    case 'select':
      return control.options[0] ?? '';
    case 'snippet':
      return undefined;
    case 'unknown':
      return undefined;
  }
}
