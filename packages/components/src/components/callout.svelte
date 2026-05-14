<script lang="ts" module>
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
   * Props for the {@link Callout} component — an inline admonition block
   * for documentation and long-form content.
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
   * (note / tip / warning / danger). The type omits `role`, `aria-live`,
   * `aria-atomic`, `aria-relevant`, and `aria-busy` from the underlying
   * `HTMLAttributes` so a consumer cannot silently turn a callout into a
   * live region. The runtime also scrubs those attributes from rest
   * props for defense in depth — see banner.svelte for the analogous
   * pattern.
   *
   * The root is `<aside>`. When placed directly inside `<body>`,
   * `<main>`, or another sectioning landmark, `<aside>` is exposed as a
   * `complementary` landmark; inside `<article>` or `<section>` the
   * landmark role is suppressed and the element behaves as generic
   * sectioning content. When the callout lands at landmark level, supply
   * `title` (used as the accessible name) or pass `aria-label` /
   * `aria-labelledby` so the landmark has a meaningful name.
   */
  export type CalloutProps = Omit<
    HTMLAttributes<HTMLElement>,
    'children' | 'class' | 'role' | 'aria-live' | 'aria-atomic' | 'aria-relevant' | 'aria-busy'
  > & {
    /** Visual + semantic variant. Default `'info'`. */
    variant?: CalloutVariant;
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
     * root `<aside>` so the landmark has an accessible name.
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
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    variant = 'info',
    title,
    icon,
    class: className,
    children,
    ...rest
  }: CalloutProps = $props();

  // Strip role + live-region attributes from rest props. The type
  // already omits these, but a consumer can escape the type system
  // (`as never`, spread from an `unknown` source). Scrubbing at runtime
  // guarantees the hard invariant that a callout is never announced as
  // a live region and never overrides the implicit `<aside>` role.
  // Mirrors banner.svelte's defense-in-depth pattern.
  const restWithoutForbidden = $derived.by(() => {
    const {
      role: _role,
      'aria-live': _ariaLive,
      'aria-atomic': _ariaAtomic,
      'aria-relevant': _ariaRelevant,
      'aria-busy': _ariaBusy,
      ...filtered
    } = rest as HTMLAttributes<HTMLElement> & Record<string, unknown>;
    return filtered;
  });

  // Derive an accessible name for the root `<aside>` so a callout that
  // lands at landmark level (direct child of body / main / etc.) is not
  // an unnamed `complementary` landmark — WCAG 2.4.1. Priority mirrors
  // banner.svelte: consumer `aria-labelledby` > consumer `aria-label` >
  // `title`. When none of the three is supplied, the landmark is
  // unnamed, which is the right behavior for a callout nested inside
  // an <article> or <section> where it carries no landmark role anyway.
  const ariaLabel = $derived(rest['aria-labelledby'] ? undefined : (rest['aria-label'] ?? title));
</script>

<aside
  {...restWithoutForbidden}
  class={classNames('cinder-callout', className)}
  data-cinder-variant={variant}
  aria-label={ariaLabel}
>
  {#if icon}
    <div class="cinder-callout__icon" aria-hidden="true">
      {@render icon()}
    </div>
  {/if}

  <div class="cinder-callout__content">
    {#if title}
      <p class="cinder-callout__title">{title}</p>
    {/if}
    {@render children()}
  </div>
</aside>
