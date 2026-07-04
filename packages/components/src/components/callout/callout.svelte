<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Inline static note or aside that highlights supporting commentary alongside body content without claiming live-region urgency.
   * @tag feedback
   * @tag notice
   * @useWhen Drawing attention to tangential information nested inside prose, documentation, or article content.
   * @useWhen Calling out a tip, note, or caveat that belongs next to the content it qualifies.
   * @avoidWhen Announcing a transient or urgent status — use alert or banner instead.
   * @avoidWhen Communicating a page-wide system message — use banner so it reads as a landmark region.
   * @related alert, banner
   */
  export type { CalloutProps, CalloutSemantic, CalloutVariant } from './callout.types.ts';
</script>

<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  import { classNames } from '../../utilities/class-names.ts';
  import type { CalloutProps } from './callout.types.ts';

  let {
    variant = 'info',
    semantic = 'aside',
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
  // a live region and never overrides the component-owned root role.
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

  // Derive an accessible name for the root so an aside callout that lands at
  // landmark level is not an unnamed `complementary` landmark, and a note mode
  // callout has the expected note name. Priority mirrors banner.svelte:
  // consumer `aria-labelledby` > consumer `aria-label` > `title`.
  const ariaLabel = $derived(rest['aria-labelledby'] ? undefined : (rest['aria-label'] ?? title));
</script>

{#if semantic === 'note'}
  <div
    {...restWithoutForbidden}
    class={classNames(
      'cinder-callout',
      'cinder-_status-surface',
      'cinder-_status-surface-border',
      'cinder-_status-surface-stripe',
      className,
    )}
    data-cinder-variant={variant}
    role="note"
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
  </div>
{:else}
  <aside
    {...restWithoutForbidden}
    class={classNames(
      'cinder-callout',
      'cinder-_status-surface',
      'cinder-_status-surface-border',
      'cinder-_status-surface-stripe',
      className,
    )}
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
{/if}
