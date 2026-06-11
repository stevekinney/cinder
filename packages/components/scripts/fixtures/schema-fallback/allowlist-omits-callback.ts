/**
 * Fixture: `<Name>Props` carries a required callback that the curated
 * `<Name>SchemaProps` allowlist deliberately omits — the PricingCard pattern.
 *
 * `onselect` is removed from the inherited HTML attributes via `Omit` and
 * re-declared locally as a required `() => void`. Because a focused
 * `AllowlistOmitsCallbackSchemaProps` allowlist exists, the generator's main
 * loop only walks the allowlist (which omits `onselect`), so without the
 * post-loop callback scan the required `onselect` would vanish from both the
 * schema and the generated README. The scan must record it in
 * `unsupportedProps` with `reason: 'function-or-snippet'`, `required: true`,
 * and its authored description — while NOT recording the expressible `label`
 * the allowlist intentionally curated out, nor the inherited `onclick`.
 */
import type { HTMLButtonAttributes } from 'svelte/elements';

export type AllowlistOmitsCallbackProps = Omit<HTMLButtonAttributes, 'onselect'> & {
  /** Accessible label for the control. */
  label: string;
  /** Fired when the option is selected. */
  onselect: () => void;
  /** Optional teardown callback. */
  ondismiss?: () => void;
};

export type AllowlistOmitsCallbackSchemaProps = {
  label: string;
};
