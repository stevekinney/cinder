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
  import type { Placement } from '@floating-ui/dom';
  import type { NavigationBarProps, NavigationVariant } from './navigation-bar.types.ts';
  import { BROWSER as browser } from 'esm-env';
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { createPortalAttachment } from '../portal/index.ts';
  import {
    closestAcrossShadow,
    createInheritedPortalStyle,
    findNearestOpenTopLayer,
    getShadowHost,
    isRedispatchedPortaledEvent,
    observePortalSourceAvailability,
    redispatchPortaledEvent,
  } from '../portal/portal.utilities.svelte.ts';
  import {
    findFocusTargetAfterNavigationItems,
    findFocusTargetBeforeNavigationItems,
    getNavigationBarBrandFocusTargets,
    getSequentialFocusTargets,
  } from './navigation-bar-focus.ts';

  const COLLAPSIBLE_MAX_WIDTH_REM = 47.99;
  const FALLBACK_ROOT_FONT_SIZE_PX = 16;
  const regionId = $props.id();

  let {
    class: className,
    placement = 'top',
    labelsVisible = 'always',
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
  let pendingTabFocus = $state(false);
  let pendingTabFocusTarget = $state<HTMLElement | null>(null);
  let itemsRegionElement: HTMLDivElement | null = null;
  let sourceSubtreeUnavailable = $state(false);
  const itemsPortalScope = createPortalAttachment({
    disabled: () => !isMobileLayout || !mobileMenuOpen || sourceSubtreeUnavailable,
    source: () => navigationBarElement,
    target: () => {
      const source = navigationBarElement;
      if (!source) return null;
      return findNearestOpenTopLayer(source);
    },
  });
  const anchoredItems = createAnchoredOverlay({
    open: () => isMobileLayout && mobileMenuOpen && !sourceSubtreeUnavailable,
    anchor: () => navigationBarElement,
    panel: () => itemsRegionElement,
    placement: () => 'bottom-start' as Placement,
    offset: () => 0,
    widthMode: () => 'match-anchor',
  });
  const inheritedPortalStyle = createInheritedPortalStyle(
    () => navigationBarElement,
    () => isMobileLayout && mobileMenuOpen && !sourceSubtreeUnavailable,
  );

  $effect(() => {
    if (!mobileMenuOpen || !isMobileLayout) {
      pendingTabFocus = false;
      pendingTabFocusTarget = null;
    }
    if (!pendingTabFocus || !anchoredItems.positionReady) return;
    pendingTabFocus = false;
    const pendingTarget = pendingTabFocusTarget;
    pendingTabFocusTarget = null;
    queueMicrotask(() => (pendingTarget ?? getToggleTabTarget())?.focus());
  });

  $effect(() => {
    if (!isCollapsible) return;

    return observePortalSourceAvailability(navigationBarElement, (unavailable) => {
      sourceSubtreeUnavailable = unavailable;
      if (unavailable) mobileMenuOpen = false;
    });
  });

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
      const handleResize = () =>
        updateMobileLayout(navigationBarElement?.getBoundingClientRect().width ?? 0);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
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

  function handleToggleKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || event.shiftKey || !isMobileLayout || !mobileMenuOpen) return;
    if (!anchoredItems.positionReady) {
      pendingTabFocus = true;
      pendingTabFocusTarget =
        menuTogglePlacement === 'before-brand'
          ? (getNavigationBarBrandFocusTargets(navigationBarElement)[0] ?? null)
          : null;
      event.preventDefault();
      return;
    }
    const target = getToggleTabTarget();
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  function getNavigationItems(): HTMLElement[] {
    if (!itemsRegionElement) return [];

    return Array.from(itemsRegionElement.querySelectorAll<HTMLElement>(navigationItemSelector));
  }

  function getSequentialNavigationItems(): HTMLElement[] {
    return getSequentialFocusTargets(itemsRegionElement).filter(
      (item) => item.matches(navigationItemSelector) && isEnabledNavigationItem(item),
    );
  }

  function getToggleTabTarget(): HTMLElement | null {
    const brandTarget =
      menuTogglePlacement === 'before-brand'
        ? getNavigationBarBrandFocusTargets(navigationBarElement)[0]
        : null;
    return brandTarget ?? getSequentialNavigationItems()[0] ?? null;
  }

  function bridgeBrandTabToPortaledPanel(event: KeyboardEvent): boolean {
    if (
      event.key !== 'Tab' ||
      event.shiftKey ||
      menuTogglePlacement !== 'before-brand' ||
      !isMobileLayout ||
      !mobileMenuOpen ||
      !anchoredItems.positionReady ||
      !(event.target instanceof HTMLElement)
    ) {
      return false;
    }

    const brandTargets = getNavigationBarBrandFocusTargets(navigationBarElement);
    if (event.target !== brandTargets.at(-1)) return false;

    const firstItem = getSequentialNavigationItems()[0];
    if (!firstItem) return false;

    event.preventDefault();
    firstItem.focus();
    return true;
  }

  function isEnabledNavigationItem(item: HTMLElement): boolean {
    if (item.getAttribute('aria-disabled') === 'true' || item.matches(':disabled')) return false;
    if (item.hidden || closestAcrossShadow(item, '[hidden], [inert], [aria-hidden="true"]'))
      return false;
    if (typeof getComputedStyle === 'function') {
      let current: HTMLElement | null = item;
      while (current) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        current = current.parentElement ?? getShadowHost(current);
      }
    }
    return true;
  }

  function getEventNavigationItem(event: Event): HTMLElement | null {
    if (!(event.target instanceof Element) || !itemsRegionElement) return null;

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

  function moveFocusBeforeClosingItemsRegion(): void {
    if (!browser || !itemsRegionElement) return;

    const activeElement = document.activeElement;
    if (activeElement instanceof Element && itemsRegionElement.contains(activeElement)) {
      // Closing changes the items snippet from mobile to horizontal and moves
      // the portaled region back inline. Restore focus after that DOM move so
      // the browser cannot discard the focus request with the old subtree.
      queueMicrotask(focusMenuToggle);
    }
  }

  function focusMenuToggle(): void {
    const focusTarget = findFocusTargetBeforeNavigationItems(
      navigationBarElement,
      toggleElement,
      false,
    );
    focusTarget?.focus();
  }

  function getFocusTargetBeforeItems(): HTMLElement | null {
    return findFocusTargetBeforeNavigationItems(
      navigationBarElement,
      toggleElement,
      menuTogglePlacement === 'before-brand',
    );
  }

  function getFocusTargetAfterItems(): HTMLElement | null {
    return findFocusTargetAfterNavigationItems(navigationBarElement, itemsRegionElement);
  }

  function bridgePortaledPanelTab(event: KeyboardEvent, navigationItem: HTMLElement): boolean {
    if (!anchoredItems.positionReady) return false;

    const enabledItems = getSequentialNavigationItems();
    const logicalEnabledItems = getNavigationItems().filter(isEnabledNavigationItem);
    if (enabledItems.length === 0 && logicalEnabledItems.length === 0) return false;

    if (
      event.shiftKey &&
      (navigationItem === enabledItems[0] || navigationItem === logicalEnabledItems[0])
    ) {
      const previousTarget = getFocusTargetBeforeItems();
      if (!previousTarget) return false;
      event.preventDefault();
      previousTarget.focus();
      return true;
    }

    if (
      !event.shiftKey &&
      (navigationItem === enabledItems.at(-1) || navigationItem === logicalEnabledItems.at(-1))
    ) {
      const nextTarget = getFocusTargetAfterItems();
      if (!nextTarget) return false;
      event.preventDefault();
      nextTarget.focus();
      return true;
    }

    return false;
  }

  function handleClick(event: MouseEvent): void {
    if (consumerOnClick) {
      const consumerEvent = withNavigationCurrentTarget(event);
      (consumerOnClick as (this: HTMLElement | null, e: MouseEvent) => void).call(
        navigationBarElement,
        consumerEvent,
      );
    }
    if (event.defaultPrevented) return;

    const navigationItem = getEventNavigationItem(event);
    if (!navigationItem || !canCloseAfterItemActivation(navigationItem, event)) return;

    moveFocusBeforeClosingItemsRegion();
    mobileMenuOpen = false;
  }

  function bridgePortaledEvent(event: Event): void {
    if (isRedispatchedPortaledEvent(event)) return;
    redispatchPortaledEvent(event, navigationBarElement);
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
      (consumerOnKeyDown as (e: KeyboardEvent) => void)(withNavigationCurrentTarget(event));
    }
    if (event.defaultPrevented) return;

    if (bridgeBrandTabToPortaledPanel(event)) return;

    if (event.key === 'Escape' && isCollapsible && isMobileLayout && mobileMenuOpen) {
      mobileMenuOpen = false;
      focusMenuToggle();
      return;
    }

    const navigationItem = getEventNavigationItem(event);
    if (!navigationItem || navigationItem !== event.target) return;

    if (event.key === 'Tab' && bridgePortaledPanelTab(event, navigationItem)) return;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      focusAdjacentNavigationItem(navigationItem, event.key === 'ArrowRight' ? 1 : -1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (isEnabledNavigationItem(navigationItem)) {
        navigationItem.click();
        if (!mobileMenuOpen) queueMicrotask(focusMenuToggle);
      }
    }
  }

  function withNavigationCurrentTarget<T extends Event>(event: T): T {
    return new Proxy(event, {
      get(target, property) {
        if (property === 'currentTarget') return navigationBarElement;
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, property, value) {
        return Reflect.set(target, property, value, target);
      },
    });
  }
</script>

<nav
  {...rest}
  bind:this={navigationBarElement}
  aria-label={label}
  class={classNames('cinder-navigation-bar', className)}
  data-collapsible={isCollapsible ? 'true' : 'false'}
  data-cinder-placement={placement}
  data-cinder-label-visibility={labelsVisible}
  data-cinder-menu-toggle-placement={menuTogglePlacement}
  onclick={handleClick}
  onkeydown={handleKeyDown}
>
  {#if isCollapsible && menuToggle && menuTogglePlacement === 'before-brand'}
    <div class="cinder-navigation-bar__menu-toggle">
      {@render menuToggle({
        'aria-expanded': (mobileMenuOpen ? 'true' : 'false') as 'true' | 'false',
        'aria-controls': regionId,
        ...(browser ? { onclick: handleToggle, onkeydown: handleToggleKeyDown } : {}),
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
        ...(browser ? { onclick: handleToggle, onkeydown: handleToggleKeyDown } : {}),
      })}
    </div>
  {/if}

  {#if isMobileLayout && mobileMenuOpen}
    <div class="cinder-navigation-bar__items-owner" aria-owns={regionId}></div>
  {/if}

  <div
    {@attach itemsPortalScope}
    class={classNames('cinder-navigation-bar__portal-scope', 'cinder-navigation-bar', className)}
    style={`display: ${isMobileLayout && mobileMenuOpen ? 'block' : 'contents'};${inheritedPortalStyle.style}`}
  >
    <div
      bind:this={itemsRegionElement}
      id={regionId}
      class={classNames(
        'cinder-navigation-bar__items',
        isMobileLayout && mobileMenuOpen ? 'cinder-_floating-surface' : undefined,
      )}
      data-open={mobileMenuOpen ? 'true' : 'false'}
      data-cinder-mobile-panel={isMobileLayout || undefined}
      data-cinder-position-ready={anchoredItems.positionReady || undefined}
      style={anchoredItems.positionStyle}
      inert={isCollapsible && isMobileLayout && !mobileMenuOpen ? true : undefined}
      onclick={isMobileLayout ? bridgePortaledEvent : undefined}
      onkeydown={isMobileLayout ? bridgePortaledEvent : undefined}
      onfocusin={isMobileLayout ? bridgePortaledEvent : undefined}
      onfocusout={isMobileLayout ? bridgePortaledEvent : undefined}
      onpointerdown={isMobileLayout ? bridgePortaledEvent : undefined}
      onpointerup={isMobileLayout ? bridgePortaledEvent : undefined}
      oninput={isMobileLayout ? bridgePortaledEvent : undefined}
      onchange={isMobileLayout ? bridgePortaledEvent : undefined}
    >
      {@render items({ variant, placement, labelsVisible })}
    </div>
  </div>

  {#if actions}
    <div class="cinder-navigation-bar__actions">
      {@render actions()}
    </div>
  {/if}
</nav>
