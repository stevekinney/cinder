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

  // Merge external-derived values with consumer-supplied values.
  // Consumer target takes precedence; external only supplies "_blank" when the consumer
  // did not pass a target. For rel, "noopener noreferrer" is always appended when external
  // is true so the security guarantee is not accidentally stripped by a consumer rel.
  const resolvedTarget = $derived(disabled ? undefined : external && !target ? '_blank' : target);

  const resolvedRel = $derived.by(() => {
    if (disabled) return undefined;
    if (!external) return rel ?? undefined;
    const externalRel = 'noopener noreferrer';
    if (!rel) return externalRel;
    // Avoid duplicating rel values that the consumer already supplied.
    const existingParts = rel.split(/\s+/).filter(Boolean);
    const missing = externalRel.split(/\s+/).filter((part) => !existingParts.includes(part));
    return missing.length > 0 ? `${rel} ${missing.join(' ')}` : rel;
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
