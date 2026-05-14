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
   * (note / tip / warning / danger). Do not pass `role="alert"` or
   * `aria-live` — both are excluded from the prop type.
   */
  export type CalloutProps = Omit<
    HTMLAttributes<HTMLElement>,
    'children' | 'class' | 'role' | 'aria-live'
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

  // Strip live-region attributes from rest props. Callout is static
  // content by design; allowing a consumer to bolt on `aria-live` would
  // silently convert it into a live region and defeat the distinction
  // documented above. Consumers that need announcements should use
  // `alert.svelte` instead.
  const restWithoutLiveRegion = $derived.by(() => {
    const {
      'aria-live': _ariaLive,
      'aria-atomic': _ariaAtomic,
      'aria-relevant': _ariaRelevant,
      ...filtered
    } = rest as HTMLAttributes<HTMLElement> & Record<string, unknown>;
    return filtered;
  });
</script>

<aside
  {...restWithoutLiveRegion}
  class={classNames('cinder-callout', className)}
  data-cinder-variant={variant}
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
