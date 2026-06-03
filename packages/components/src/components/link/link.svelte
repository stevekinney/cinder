<script lang="ts" module>
  /**
   * @cinder
   * @category typography
   * @status beta
   * @purpose Inline text link with consistent focus ring and underline behavior.
   * @tag typography
   * @tag link
   * @useWhen Embedding a navigable link inside body text or prose content.
   * @avoidWhen Navigating between pages in a sidebar or nav bar — use NavigationItem.
   * @related navigation-item, button, breadcrumbs
   */
  export type { LinkProps, LinkColor, LinkUnderline } from './link.types.ts';
</script>

<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  import { classNames } from '../../utilities/class-names.ts';
  import type { LinkProps } from './link.types.ts';

  let {
    href,
    underline = 'hover',
    color = 'primary',
    external = false,
    disabled = false,
    target,
    rel,
    // Pulled out of `rest` so a consumer-supplied tabindex never lands on the disabled
    // <span> (which would make a "disabled" link focusable). Applied only to the enabled <a>.
    tabindex,
    class: className,
    children,
    ...rest
  }: LinkProps = $props();

  // The disabled branch renders a <span>. The per-branch cast mirrors the pattern
  // used in navigation-item.svelte (anchorAttributes / buttonAttributes): once the
  // template discriminant has chosen the element, this cast is safe and keeps
  // svelte-check clean by matching the element's expected attribute type.
  const spanAttributes = $derived(
    rest as Omit<HTMLAttributes<HTMLSpanElement>, 'class' | 'aria-disabled'>,
  );

  // Consumer target takes precedence; `external` only supplies "_blank" when the consumer
  // did not pass a target.
  const resolvedTarget = $derived(disabled ? undefined : external && !target ? '_blank' : target);

  // Merge "noopener noreferrer" into rel whenever the link opens in a NEW TAB —
  // either via `external` or any resolved target of "_blank" (case-insensitively, since
  // HTML target keywords are case-insensitive) — so a `target="_blank"` passed without
  // `external` can't open a reverse-tabnabbing window. The whole rel is de-duplicated
  // case-insensitively: a consumer rel of "noopener noopener" or "NoOpener" collapses to
  // a single token and the safe tokens aren't re-added.
  const resolvedRel = $derived.by(() => {
    if (disabled) return undefined;
    const needsSafeRel = external || resolvedTarget?.toLowerCase() === '_blank';
    const consumerParts = (rel ?? '').split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    const merged: string[] = [];
    // De-dupe consumer-provided tokens too (keep first occurrence, original casing).
    for (const part of consumerParts) {
      const key = part.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(part);
      }
    }
    if (needsSafeRel) {
      for (const part of ['noopener', 'noreferrer']) {
        if (!seen.has(part)) {
          seen.add(part);
          merged.push(part);
        }
      }
    }
    return merged.length > 0 ? merged.join(' ') : undefined;
  });

  const resolvedClass = $derived(classNames('cinder-link', className));
</script>

{#if disabled}
  <!--
    Disabled link: rendered as <span> with aria-disabled="true" so assistive technology
    understands the element is not interactive. The href is intentionally withheld — a
    disabled link in prose represents content the user cannot access right now.
  -->
  <span
    {...spanAttributes}
    class={resolvedClass}
    aria-disabled="true"
    data-cinder-link
    data-underline={underline}
    data-color={color}
    data-disabled
  >
    {@render children()}
  </span>
{:else}
  <a
    {...rest}
    {href}
    {tabindex}
    target={resolvedTarget}
    rel={resolvedRel}
    class={resolvedClass}
    data-cinder-link
    data-underline={underline}
    data-color={color}
  >
    {@render children()}
  </a>
{/if}
