<script lang="ts" module>
  export type { CalloutProps, CalloutVariant } from './callout.types.ts';
</script>

<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  import { classNames } from '../../utilities/class-names.ts';
  import type { CalloutProps } from './callout.types.ts';

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
