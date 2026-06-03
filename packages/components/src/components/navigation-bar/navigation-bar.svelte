<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Top-level application header that pairs a brand mark with a horizontal set of navigation items and an optional mobile menu toggle.
   * @tag navigation
   * @tag chrome
   * @useWhen Anchoring an app shell with primary sections, branding, and account actions across the top edge.
   * @useWhen Providing a responsive nav that collapses items behind a menu toggle below a breakpoint.
   * @avoidWhen Showing the ancestor trail of the current page — use breadcrumbs instead.
   * @avoidWhen Building a tall, dense sidebar of grouped sections — use side-navigation instead.
   * @related navigation-item, breadcrumbs, side-navigation
   */
  export type {
    NavigationBarItemsContext,
    NavigationBarProps,
    NavigationBarToggleAttributes,
    NavigationVariant,
  } from './navigation-bar.types.ts';
</script>

<script lang="ts">
  import type { NavigationBarProps, NavigationVariant } from './navigation-bar.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  const regionId = $props.id();

  let {
    class: className,
    brand,
    items,
    actions,
    menuToggle,
    mobileMenuOpen = $bindable(false),
    navAriaLabel = 'Main navigation',
    // Strip these from rest so they cannot collide with internal attributes.
    'aria-label': _ariaLabel,
    'data-collapsible': _dataCollapsible,
    onkeydown: consumerOnKeyDown,
    ...rest
  }: NavigationBarProps = $props();
  const navigationItemSelector = '[data-cinder-navigation-item]';

  const variant: NavigationVariant = $derived(
    menuToggle !== undefined && mobileMenuOpen ? 'mobile' : 'horizontal',
  );

  // Stores the toggle element for focus return after Escape-close.
  let toggleElement: HTMLElement | null = null;
  let itemsRegionElement: HTMLDivElement | null = null;

  function handleToggle(event: MouseEvent): void {
    mobileMenuOpen = !mobileMenuOpen;
    toggleElement = event.currentTarget as HTMLElement | null;
  }

  function getNavigationItems(): HTMLElement[] {
    if (!itemsRegionElement) return [];

    return Array.from(itemsRegionElement.querySelectorAll<HTMLElement>(navigationItemSelector));
  }

  function isEnabledNavigationItem(item: HTMLElement): boolean {
    return item.getAttribute('aria-disabled') !== 'true' && !item.hasAttribute('disabled');
  }

  function getEventNavigationItem(event: KeyboardEvent): HTMLElement | null {
    if (!(event.target instanceof HTMLElement) || !itemsRegionElement) return null;

    const navigationItem = event.target.closest<HTMLElement>(navigationItemSelector);
    if (!navigationItem || !itemsRegionElement.contains(navigationItem)) return null;
    if (navigationItem !== event.target) return null;

    return navigationItem;
  }

  function focusAdjacentNavigationItem(currentItem: HTMLElement, direction: -1 | 1): void {
    const items = getNavigationItems();
    if (items.length === 0) return;

    const currentIndex = items.indexOf(currentItem);
    if (currentIndex === -1) return;

    for (let step = 1; step < items.length; step++) {
      const nextIndex = (currentIndex + direction * step + items.length) % items.length;
      const nextItem = items[nextIndex];
      if (nextItem && isEnabledNavigationItem(nextItem)) {
        nextItem.focus();
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    // Consumer handler runs first; if it cancels, skip the internal close.
    if (consumerOnKeyDown) {
      (consumerOnKeyDown as (e: KeyboardEvent) => void)(event);
    }
    if (event.defaultPrevented) return;

    if (event.key === 'Escape' && mobileMenuOpen) {
      mobileMenuOpen = false;
      // Return focus synchronously — toggleElement is captured on each click.
      toggleElement?.focus();
      return;
    }

    const navigationItem = getEventNavigationItem(event);
    if (!navigationItem) return;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      focusAdjacentNavigationItem(navigationItem, event.key === 'ArrowRight' ? 1 : -1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (isEnabledNavigationItem(navigationItem)) {
        navigationItem.click();
      }
    }
  }
</script>

<nav
  {...rest}
  aria-label={navAriaLabel}
  class={cn('cinder-navigation-bar', className)}
  data-collapsible={menuToggle !== undefined ? 'true' : 'false'}
  onkeydown={handleKeyDown}
>
  {#if brand}
    <div class="cinder-navigation-bar__brand">
      {@render brand()}
    </div>
  {/if}

  {#if menuToggle}
    <div class="cinder-navigation-bar__menu-toggle">
      {@render menuToggle({
        'aria-expanded': (mobileMenuOpen ? 'true' : 'false') as 'true' | 'false',
        'aria-controls': regionId,
        onclick: handleToggle,
      })}
    </div>
  {/if}

  <div
    bind:this={itemsRegionElement}
    id={regionId}
    class="cinder-navigation-bar__items"
    data-open={mobileMenuOpen ? 'true' : 'false'}
  >
    {@render items({ variant })}
  </div>

  {#if actions}
    <div class="cinder-navigation-bar__actions">
      {@render actions()}
    </div>
  {/if}
</nav>
