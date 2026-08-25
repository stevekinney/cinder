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
  import type { SequentialFocusTarget } from '../../utilities/focus.ts';
  import { onDestroy } from 'svelte';
  import { BROWSER as browser } from 'esm-env';
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { createAnchoredOverlayExitState } from '../../_internal/anchored-overlay-exit.svelte.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { getSequentialFocusTargets, getTabIndexValue } from '../../utilities/focus.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
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
    findFirstBrandFocusTargetAfterToggle,
    findFocusTargetAfterNavigationItems,
    findFocusTargetBeforeNavigationItems,
    getNavigationBarBrandFocusTargets,
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

  // Stores the toggle element for focus return after Escape-close.
  let navigationBarElement: HTMLElement | null = null;
  let toggleElement: HTMLElement | null = null;
  let pendingTabFocus = $state(false);
  let pendingTabFocusTarget = $state<SequentialFocusTarget | null>(null);
  let itemsRegionElement: HTMLDivElement | null = null;
  let sourceSubtreeUnavailable = $state(false);
  const itemsPortalScope = createPortalAttachment({
    // Gated on `mobileMenuOpen || exitState.renderPanel` (not `mobileMenuOpen`
    // alone), same reasoning as `variant` and the `cinder-_floating-surface`
    // class below: `mobileMenuOpen` flips false the instant close begins.
    // Disabling the portal at that exact moment moves the panel back inline
    // — under whatever transformed/containing-block-forming ancestor the
    // NavigationBar itself sits in — while `anchoredItems` keeps writing
    // viewport-relative fixed `top`/`left` coordinates for the rest of the
    // exit transition (`exitState.isClosing`), which are then interpreted in
    // the wrong coordinate system and make the panel jump during the exit.
    disabled: () =>
      !isMobileLayout || !(mobileMenuOpen || exitState.renderPanel) || sourceSubtreeUnavailable,
    source: () => navigationBarElement,
    target: () => {
      const source = navigationBarElement;
      if (!source) return null;
      return findNearestOpenTopLayer(source);
    },
  });
  const mobilePanelOpen = $derived(isMobileLayout && mobileMenuOpen && !sourceSubtreeUnavailable);
  const reducedMotion = useReducedMotion();
  // Shared anchored-overlay exit-transition lifecycle (OVERLAY-POLICY.md §
  // "Transition lifecycle"). The panel never unmounts, so `renderPanel`/
  // `isClosing` drive `data-cinder-visible`/`data-cinder-closing` instead of
  // an `{#if}` gate — this replaces the previous `[data-open='false']`
  // instant `visibility: hidden`, which hid the exit transition entirely.
  const exitState = createAnchoredOverlayExitState({
    getOpen: () => mobilePanelOpen,
    getPanelElement: () => itemsRegionElement,
    getReducedMotion: () => reducedMotion.current,
  });
  const anchoredItems = createAnchoredOverlay({
    // Gated on `exitState.renderPanel`, not `exitState.isClosing`: `$effect`s
    // (where `exitState.sync()` runs, and where `isClosing` actually flips
    // true) fire after a render has already committed. On every collapsed-
    // panel close, `mobilePanelOpen` becomes `false` in THIS render, one
    // tick before `exitState.sync()` ever runs — so `isClosing` still reads
    // its pre-close (false) value here, and `createAnchoredOverlay` would
    // briefly take its closed path, clearing the fixed coordinates and
    // match-anchor width. Because `data-cinder-visible` and the portal
    // already retain the panel, it would visibly jump/reflow until Floating
    // UI asynchronously repositions it again. `renderPanel` doesn't have
    // this lag.
    //
    // `open()` is `isMobileLayout && exitState.renderPanel`, not
    // `mobilePanelOpen || exitState.renderPanel`: this callback runs inside
    // `createAnchoredOverlay`'s own positioning `$effect`, so reading the
    // raw `mobilePanelOpen` prop here — even behind an `||` whose overall
    // result doesn't change — still subscribes that effect to
    // `mobilePanelOpen` as a fine-grained dependency, causing it to briefly
    // tear down/rebuild on every ordinary close. `renderPanel` alone is
    // stable throughout the open session — see Popover's `anchoredOverlay`
    // for the fuller explanation of this same fix (CIN-376 round 12).
    //
    // `isMobileLayout` IS explicitly read here, unlike `mobilePanelOpen`:
    // it's a deliberate, coarse-grained dependency (it only changes on a
    // breakpoint crossing, not on every open/close), and reading it here is
    // exactly what makes a breakpoint change torn down immediately. Without
    // it, resizing to desktop mid-close would leave `renderPanel` still
    // true (the exit transition hasn't finished), so this callback would
    // keep returning `true` and `anchoredItems.positionStyle` would keep
    // applying viewport-fixed mobile coordinates to what is now supposed to
    // be an inline desktop nav — even though the portal (`itemsPortalScope`
    // above) already correctly restores it inline and `variant`/
    // `inheritedPortalStyle` already correctly stop treating it as mobile.
    // Positioning must tear down in that same step, not lag behind on
    // `renderPanel` alone.
    //
    // `!sourceSubtreeUnavailable` is read for the SAME reason as
    // `isMobileLayout` (CIN-376 round 18 review): when the source ancestor
    // becomes `inert`/`aria-hidden`/disabled, the availability observer sets
    // `sourceSubtreeUnavailable` and closes the menu — `itemsPortalScope`
    // above already includes this in its own `disabled` gate and
    // immediately restores the panel inline, but this positioning gate
    // stayed true through `exitState.renderPanel` regardless, so the
    // restored (now inline, no longer portaled) panel kept its
    // viewport-fixed coordinates and match-anchor width for the rest of the
    // exit — coordinates that mean something different once reinterpreted
    // under a transformed/containing-block-forming ancestor, making the
    // panel visibly jump during this exceptional dismissal. Tearing down
    // alongside the portal, not lagging behind it, fixes that.
    open: () => isMobileLayout && exitState.renderPanel && !sourceSubtreeUnavailable,
    anchor: () => navigationBarElement,
    panel: () => itemsRegionElement,
    placement: () => 'bottom-start' as Placement,
    offset: () => 0,
    widthMode: () => 'match-anchor',
  });

  // Gated on `mobileMenuOpen || exitState.renderPanel` (not `mobileMenuOpen`
  // alone) for the same reason as the `cinder-_floating-surface` class below:
  // `mobileMenuOpen` flips false the instant close begins, and resolving
  // `variant` to 'horizontal' at that exact moment would strip the mobile
  // item styling out from under the panel while it's still retained and
  // visibly playing its exit transition.
  const variant: NavigationVariant = $derived(
    placement === 'bottom'
      ? 'mobile'
      : isCollapsible && isMobileLayout && (mobileMenuOpen || exitState.renderPanel)
        ? 'mobile'
        : 'horizontal',
  );

  $effect(() => {
    exitState.sync();
  });

  onDestroy(() => {
    exitState.destroy();
  });
  const inheritedPortalStyle = createInheritedPortalStyle(
    () => navigationBarElement,
    // Same retention as `itemsPortalScope` above — keep inheriting the
    // portaled subtree's theme/direction tokens through the exit
    // transition too, not just while `mobileMenuOpen` is live.
    () => isMobileLayout && (mobileMenuOpen || exitState.renderPanel) && !sourceSubtreeUnavailable,
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
    queueMicrotask(() => {
      const target =
        pendingTarget ?? getToggleTabTarget(toggleElement) ?? getFocusTargetAfterItems();
      target?.focus();
    });
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
    const toggle = event.currentTarget as HTMLElement | null;
    if (!anchoredItems.positionReady) {
      pendingTabFocus = true;
      pendingTabFocusTarget =
        menuTogglePlacement === 'before-brand'
          ? findFirstBrandFocusTargetAfterToggle(navigationBarElement, toggle)
          : null;
      event.preventDefault();
      return;
    }
    const target = getToggleTabTarget(toggle);
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  function getNavigationItems(): HTMLElement[] {
    if (!itemsRegionElement) return [];

    return Array.from(itemsRegionElement.querySelectorAll<HTMLElement>(navigationItemSelector));
  }

  function getSequentialNavigationItems(): HTMLElement[] {
    // Navigation items are always rendered as HTML elements (never SVG), but
    // `getSequentialFocusTargets` returns the wider `SequentialFocusTarget`
    // union since brand targets can be SVG. Narrow with `instanceof` so the
    // return type matches every downstream consumer of navigation items.
    return getSequentialFocusTargets(itemsRegionElement).filter(
      (item): item is HTMLElement =>
        item instanceof HTMLElement &&
        item.matches(navigationItemSelector) &&
        isEnabledNavigationItem(item),
    );
  }

  function getToggleTabTarget(toggle: HTMLElement | null): SequentialFocusTarget | null {
    const brandTarget =
      menuTogglePlacement === 'before-brand'
        ? findFirstBrandFocusTargetAfterToggle(navigationBarElement, toggle)
        : null;
    if (brandTarget) return brandTarget;

    const items = getSequentialNavigationItems();
    const toggleTabIndex = toggle ? getTabIndexValue(toggle) : 0;
    if (toggleTabIndex > 0) {
      // A positive-tabindex toggle has already passed every lower-or-equal
      // positive-tabindex item in native order, so the fallback must filter
      // for a same/higher positive item (or the first zero-tier item)
      // instead of naively taking the globally-first (lowest positive) item.
      //
      // This intentionally does NOT match `findSequentialEntryTarget`'s
      // "return null rather than fall back to zero tier" rule: that rule
      // exists for callers with a further, reachable fallback to defer to
      // (a following composed-scope search, a menu toggle in the normal
      // light DOM). Tab pressed on the toggle itself has nowhere else to
      // defer to — the items panel is portaled out of normal document flow
      // while open, so a `null` here would strand focus instead of letting
      // native Tab find anything, since native Tab cannot reach a portaled
      // subtree on its own. Landing on the first zero-tier item is the
      // better outcome even though, in principle, a higher positive tier
      // could theoretically exist elsewhere on the page.
      return (
        items.find((item) => getTabIndexValue(item) >= toggleTabIndex) ??
        items.find((item) => getTabIndexValue(item) === 0) ??
        null
      );
    }

    // A zero/default-tabindex toggle sits in native order's zero tier, which
    // forward Tab only reaches after every positive-tabindex stop. `items`
    // is sorted positives-first, so its globally-first entry can be a
    // positive-tabindex item the toggle has already passed; filter for the
    // first zero-tier item instead of naively taking items[0].
    return items.find((item) => getTabIndexValue(item) === 0) ?? null;
  }

  function bridgeBrandTabToPortaledPanel(event: KeyboardEvent): boolean {
    if (
      event.key !== 'Tab' ||
      event.shiftKey ||
      menuTogglePlacement !== 'before-brand' ||
      !isMobileLayout ||
      !mobileMenuOpen ||
      !anchoredItems.positionReady
    ) {
      return false;
    }

    // A keydown listener on the outer `<nav>` observes `event.target`
    // retargeted to the shadow host when the real origin lives inside an
    // open shadow root (for example, a brand logo that exposes its last
    // tabbable control from its own shadow DOM). `composedPath()[0]` is the
    // actual originating node regardless of shadow retargeting.
    const composedTarget = event.composedPath()[0];
    if (!(composedTarget instanceof HTMLElement || composedTarget instanceof SVGElement)) {
      return false;
    }

    const brandTargets = getNavigationBarBrandFocusTargets(navigationBarElement);
    if (composedTarget !== brandTargets.at(-1)) return false;

    // A brand containing only positive-tabindex controls has not yet
    // reached the menu toggle's own zero/default tier — positive tiers
    // always precede the zero/default tier regardless of DOM position, so
    // if the toggle is still tier-wise "after" `composedTarget`, native Tab
    // must land there next (the toggle is a normal, non-portaled control,
    // so leaving `preventDefault()` uncalled lets the browser find it on
    // its own). Only bridge straight into the portaled panel once nothing
    // in the navigation bar's own light DOM — including the toggle — still
    // lies ahead of `composedTarget`.
    const menuToggleTarget = getSequentialFocusTargets(
      navigationBarElement?.querySelector('.cinder-navigation-bar__menu-toggle') ?? null,
    )[0];
    const toggleStillAhead =
      menuToggleTarget !== undefined &&
      getSequentialFocusTargets(navigationBarElement, {
        relativeTo: composedTarget,
        direction: 'after',
      }).includes(menuToggleTarget);
    if (toggleStillAhead) return false;

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

  function getFocusTargetBeforeItems(
    navigationItem: HTMLElement | null = null,
  ): SequentialFocusTarget | null {
    return findFocusTargetBeforeNavigationItems(
      navigationBarElement,
      toggleElement,
      menuTogglePlacement === 'before-brand',
      navigationItem,
    );
  }

  function getFocusTargetAfterItems(
    navigationItem: HTMLElement | null = null,
  ): SequentialFocusTarget | null {
    return findFocusTargetAfterNavigationItems(
      navigationBarElement,
      itemsRegionElement,
      navigationItem,
    );
  }

  function bridgePortaledPanelTab(event: KeyboardEvent, navigationItem: HTMLElement): boolean {
    if (!anchoredItems.positionReady) return false;

    const sequentialItems = getSequentialFocusTargets(itemsRegionElement);
    const navigationItems = getNavigationItems();
    // Evaluate `isEnabledNavigationItem` at most once per navigation item —
    // each call walks the item's full ancestor chain calling
    // `getComputedStyle` — and derive both the `getSequentialNavigationItems`-
    // equivalent list and `logicalEnabledItems` from the same memoizing
    // accessor instead of invoking it again for each list. `sequentialItems`
    // (a composed-tree walk) and `navigationItems` (a light-DOM query) are
    // not guaranteed to be the same set, so this memoizes lazily by item
    // identity rather than pre-seeding from `navigationItems` and betting on
    // it containing every item `sequentialItems` can produce.
    const isItemEnabled = new Map<HTMLElement, boolean>();
    const resolveItemEnabled = (item: HTMLElement): boolean => {
      const memoized = isItemEnabled.get(item);
      if (memoized !== undefined) return memoized;

      const enabled = isEnabledNavigationItem(item);
      isItemEnabled.set(item, enabled);
      return enabled;
    };
    const enabledItems = sequentialItems.filter(
      (item): item is HTMLElement =>
        item instanceof HTMLElement &&
        item.matches(navigationItemSelector) &&
        resolveItemEnabled(item),
    );
    const logicalEnabledItems = navigationItems.filter((item) => resolveItemEnabled(item));
    const isSequentialTarget = sequentialItems.includes(navigationItem);
    const hasSequentialTargetBefore = sequentialItems.some((target) =>
      Boolean(target.compareDocumentPosition(navigationItem) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    const hasSequentialTargetAfter = sequentialItems.some((target) =>
      Boolean(navigationItem.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    if (enabledItems.length === 0 && logicalEnabledItems.length === 0) return false;

    if (
      event.shiftKey &&
      (navigationItem === sequentialItems[0] ||
        (!isSequentialTarget &&
          !hasSequentialTargetBefore &&
          (navigationItem === enabledItems[0] || navigationItem === logicalEnabledItems[0])))
    ) {
      const previousTarget = getFocusTargetBeforeItems(navigationItem);
      if (!previousTarget) return false;
      event.preventDefault();
      previousTarget.focus();
      return true;
    }

    if (
      !event.shiftKey &&
      (navigationItem === sequentialItems.at(-1) ||
        (!isSequentialTarget &&
          !hasSequentialTargetAfter &&
          (navigationItem === enabledItems.at(-1) ||
            navigationItem === logicalEnabledItems.at(-1))))
    ) {
      const nextTarget = getFocusTargetAfterItems(navigationItem);
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

  function bridgePortaledEvents(element: HTMLElement): () => void {
    const eventTypes = [
      'click',
      'keydown',
      'focusin',
      'focusout',
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'input',
      'change',
    ] as const;
    const handleEvent = (event: Event): void => {
      if (isMobileLayout) bridgePortaledEvent(event);
    };
    for (const eventType of eventTypes) element.addEventListener(eventType, handleEvent);
    return () => {
      for (const eventType of eventTypes) element.removeEventListener(eventType, handleEvent);
    };
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
    if (
      event.key === 'Tab' &&
      event.target instanceof HTMLElement &&
      itemsRegionElement?.contains(event.target) &&
      bridgePortaledPanelTab(event, event.target)
    ) {
      return;
    }

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

  {#if isMobileLayout && (mobileMenuOpen || exitState.renderPanel)}
    <div class="cinder-navigation-bar__items-owner" aria-owns={regionId}></div>
  {/if}

  <div
    {@attach itemsPortalScope}
    class={classNames('cinder-navigation-bar__portal-scope', 'cinder-navigation-bar', className)}
    style={`display: ${isMobileLayout && (mobileMenuOpen || exitState.renderPanel) ? 'block' : 'contents'};${inheritedPortalStyle.style}`}
  >
    <div
      bind:this={itemsRegionElement}
      {@attach bridgePortaledEvents}
      id={regionId}
      class={classNames(
        'cinder-navigation-bar__items',
        // Keep the shared floating-surface chrome (border/radius/shadow)
        // through the exit transition too — gating this purely on the live
        // `mobileMenuOpen` bindable would strip it the instant close begins,
        // stripping the surface's border/shadow before the 200ms exit
        // transition has even started.
        isMobileLayout && (mobileMenuOpen || exitState.renderPanel)
          ? 'cinder-_floating-surface'
          : undefined,
      )}
      data-open={mobileMenuOpen ? 'true' : 'false'}
      data-cinder-mobile-panel={isMobileLayout || undefined}
      data-cinder-position-ready={anchoredItems.positionReady || undefined}
      data-cinder-visible={exitState.renderPanel ? '' : undefined}
      data-cinder-closing={exitState.isClosing ? '' : undefined}
      style={anchoredItems.positionStyle}
      inert={isCollapsible && isMobileLayout && !mobileMenuOpen ? true : undefined}
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
