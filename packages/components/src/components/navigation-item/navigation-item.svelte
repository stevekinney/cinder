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
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  import { classNames } from '../../utilities/class-names.ts';
  import type { NavigationItemProps } from './navigation-item.types.ts';

  // `href` and `onclick` are destructured explicitly because they drive the link-vs-button
  // discriminant and are handled by the internal `handleClick` wrapper.
  // `...rest` carries remaining native HTML attributes to the underlying element.
  // The per-branch `$derived` casts (anchorAttributes / buttonAttributes) are safe because
  // the template `{#if isLink}` discriminant has already chosen the correct element —
  // this mirrors the pattern used in button.svelte for the same reason.
  const {
    active,
    disabled,
    variant,
    class: customClassName,
    children,
    onclick,
    href,
    // `tabindex` is pulled out so a disabled item can force -1 (removed from the tab
    // order) while still honoring a consumer-supplied value on an enabled item.
    tabindex,
    ...rest
  }: NavigationItemProps = $props();

  const isLink = $derived(href !== undefined);

  const resolvedClass = $derived(classNames('cinder-navigation-item', customClassName));
  const isActive = $derived(active ?? false);
  const isDisabled = $derived(disabled ?? false);
  const resolvedVariant = $derived(variant ?? 'horizontal');
  // Disabled forces tabindex=-1; otherwise the consumer's value (or undefined) is kept.
  const resolvedTabindex = $derived(isDisabled ? -1 : tabindex);

  const anchorAttributes = $derived(
    rest as Omit<HTMLAnchorAttributes, 'class' | 'href' | 'onclick' | 'tabindex'>,
  );
  const buttonAttributes = $derived(
    rest as Omit<HTMLButtonAttributes, 'class' | 'onclick' | 'disabled' | 'tabindex'>,
  );

  function handleClick(event: MouseEvent): void {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    // Forward to the consumer's onclick if one was provided. The optional call is
    // important for both arms: a link forwards so the consumer can manage SPA
    // navigation (and let modified/middle clicks fall through to the browser), and
    // the button arm must not crash when `href={someUndefinedValue}` routes a
    // consumer into the button branch without supplying an onclick.
    (onclick as ((event: MouseEvent) => void) | undefined)?.(event);
  }
</script>

{#if isLink}
  <!--
    Disabled anchor: href is stripped (not just aria-disabled) so the element
    loses its link role and is removed from the tab order entirely. This is a
    deliberate product decision — a disabled navigation link represents a route
    the user cannot access, and hiding it from the links list (screen reader
    VO+U / NVDA Insert+F7) is preferable to a greyed-out unreachable destination.
    NavigationItem owns this behavior: href/tabindex/aria-disabled are derived
    from the `disabled` prop, not passed through, so there is no escape hatch to
    keep a disabled link discoverable. If your use case needs that, render a
    plain <a aria-disabled> yourself instead of a disabled NavigationItem.
  -->
  <a
    {...anchorAttributes}
    href={isDisabled ? undefined : href}
    aria-current={isActive ? 'page' : undefined}
    aria-disabled={isDisabled ? true : undefined}
    tabindex={resolvedTabindex}
    data-active={isActive}
    data-cinder-navigation-item
    data-variant={resolvedVariant}
    onclick={handleClick}
    class={resolvedClass}
  >
    {@render children()}
  </a>
{:else}
  <button
    {...buttonAttributes}
    type="button"
    aria-current={isActive ? 'page' : undefined}
    aria-disabled={isDisabled ? true : undefined}
    disabled={isDisabled}
    tabindex={resolvedTabindex}
    data-active={isActive}
    data-cinder-navigation-item
    data-variant={resolvedVariant}
    onclick={handleClick}
    class={resolvedClass}
  >
    {@render children()}
  </button>
{/if}
