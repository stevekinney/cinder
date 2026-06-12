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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** Type guard: is `value` an array of `{ reason, alternative? }` entries? */
export function isAvoidWhenArray(value: unknown): value is AvoidWhenEntry[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!isObject(entry)) return false;
      const alternative = entry['alternative'];
      return (
        typeof entry['reason'] === 'string' &&
        (alternative === undefined || typeof alternative === 'string')
      );
    })
  );
}

/** Type guard: is `value` shaped like {@link A11yMetadata} (all fields optional)? */
export function isA11yMetadata(value: unknown): value is A11yMetadata {
  if (!isObject(value)) return false;
  const pattern = value['pattern'];
  const keyboard = value['keyboard'];
  const notes = value['notes'];
  const keyboardOk =
    keyboard === undefined ||
    (Array.isArray(keyboard) &&
      keyboard.every(
        (entry) =>
          isObject(entry) &&
          typeof entry['keys'] === 'string' &&
          typeof entry['action'] === 'string',
      ));
  return (
    (pattern === undefined || typeof pattern === 'string') &&
    keyboardOk &&
    (notes === undefined || isStringArray(notes))
  );
}
