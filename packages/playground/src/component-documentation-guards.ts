/**
 * Shared runtime type guards for the structured `avoidWhen` and `a11y`
 * documentation fields.
 *
 * Both the server-side assembler (`component-documentation.ts`) and the
 * client-side payload validator (`component-documentation-reference.ts`) need to
 * validate these shapes against untrusted JSON. Keeping the guards here means a
 * change to the type only has to update one validator — the two consumers
 * previously carried structurally-identical copies that could drift.
 */
import type { A11yMetadata, AvoidWhenEntry } from './component-documentation-types.ts';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A non-empty string once trimmed — empty/whitespace-only values are rejected. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

/** Does `object` carry only the keys in `allowed` (no extra/unknown properties)? */
function hasOnlyKeys(object: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(object).every((key) => allowed.includes(key));
}

// Kebab-case component id, mirroring manifest.schema.json's `alternative` pattern.
const KEBAB_ID = /^[a-z][a-z0-9-]*$/;

/**
 * Type guard: is `value` an array of `{ reason, alternative? }` entries?
 *
 * These guards validate untrusted JSON, so they enforce the same invariants as
 * `manifest.schema.json`: a non-empty `reason`, an optional kebab-case
 * `alternative`, and no unknown keys. A malformed payload that the schema would
 * reject must not slip through here.
 */
export function isAvoidWhenArray(value: unknown): value is AvoidWhenEntry[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!isObject(entry)) return false;
      if (!hasOnlyKeys(entry, ['reason', 'alternative'])) return false;
      const alternative = entry['alternative'];
      return (
        isNonEmptyString(entry['reason']) &&
        (alternative === undefined ||
          (typeof alternative === 'string' && KEBAB_ID.test(alternative)))
      );
    })
  );
}

/**
 * Type guard: is `value` shaped like {@link A11yMetadata} (all fields optional)?
 *
 * As with {@link isAvoidWhenArray}, this validates untrusted JSON against the
 * manifest schema's invariants: non-empty `pattern`, keyboard entries with
 * non-empty `keys` and `action` (and no extra keys), non-empty `notes`, and no
 * unknown top-level keys.
 */
export function isA11yMetadata(value: unknown): value is A11yMetadata {
  if (!isObject(value)) return false;
  if (!hasOnlyKeys(value, ['pattern', 'keyboard', 'notes'])) return false;
  const pattern = value['pattern'];
  const keyboard = value['keyboard'];
  const notes = value['notes'];
  const keyboardOk =
    keyboard === undefined ||
    (Array.isArray(keyboard) &&
      keyboard.every(
        (entry) =>
          isObject(entry) &&
          hasOnlyKeys(entry, ['keys', 'action']) &&
          isNonEmptyString(entry['keys']) &&
          isNonEmptyString(entry['action']),
      ));
  return (
    (pattern === undefined || isNonEmptyString(pattern)) &&
    keyboardOk &&
    (notes === undefined || isNonEmptyStringArray(notes))
  );
}
