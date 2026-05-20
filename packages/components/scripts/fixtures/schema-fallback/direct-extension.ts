/**
 * Fixture: a component whose props directly extend `HTMLButtonAttributes`.
 *
 * Expected schema after fallback filtering: only the locally-declared cinder
 * props (`variant`, `class`) appear — none of the inherited HTML attribute
 * surface (`aria-*`, `on*`, `id`, `name`, etc.).
 */
import type { HTMLButtonAttributes } from 'svelte/elements';

export type DirectExtensionVariant = 'primary' | 'secondary';

export type DirectExtensionProps = HTMLButtonAttributes & {
  /** Visual variant. */
  variant?: DirectExtensionVariant;
};
