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
    NavigationBarLabelVisibility,
    NavigationBarItemsContext,
    NavigationBarMenuTogglePlacement,
    NavigationBarPlacement,
    NavigationBarProps,
    NavigationBarToggleAttributes,
    NavigationVariant,
  } from './navigation-bar.types.ts';
</script>

<script lang="ts">
  import type { NavigationBarProps, NavigationVariant } from './navigation-bar.types.ts';
  import { BROWSER as browser } from 'esm-env';
  import { classNames } from '../../utilities/class-names.ts';

  const COLLAPSIBLE_MAX_WIDTH_REM = 47.99;
  const FALLBACK_ROOT_FONT_SIZE_PX = 16;
  const regionId = $props.id();

  let {
    class: className,
    placement = 'top',
    showLabels = 'always',
    menuTogglePlacement = 'after-brand',
    brand,
    items,
    actions,
    menuToggle,
    mobileMenuOpen = $bindable(false),
    label = 'Main navigation',
    // Strip these from rest so they cannot collide with internal attributes.
    'aria-label': _ariaLabel,
    'data-collapsible': _dataCollapsible,
    'data-cinder-placement': _dataCinderPlacement,
    'data-cinder-label-visibility': _dataCinderLabelVisibility,
    'data-cinder-menu-toggle-placement': _dataCinderMenuTogglePlacement,
    onclick: consumerOnClick,
    onkeydown: consumerOnKeyDown,
    ...rest
  }: NavigationBarProps = $props();
  const navigationItemSelector = '[data-cinder-navigation-item]';

  const isCollapsible = $derived(placement === 'top' && menuToggle !== undefined);
  let isMobileLayout = $state(false);

  const variant: NavigationVariant = $derived(
    placement === 'bottom'
      ? 'mobile'
      : isCollapsible && isMobileLayout && mobileMenuOpen
        ? 'mobile'
        : 'horizontal',
  );

  // Stores the toggle element for focus return after Escape-close.
  let navigationBarElement: HTMLElement | null = null;
  let toggleElement: HTMLElement | null = null;
  let itemsRegionElement: HTMLDivElement | null = null;

  function getCollapsibleMaxWidthPx(): number {
    if (typeof window === 'undefined') {
      return COLLAPSIBLE_MAX_WIDTH_REM * FALLBACK_ROOT_FONT_SIZE_PX;
    }

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const baseFontSize =
      Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : FALLBACK_ROOT_FONT_SIZE_PX;
    return COLLAPSIBLE_MAX_WIDTH_REM * baseFontSize;
  }

  function updateMobileLayout(width: number): void {
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    isMobileLayout = width <= getCollapsibleMaxWidthPx();
  }

  $effect(() => {
    if (!isCollapsible || !navigationBarElement) {
      isMobileLayout = false;
      return;
    }

    if (typeof ResizeObserver === 'undefined') {
      // Fallback: use border-box width if ResizeObserver unavailable
      const initialWidth = navigationBarElement.getBoundingClientRect().width;
      updateMobileLayout(initialWidth);
      return;
    }

    // Use ResizeObserver to track content-box width, which aligns with CSS container queries.
    // Don't read initial width synchronously; let observer fire immediately on observe().
    let hasInitialMeasurement = false;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      updateMobileLayout(entry.contentRect.width);
      hasInitialMeasurement = true;
    });

    observer.observe(navigationBarElement);

    // If observer doesn't fire synchronously (edge case), set a fallback after a microtask.
    // In modern browsers, observe() triggers callback synchronously on the same tick.
    if (!hasInitialMeasurement) {
      Promise.resolve().then(() => {
        if (!hasInitialMeasurement) {
          // Fallback: measure once more using contentRect-like calculation
          const rect = navigationBarElement?.getBoundingClientRect();
          const styles = navigationBarElement ? getComputedStyle(navigationBarElement) : null;
          if (rect && styles) {
            const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
            const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
            const contentWidth = rect.width - paddingLeft - paddingRight;
            updateMobileLayout(contentWidth);
            hasInitialMeasurement = true;
          }
        }
      });
    }

    return () => {
      observer.disconnect();
    };
  });

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

  function getEventNavigationItem(event: Event): HTMLElement | null {
    if (!(event.target instanceof HTMLElement) || !itemsRegionElement) return null;

    const navigationItem = event.target.closest<HTMLElement>(navigationItemSelector);
    if (!navigationItem || !itemsRegionElement.contains(navigationItem)) return null;

    return navigationItem;
  }

  function isModifiedClick(event: MouseEvent): boolean {
    return event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  }

  function opensOutsideCurrentPage(item: HTMLElement): boolean {
    if (!(item instanceof HTMLAnchorElement)) return false;

    const target = item.getAttribute('target');
    return (
      item.hasAttribute('download') ||
      (target !== null && target.trim() !== '' && target.trim().toLowerCase() !== '_self')
    );
  }

  function canCloseAfterItemActivation(item: HTMLElement, event: MouseEvent): boolean {
    return (
      isCollapsible &&
      isMobileLayout &&
      mobileMenuOpen &&
      isEnabledNavigationItem(item) &&
      !isModifiedClick(event) &&
      !opensOutsideCurrentPage(item)
    );
  }

  function handleClick(event: MouseEvent): void {
    if (consumerOnClick) {
      (consumerOnClick as (e: MouseEvent) => void)(event);
    }

    const navigationItem = getEventNavigationItem(event);
    if (!navigationItem || !canCloseAfterItemActivation(navigationItem, event)) return;

    mobileMenuOpen = false;
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

    if (event.key === 'Escape' && isCollapsible && isMobileLayout && mobileMenuOpen) {
      mobileMenuOpen = false;
      // Return focus synchronously — toggleElement is captured on each click.
      toggleElement?.focus();
      return;
    }

    const navigationItem = getEventNavigationItem(event);
    if (!navigationItem || navigationItem !== event.target) return;

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
  bind:this={navigationBarElement}
  aria-label={label}
  class={classNames('cinder-navigation-bar', className)}
  data-collapsible={isCollapsible ? 'true' : 'false'}
  data-cinder-placement={placement}
  data-cinder-label-visibility={showLabels}
  data-cinder-menu-toggle-placement={menuTogglePlacement}
  onclick={handleClick}
  onkeydown={handleKeyDown}
>
  {#if isCollapsible && menuToggle && menuTogglePlacement === 'before-brand'}
    <div class="cinder-navigation-bar__menu-toggle">
      {@render menuToggle({
        'aria-expanded': (mobileMenuOpen ? 'true' : 'false') as 'true' | 'false',
        'aria-controls': regionId,
        ...(browser ? { onclick: handleToggle } : {}),
      })}
    </div>
  {/if}

  {#if brand}
    <div class="cinder-navigation-bar__brand">
      {@render brand()}
    </div>
  {/if}

  {#if isCollapsible && menuToggle && menuTogglePlacement === 'after-brand'}
    <div class="cinder-navigation-bar__menu-toggle">
      {@render menuToggle({
        'aria-expanded': (mobileMenuOpen ? 'true' : 'false') as 'true' | 'false',
        'aria-controls': regionId,
        ...(browser ? { onclick: handleToggle } : {}),
      })}
    </div>
  {/if}

  <div
    bind:this={itemsRegionElement}
    id={regionId}
    class="cinder-navigation-bar__items"
    data-open={mobileMenuOpen ? 'true' : 'false'}
    inert={isCollapsible && isMobileLayout && !mobileMenuOpen ? true : undefined}
  >
    {@render items({ variant, placement, showLabels })}
  </div>

  {#if actions}
    <div class="cinder-navigation-bar__actions">
      {@render actions()}
    </div>
  {/if}
</nav>
