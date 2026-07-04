import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/**
 * Visual + semantic variants for {@link Callout}.
 *
 * Matches `banner.svelte` so both components draw from the same semantic
 * tokens (`--cinder-info`, `--cinder-success`, `--cinder-warning`,
 * `--cinder-danger`). `alert.svelte` uses `error` instead of `danger`;
 * that divergence is tracked in `banner.a11y.md`.
 */
export type CalloutVariant = 'info' | 'success' | 'warning' | 'danger';
/**
 * Root semantics for {@link Callout}.
 *
 * - `'aside'` keeps the historical `<aside>` behavior and may expose a
 *   `complementary` landmark depending on where the callout is placed.
 * - `'note'` renders a static `<div role="note">` for explanatory notes that
 *   should not appear in landmark navigation.
 */
export type CalloutSemantic = 'aside' | 'note';
/**
 * Props for the {@link Callout} component — an inline admonition block
 * for documentation and long-form content. See `callout.a11y.md` for
 * the full accessibility model.
 *
 * Callout is the static, prose-embedded sibling of:
 *
 * - `banner.svelte` — page-level, dismissible, `role="region"` landmark.
 * - `alert.svelte` — dynamic notification with `role="alert"` that
 *   announces to assistive tech when it appears or updates. Use that
 *   component when the message is added to the page in response to a
 *   user action and screen-reader users need to be notified.
 *
 * Callout is intentionally **not** a live region. It is static content
 * rendered as part of the document, analogous to Markdown admonitions
 * (note / tip / warning / danger). Use `semantic="note"` when the visual
 * surface should expose `role="note"` instead of an `<aside>`. The type omits
 * `role`, `aria-live`, `aria-atomic`, `aria-relevant`, and `aria-busy` from
 * the underlying `HTMLAttributes` so a consumer cannot silently turn a
 * callout into an alert/status live region or arbitrary landmark. The runtime
 * also scrubs those attributes from rest props for defense in depth — see
 * banner.svelte for the analogous pattern.
 *
 * The default root is `<aside>`. When placed directly inside `<body>`,
 * `<main>`, or another sectioning landmark, `<aside>` is exposed as a
 * `complementary` landmark; inside `<article>` or `<section>` the landmark
 * role is suppressed and the element behaves as generic sectioning content.
 * When the callout lands at landmark level, supply `title` (used as the
 * accessible name) or pass `aria-label` / `aria-labelledby` so the landmark
 * has a meaningful name.
 */
export type CalloutProps = Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'class' | 'role' | 'aria-live' | 'aria-atomic' | 'aria-relevant' | 'aria-busy'
> & {
  /** Visual + semantic variant. Default `'info'`. */
  variant?: CalloutVariant;
  /** Root semantics. Default `'aside'`; use `'note'` for static note semantics without a complementary landmark. */
  semantic?: CalloutSemantic;
  /**
   * Optional title rendered as a `<p class="cinder-callout__title">`.
   *
   * Rendered as a paragraph rather than a heading element so the
   * callout does not inject an entry into the document outline. If a
   * callout genuinely participates in the outline (e.g. it titles a
   * standalone section), wrap it in a `<section>` with its own heading
   * rather than promoting this prop to `<h*>`.
   *
   * When supplied and no `aria-label` or `aria-labelledby` is passed
   * on rest props, the title also becomes the `aria-label` of the
   * root element so the landmark or note has an accessible name.
   */
  title?: string;
  /**
   * Optional decorative icon rendered inside an `aria-hidden` wrapper.
   *
   * The icon is a second visual channel alongside variant color — it
   * helps satisfy WCAG 1.4.1 (Use of Color) by ensuring the variant is
   * conveyed by more than color alone. The accessible meaning still
   * lives in `title` and/or `children`; the icon must not be the only
   * carrier of information.
   */
  icon?: Snippet;
  /** Callout body content. */
  children: Snippet;
  /**
   * Extra classes appended to the root element. Pass via the explicit
   * `class` prop — it is excluded from rest-prop spread, so writing
   * `class="x"` inside spread attributes will not reach the root.
   */
  class?: string;
};
