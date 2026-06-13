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

/**
 * A non-empty string once trimmed, no longer than `maxLength` characters.
 * Empty/whitespace-only values are rejected, and the upper bound mirrors the
 * corresponding `maxLength` in `manifest.schema.json` so a schema-invalid
 * (oversized) payload can't pass the runtime guard. Length is measured on the
 * raw string, matching JSON Schema's `maxLength` semantics (it does not trim).
 */
function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isBoundedStringArray(value: unknown, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isBoundedString(item, maxLength))
  );
}

// Character caps mirroring manifest.schema.json. Keeping them named and adjacent
// to the guards makes the schema/runtime contract auditable in one place.
const MAX_AVOID_REASON = 140;
const MAX_AVOID_ALTERNATIVE = 64;
const MAX_A11Y_PATTERN = 80;
const MAX_A11Y_KEY = 120;
const MAX_A11Y_ACTION = 120;
const MAX_A11Y_NOTE = 280;

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
 * `manifest.schema.json`: a non-empty `reason` (≤140 chars), an optional
 * kebab-case `alternative` (≤64 chars), and no unknown keys. A malformed payload
 * that the schema would reject — including one that overflows a `maxLength` —
 * must not slip through here.
 */
export function isAvoidWhenArray(value: unknown): value is AvoidWhenEntry[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!isObject(entry)) return false;
      if (!hasOnlyKeys(entry, ['reason', 'alternative'])) return false;
      const alternative = entry['alternative'];
      return (
        isBoundedString(entry['reason'], MAX_AVOID_REASON) &&
        (alternative === undefined ||
          (typeof alternative === 'string' &&
            alternative.length <= MAX_AVOID_ALTERNATIVE &&
            KEBAB_ID.test(alternative)))
      );
    })
  );
}

/**
 * Type guard: is `value` shaped like {@link A11yMetadata} (all fields optional)?
 *
 * As with {@link isAvoidWhenArray}, this validates untrusted JSON against the
 * manifest schema's invariants: non-empty `pattern` (≤80 chars), keyboard
 * entries with non-empty `keys`/`action` (≤120 chars each, no extra keys),
 * non-empty `notes` (≤280 chars each), and no unknown top-level keys. Payloads
 * that overflow a `maxLength` are rejected so the runtime guard matches the
 * published schema.
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
          isBoundedString(entry['keys'], MAX_A11Y_KEY) &&
          isBoundedString(entry['action'], MAX_A11Y_ACTION),
      ));
  return (
    (pattern === undefined || isBoundedString(pattern, MAX_A11Y_PATTERN)) &&
    keyboardOk &&
    (notes === undefined || isBoundedStringArray(notes, MAX_A11Y_NOTE))
  );
}
