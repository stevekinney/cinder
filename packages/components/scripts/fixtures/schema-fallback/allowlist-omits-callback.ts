/**
 * Fixture: `<Name>Props` carries function/snippet props that the curated
 * `<Name>SchemaProps` allowlist deliberately omits — the PricingCard pattern.
 *
 * Because a focused `AllowlistOmitsCallbackSchemaProps` allowlist exists, the
 * generator's main loop only walks the allowlist. Without the post-loop scan,
 * the omitted function/snippet props would vanish from both the schema and the
 * generated README. The scan must record exactly those, with faithful
 * required-ness + authored descriptions, while leaving alone:
 *   - props the allowlist keeps (`label` — a normal schema property),
 *   - an EXPRESSIBLE prop the allowlist curated out (`badge` — JSON Schema CAN
 *     represent it, so the author's omission stands; it must NOT be recorded),
 *   - inherited svelte/elements attributes (`onclick`, aria-*, etc.).
 *
 * `onselect` is removed from the inherited HTML attributes via `Omit` and
 * re-declared locally as a required `() => void`, exercising the shadowed-handler
 * path (the symbol's only declaration is local, so it is NOT filtered as
 * inherited). `ondismiss` covers the optional callback; `footer` covers the
 * snippet path; `badge` covers the expressible-but-omitted negative case.
 */
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

export type AllowlistOmitsCallbackProps = Omit<HTMLButtonAttributes, 'onselect'> & {
  /** Accessible label for the control. */
  label: string;
  /** Optional badge count rendered beside the label. */
  badge?: number;
  /** Fired when the option is selected. */
  onselect: () => void;
  /** Optional teardown callback. */
  ondismiss?: () => void;
  /** Snippet rendered in the card footer. */
  footer?: Snippet;
};

export type AllowlistOmitsCallbackSchemaProps = {
  label: string;
};
