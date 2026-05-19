<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type NavigationVariant = 'horizontal' | 'mobile';

  /** Attributes injected into the consumer's toggle button via the menuToggle snippet parameter. */
  export type NavigationBarToggleAttributes = {
    'aria-expanded': 'true' | 'false';
    'aria-controls': string;
    onclick: (event: MouseEvent) => void;
  };

  /** Context passed to the items snippet so items can adapt their layout. */
  export type NavigationBarItemsContext = {
    variant: NavigationVariant;
  };

  export type NavigationBarProps = HTMLAttributes<HTMLElement> & {
    class?: string;
    brand?: Snippet;
    /** Receives a context object with the current variant. */
    items: Snippet<[NavigationBarItemsContext]>;
    actions?: Snippet;
    /** Snippet receiving toggle button attributes. Consumer renders the actual <button>. */
    menuToggle?: Snippet<[NavigationBarToggleAttributes]>;
    /** Two-way bindable open state of the mobile menu. */
    mobileMenuOpen?: boolean;
    /** Accessible name for the <nav> landmark. Wins over any aria-label passed via rest. Default 'Main navigation'. */
    navAriaLabel?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';
  import { useId } from '../utilities/use-id.ts';

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

  const regionId = useId('cinder-navigation-bar');
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
    const items = getNavigationItems().filter(isEnabledNavigationItem);
    if (items.length === 0) return;

    const currentIndex = items.indexOf(currentItem);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + direction + items.length) % items.length;

    items[nextIndex]?.focus();
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
