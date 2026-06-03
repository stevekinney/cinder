<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Single wayfinding item that renders as an anchor when given href or as a button when given onclick, with active-state aria-current.
   * @tag navigation
   * @tag link
   * @useWhen Rendering one entry in a navigation bar, sidebar, or side-navigation group.
   * @useWhen Switching the active view or section while signalling current location via aria-current.
   * @avoidWhen Showing a hierarchical trail of ancestors — use breadcrumbs instead.
   * @avoidWhen Triggering a generic action unrelated to navigation — use button instead.
   * @related navigation-bar, side-navigation-item, breadcrumbs, tab
   */
  export type { NavigationItemProps } from './navigation-item.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { LinkArm, NavigationItemProps } from './navigation-item.types.ts';

  const props: NavigationItemProps = $props();

  const isLink = $derived('href' in props);

  const resolvedClass = $derived(classNames('cinder-navigation-item', props.class));
  const active = $derived(props.active ?? false);
  const disabled = $derived(props.disabled ?? false);
  const variant = $derived(props.variant ?? 'horizontal');

  function handleClick(event: MouseEvent): void {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (isLink) {
      // Link arm: forward to consumer onclick if provided. The consumer
      // decides whether to preventDefault — useful for SPA navigation that
      // wants modified clicks (cmd/ctrl/shift/alt, middle-click) to fall
      // through to native browser behavior.
      const linkOnclick = (props as LinkArm).onclick;
      linkOnclick?.(event);
      return;
    }
    (props as { onclick: (event: MouseEvent) => void }).onclick(event);
  }
</script>

{#if isLink}
  <!--
    Disabled anchor: href is stripped (not just aria-disabled) so the element
    loses its link role and is removed from the tab order entirely. This is a
    deliberate product decision — a disabled navigation link represents a route
    the user cannot access, and hiding it from the links list (screen reader
    VO+U / NVDA Insert+F7) is preferable to a greyed-out unreachable destination.
    If you need the link to remain discoverable as a named link in AT, set
    `aria-disabled` but keep `href` — the click is still blocked by handleClick.
  -->
  <a
    href={disabled ? undefined : (props as LinkArm).href}
    class={resolvedClass}
    aria-current={active ? 'page' : undefined}
    aria-disabled={disabled ? true : undefined}
    tabindex={disabled ? -1 : undefined}
    data-active={active}
    data-cinder-navigation-item
    data-variant={variant}
    onclick={handleClick}
  >
    {@render props.children()}
  </a>
{:else}
  <button
    type="button"
    class={resolvedClass}
    aria-current={active ? 'page' : undefined}
    aria-disabled={disabled ? true : undefined}
    {disabled}
    data-active={active}
    data-cinder-navigation-item
    data-variant={variant}
    onclick={handleClick}
  >
    {@render props.children()}
  </button>
{/if}
