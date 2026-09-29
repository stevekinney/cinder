<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Command menubar for application chrome such as File, Edit, and View menus.
   * @tag navigation
   * @tag menu
   * @tag chrome
   * @useWhen Building a desktop-style command menubar with dropdown command groups.
   * @useWhen Exposing top-level application menus that need arrow-key traversal and optional submenus.
   * @avoidWhen Linking between routes or sections — use navigation-bar or side-navigation instead.
   * @avoidWhen Showing one standalone trigger with a menu — use dropdown, dropdown-menu, and dropdown-item directly.
   * @related navigation-bar, dropdown, dropdown-menu, dropdown-item
   */
  export type {
    MenuBarEntry,
    MenuBarItem,
    MenuBarItemVariant,
    MenuBarLabel,
    MenuBarMenu,
    MenuBarProps,
    MenuBarSeparator,
    MenuBarSubmenu,
    MenuBarSubmenuEntry,
  } from './menu-bar.types.ts';
</script>

<script lang="ts">
  import { tick, untrack } from 'svelte';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';

  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import { observeTextDirection, resolveTextDirection } from '../../_internal/text-direction.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import {
    findTypeaheadMatch,
    isTypeaheadKey,
    TypeaheadBuffer,
  } from '../../utilities/typeahead.ts';
  import type { DropdownContext } from '../dropdown/dropdown.types.ts';
  import DropdownItem from '../dropdown-item/dropdown-item.svelte';
  import DropdownLabel from '../dropdown-label/dropdown-label.svelte';
  import DropdownMenu from '../dropdown-menu/dropdown-menu.svelte';
  import DropdownSeparator from '../dropdown-separator/dropdown-separator.svelte';
  import MenuBarDropdownContext from './menu-bar-dropdown-context.svelte';
  import type {
    MenuBarEntry,
    MenuBarItem,
    MenuBarMenu,
    MenuBarProps,
    MenuBarSubmenu,
    MenuBarSubmenuEntry,
  } from './menu-bar.types.ts';

  type RestSafeProps = MenuBarProps & {
    role?: string;
    dir?: 'ltr' | 'rtl' | 'auto';
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-orientation'?: string;
  };

  let {
    id: providedId,
    menus,
    label = 'Application menu',
    ariaLabelledby,
    class: customClassName,
    role: _role,
    dir: providedDirection,
    'aria-label': _ariaLabel,
    'aria-labelledby': _ariaLabelledBy,
    'aria-orientation': _ariaOrientation,
    onkeydown: consumerOnKeydown,
    ...rest
  }: RestSafeProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(providedId ?? generatedId);

  let rootElement = $state<HTMLDivElement | null>(null);
  // Open/active identity is stored by menu.id (not array index) so it survives
  // `menus` prop reordering, insertion, and removal. Index is derived from
  // these ids only at DOM-navigation boundaries (keyboard/pointer handlers,
  // template attribute checks) — see indexOfId below.
  let activeMenuId = $state<string | null>(untrack(() => menus[0]?.id ?? null));
  let openMenuId = $state<string | null>(null);
  let openSubmenuKey = $state<string | null>(null);
  // The `menus` array from the last time the reconciliation effect below ran,
  // used to find a removed/disabled active menu's former neighbors when its
  // own former index is no longer available from the current array.
  let priorMenus: readonly MenuBarMenu[] = untrack(() => menus);
  // Whether focus was inside the active menu's trigger or popup immediately
  // before the current `menus` update patches the DOM, captured in
  // `$effect.pre` below. The reconciliation `$effect` runs after the DOM
  // patch, by which point a removed trigger/popup node has already lost
  // focus, so this can't be recomputed there.
  let focusWasInsideActiveMenuBeforePatch = false;
  let initialFocus = $state<'first' | 'last' | 'none' | undefined>(undefined);
  let directionRevision = $state(0);
  let suppressSubmenuFocusOpen = false;
  let submenuCloseTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSubmenuCloseKey: string | null = null;
  let pendingSubmenuTriggerId: string | null = null;
  let submenuLeavePoint: { x: number; y: number } | null = null;
  let latestPointerPoint: { x: number; y: number } | null = null;
  const localeContext = getLocaleContext();
  const menuElements = new Map<string, HTMLElement>();
  const typeaheadBuffer = new TypeaheadBuffer();
  const directionElement = $derived(
    providedDirection === 'auto' ? rootElement : (rootElement?.parentElement ?? rootElement),
  );
  const resolvedDirection = $derived.by(() => {
    void directionRevision;
    return providedDirection === 'rtl' || providedDirection === 'ltr'
      ? providedDirection
      : resolveTextDirection(directionElement, localeContext?.direction);
  });
  const rootDirection = $derived(providedDirection === 'auto' ? 'auto' : resolvedDirection);
  const renderedRootDirection = $derived.by(() => {
    if (
      providedDirection === 'auto' ||
      providedDirection === 'rtl' ||
      providedDirection === 'ltr'
    ) {
      return rootDirection;
    }
    return localeContext?.direction ? resolvedDirection : null;
  });

  $effect(() => {
    if (providedDirection === 'rtl' || providedDirection === 'ltr') return;
    return observeTextDirection(directionElement, () => {
      directionRevision += 1;
    });
  });

  $effect(() => {
    return () => {
      clearSubmenuCloseTimer();
      typeaheadBuffer.reset();
    };
  });

  const enabledIndexes = $derived(
    menus.map((menu, index) => ({ menu, index })).filter(({ menu }) => !menu.disabled),
  );

  function indexOfId(menuId: string | null): number {
    return menuId === null ? -1 : menus.findIndex((menu) => menu.id === menuId);
  }

  function ancestryKey(...parts: Array<number | string>): string {
    return [rootId, ...parts].map((part) => String(part).replaceAll(/\s+/g, '-')).join('-');
  }

  function topLevelTriggerId(menuId: string): string {
    return ancestryKey('menu', menuId, 'trigger');
  }

  function topLevelMenuId(menuId: string): string {
    return ancestryKey('menu', menuId, 'menu');
  }

  function submenuTriggerId(menuId: string, submenuId: string): string {
    return ancestryKey('menu', menuId, 'submenu', submenuId, 'trigger');
  }

  function submenuMenuId(menuId: string, submenuId: string): string {
    return ancestryKey('menu', menuId, 'submenu', submenuId, 'menu');
  }

  // Every popup registered under a given top-level menu id: its own dropdown
  // menu plus any submenu popups nested under it (portaled elsewhere in the
  // DOM, but still tracked in menuElements by their ancestry-keyed id).
  function menuElementsForMenu(menuId: string): HTMLElement[] {
    const ownMenuElement = menuElements.get(topLevelMenuId(menuId));
    const submenuPrefix = `${ancestryKey('menu', menuId, 'submenu')}-`;
    const submenuElements = Array.from(menuElements.entries())
      .filter(([key]) => key.startsWith(submenuPrefix))
      .map(([, element]) => element);
    return ownMenuElement ? [ownMenuElement, ...submenuElements] : submenuElements;
  }

  function isElementInsideMenu(menuId: string, element: Element | null): boolean {
    if (!element) return false;
    const trigger = findElementById(topLevelTriggerId(menuId));
    if (trigger && (trigger === element || trigger.contains(element))) return true;
    return menuElementsForMenu(menuId).some(
      (popup) => popup === element || popup.contains(element),
    );
  }

  // Snapshot whether focus sits inside the active menu's trigger or popup
  // BEFORE this `menus` update patches the DOM. By the time the reconciliation
  // `$effect` below runs, a removed trigger/popup node has already been torn
  // down and may have already lost focus, so this can't be recomputed there.
  $effect.pre(() => {
    void menus;
    focusWasInsideActiveMenuBeforePatch =
      activeMenuId !== null && isElementInsideMenu(activeMenuId, menuRoot()?.activeElement ?? null);
  });

  // Reconciles active/open identity against the current `menus` prop. Kept as
  // a single effect (rather than split by concern) so there is exactly one
  // writer of activeMenuId/openMenuId per reactive pass — two effects each
  // reacting to `menus` and both assigning these could race within the same
  // flush.
  $effect(() => {
    const currentMenus = menus;
    const previousMenus = priorMenus;
    priorMenus = currentMenus;

    const firstEnabledId = enabledIndexes[0]?.menu.id ?? null;

    if (firstEnabledId === null) {
      // Nothing enabled remains: close everything and clear the active id so
      // no trigger renders tabindex="0". Focus is never forced anywhere.
      activeMenuId = null;
      openMenuId = null;
      openSubmenuKey = null;
      return;
    }

    const activeMenu =
      activeMenuId === null ? undefined : currentMenus.find((menu) => menu.id === activeMenuId);
    if (activeMenu && !activeMenu.disabled) return;

    const removedMenuId = activeMenuId;
    const wasOpen = openMenuId !== null;
    openMenuId = null;
    openSubmenuKey = null;

    if (!wasOpen || removedMenuId === null) {
      // Active-but-unopened menu removed/disabled: unchanged behavior, fall
      // back to the first enabled menu with no focus move.
      activeMenuId = firstEnabledId;
      return;
    }

    const formerIndex = previousMenus.findIndex((menu) => menu.id === removedMenuId);
    const isStillEnabled = (menuId: string) => {
      const menu = currentMenus.find((entry) => entry.id === menuId);
      return menu !== undefined && !menu.disabled;
    };
    let replacementId: string | null = null;
    if (formerIndex !== -1) {
      for (let offset = 1; replacementId === null && offset < previousMenus.length; offset += 1) {
        const forward = previousMenus[formerIndex + offset];
        if (forward && isStillEnabled(forward.id)) replacementId = forward.id;
      }
      for (let offset = 1; replacementId === null && offset < previousMenus.length; offset += 1) {
        const backward = previousMenus[formerIndex - offset];
        if (backward && isStillEnabled(backward.id)) replacementId = backward.id;
      }
    }
    activeMenuId = replacementId ?? firstEnabledId;

    if (focusWasInsideActiveMenuBeforePatch) {
      const focusTargetId = activeMenuId;
      void tick().then(() => focusTopLevelTrigger(focusTargetId));
    }
  });

  type MenuRoot = Pick<Document, 'activeElement'> & Pick<ParentNode, 'querySelector'>;

  function menuRoot(): MenuRoot | null {
    const root = rootElement?.getRootNode();
    if (!root || !('activeElement' in root) || !('querySelector' in root)) return null;
    return root as MenuRoot;
  }

  function escapeIdForSelector(id: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id);
    return id
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"')
      .replaceAll('\n', '\\a ')
      .replaceAll('\r', '\\d ')
      .replaceAll('\f', '\\c ');
  }

  function focusElement(id: string): void {
    menuRoot()
      ?.querySelector<HTMLElement>(`[id="${escapeIdForSelector(id)}"]`)
      ?.focus();
  }

  function findElementById(id: string): HTMLElement | null {
    return menuRoot()?.querySelector<HTMLElement>(`[id="${escapeIdForSelector(id)}"]`) ?? null;
  }

  function focusSubmenuTriggerAfterClose(id: string): void {
    suppressSubmenuFocusOpen = true;
    focusElement(id);
    void tick().then(() => {
      suppressSubmenuFocusOpen = false;
      return undefined;
    });
  }

  function focusTopLevelTrigger(menuId: string | null): void {
    if (menuId === null) return;
    focusElement(topLevelTriggerId(menuId));
  }

  function nextEnabledMenuIndex(currentIndex: number, direction: -1 | 1): number {
    if (!enabledIndexes.length) return -1;
    const indexes = enabledIndexes.map(({ index }) => index);
    const currentPosition = Math.max(0, indexes.indexOf(currentIndex));
    return indexes[(currentPosition + direction + indexes.length) % indexes.length] ?? -1;
  }

  function horizontalArrowDirection(key: 'ArrowLeft' | 'ArrowRight'): -1 | 1 {
    if (key === 'ArrowRight') return resolvedDirection === 'rtl' ? -1 : 1;
    return resolvedDirection === 'rtl' ? 1 : -1;
  }

  function firstEnabledMenuIndex(): number {
    return enabledIndexes[0]?.index ?? -1;
  }

  function lastEnabledMenuIndex(): number {
    return enabledIndexes.at(-1)?.index ?? -1;
  }

  function openMenu(menuId: string, focus: 'first' | 'last' = 'first'): void {
    const menu = menus.find((entry) => entry.id === menuId);
    if (!menu || menu.disabled) return;
    typeaheadBuffer.reset();
    activeMenuId = menuId;
    openMenuId = menuId;
    openSubmenuKey = null;
    initialFocus = focus;
  }

  function openSubmenu(key: string, focus: 'first' | 'last' | 'none' = 'first'): void {
    openSubmenuKey = key;
    initialFocus = focus;
  }

  function closeAll(): void {
    clearSubmenuCloseTimer();
    typeaheadBuffer.reset();
    openMenuId = null;
    openSubmenuKey = null;
    initialFocus = undefined;
  }

  function closeMenuAndFocusTrigger(menuId: string): void {
    closeAll();
    void tick().then(() => focusTopLevelTrigger(menuId));
  }

  function labelParts(menu: MenuBarMenu): { before: string; key: string; after: string } | null {
    if (!menu.accessKey) return null;
    const index = menu.label.toLocaleLowerCase().indexOf(menu.accessKey.toLocaleLowerCase());
    if (index < 0) return null;

    return {
      before: menu.label.slice(0, index),
      key: menu.label.slice(index, index + 1),
      after: menu.label.slice(index + 1),
    };
  }

  function isItem(entry: MenuBarEntry | MenuBarSubmenuEntry): entry is MenuBarItem {
    return entry.type === undefined || entry.type === 'item';
  }

  function isSubmenu(entry: MenuBarEntry): entry is MenuBarSubmenu {
    return entry.type === 'submenu';
  }

  function makeContext(options: {
    menuId: string;
    anchorElement: () => HTMLElement | null;
    fallbackPlacement?:
      DropdownContext['fallbackPlacement'] | (() => DropdownContext['fallbackPlacement']);
    isOpen: () => boolean;
    close: () => void;
    focusTrigger: () => void;
  }): DropdownContext {
    return {
      get menuId() {
        return options.menuId;
      },
      get isOpen() {
        return options.isOpen();
      },
      get supportsPopover() {
        return false;
      },
      get anchorElement() {
        return options.anchorElement();
      },
      get fallbackPlacement() {
        return typeof options.fallbackPlacement === 'function'
          ? options.fallbackPlacement()
          : (options.fallbackPlacement ?? 'bottom-start');
      },
      get widthMode() {
        return 'menu' as const;
      },
      get initialFocus() {
        return initialFocus;
      },
      close: options.close,
      focusTrigger: options.focusTrigger,
    };
  }

  function submenuDirection(triggerId: string): 'ltr' | 'rtl' | undefined {
    return resolveTextDirection(findElementById(triggerId), resolvedDirection);
  }

  function submenuFallbackPlacement(triggerId: string): DropdownContext['fallbackPlacement'] {
    return submenuDirection(triggerId) === 'rtl' ? 'left-start' : 'right-start';
  }

  function submenuOpenArrow(triggerId: string): 'ArrowLeft' | 'ArrowRight' {
    return submenuDirection(triggerId) === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  }

  function makeMenuRegister(menuId: string): (element: HTMLElement | null) => void {
    return (element) => {
      if (element) {
        menuElements.set(menuId, element);
      } else {
        menuElements.delete(menuId);
      }
    };
  }

  function isInsideOpenMenu(target: Node): boolean {
    return Array.from(menuElements.values()).some((element) => element.contains(target));
  }

  function isPointerStillInsideCurrentTarget(event: MouseEvent | PointerEvent): boolean {
    return event.relatedTarget instanceof Node && event.currentTarget instanceof HTMLElement
      ? event.currentTarget.contains(event.relatedTarget)
      : false;
  }

  function handleSubmenuPointerOut(
    event: MouseEvent | PointerEvent,
    submenuKey: string,
    triggerId: string,
  ): void {
    if (isPointerStillInsideCurrentTarget(event)) return;
    if (openSubmenuKey === submenuKey) scheduleSubmenuClose(submenuKey, triggerId, event);
  }

  function clearSubmenuCloseTimer(): void {
    if (submenuCloseTimer !== null) {
      clearTimeout(submenuCloseTimer);
      submenuCloseTimer = null;
    }
    pendingSubmenuCloseKey = null;
    pendingSubmenuTriggerId = null;
    submenuLeavePoint = null;
    latestPointerPoint = null;
  }

  function pointInTriangle(
    point: { x: number; y: number },
    first: { x: number; y: number },
    second: { x: number; y: number },
    third: { x: number; y: number },
  ): boolean {
    const area =
      0.5 *
      (-second.y * third.x +
        first.y * (-second.x + third.x) +
        first.x * (second.y - third.y) +
        second.x * third.y);
    if (area === 0) return false;
    const sign = area < 0 ? -1 : 1;
    const firstWeight =
      (sign *
        (second.y * third.x -
          second.x * third.y +
          (third.y - second.y) * point.x +
          (second.x - third.x) * point.y)) /
      (2 * Math.abs(area));
    const secondWeight =
      (sign *
        (first.x * third.y -
          first.y * third.x +
          (first.y - third.y) * point.x +
          (third.x - first.x) * point.y)) /
      (2 * Math.abs(area));
    const thirdWeight = 1 - firstWeight - secondWeight;
    return firstWeight >= 0 && secondWeight >= 0 && thirdWeight >= 0;
  }

  function pointInRect(point: { x: number; y: number }, rect: DOMRect): boolean {
    return (
      point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
    );
  }

  function isPointerInsideSubmenu(submenuKey: string): boolean {
    if (!latestPointerPoint) return false;
    const submenu = menuElements.get(submenuKey);
    if (!submenu) return false;

    const submenuRect = submenu.getBoundingClientRect();
    if (submenuRect.width === 0 && submenuRect.height === 0) return false;
    return pointInRect(latestPointerPoint, submenuRect);
  }

  function isPointerMovingTowardSubmenu(triggerId: string): boolean {
    if (!submenuLeavePoint || !latestPointerPoint) return false;
    if (
      submenuLeavePoint.x === latestPointerPoint.x &&
      submenuLeavePoint.y === latestPointerPoint.y
    ) {
      return false;
    }
    const submenu = openSubmenuKey ? menuElements.get(openSubmenuKey) : undefined;
    const trigger = findElementById(triggerId);
    if (!submenu || !trigger) return false;

    const submenuRect = submenu.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    if (submenuRect.width === 0 && submenuRect.height === 0) return false;

    const submenuIsInlineStart = submenuRect.right <= triggerRect.left;
    const nearX = submenuIsInlineStart ? submenuRect.right : submenuRect.left;
    return pointInTriangle(
      latestPointerPoint,
      submenuLeavePoint,
      { x: nearX, y: submenuRect.top },
      { x: nearX, y: submenuRect.bottom },
    );
  }

  function clearSubmenuCloseState(): void {
    pendingSubmenuCloseKey = null;
    pendingSubmenuTriggerId = null;
    submenuLeavePoint = null;
    latestPointerPoint = null;
  }

  function armSubmenuCloseTimer(): void {
    submenuCloseTimer = setTimeout(() => {
      submenuCloseTimer = null;
      const submenuKey = pendingSubmenuCloseKey;
      const triggerId = pendingSubmenuTriggerId;
      if (!submenuKey || !triggerId || openSubmenuKey !== submenuKey) {
        clearSubmenuCloseState();
        return;
      }
      if (isPointerInsideSubmenu(submenuKey)) {
        clearSubmenuCloseState();
        return;
      }
      if (isPointerMovingTowardSubmenu(triggerId)) {
        submenuLeavePoint = latestPointerPoint;
        armSubmenuCloseTimer();
        return;
      }
      openSubmenuKey = null;
      clearSubmenuCloseState();
    }, 150);
  }

  function scheduleSubmenuClose(
    submenuKey: string,
    triggerId: string,
    event: MouseEvent | PointerEvent | undefined = undefined,
  ): void {
    clearSubmenuCloseTimer();
    pendingSubmenuCloseKey = submenuKey;
    pendingSubmenuTriggerId = triggerId;
    if (event) {
      submenuLeavePoint = { x: event.clientX, y: event.clientY };
      latestPointerPoint = submenuLeavePoint;
    }
    armSubmenuCloseTimer();
  }

  function handleDocumentPointermove(event: PointerEvent): void {
    if (submenuCloseTimer === null) return;
    latestPointerPoint = { x: event.clientX, y: event.clientY };
    const submenuKey = pendingSubmenuCloseKey;
    const triggerId = pendingSubmenuTriggerId;
    if (!submenuKey || !triggerId || openSubmenuKey !== submenuKey) return;
    if (isPointerInsideSubmenu(submenuKey) || isPointerMovingTowardSubmenu(triggerId)) return;

    clearSubmenuCloseTimer();
    openSubmenuKey = null;
  }

  function handleMenuTypeahead(event: KeyboardEvent, menu: HTMLElement): boolean {
    if (!isTypeaheadKey(event)) return false;
    const items = Array.from(
      menu.querySelectorAll<HTMLElement>(
        [
          '[role="menuitem"]:not([data-disabled])',
          '[role="menuitemcheckbox"]:not([data-disabled])',
          '[role="menuitemradio"]:not([data-disabled])',
        ].join(', '),
      ),
    ).filter((item) => item.closest('[role="menu"]') === menu);
    if (!items.length) return false;

    const currentIndex = items.findIndex((item) => item === document.activeElement);
    const prefix = typeaheadBuffer.push(event.key);
    const match = findTypeaheadMatch(
      items.map((item, index) => ({
        value: index,
        label: item.textContent?.trim() ?? '',
        disabled: item.hasAttribute('data-disabled'),
      })),
      prefix,
      currentIndex,
    );
    if (match !== undefined) {
      event.preventDefault();
      items[match]?.focus();
      return true;
    }
    return false;
  }

  function handleTriggerKeydown(event: KeyboardEvent, menuId: string): void {
    // Keyboard navigation is a DOM-navigation boundary: derive the current
    // position from the id here, rather than storing index anywhere.
    const index = indexOfId(menuId);

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const nextIndex = nextEnabledMenuIndex(index, horizontalArrowDirection(event.key));
      const nextId = menus[nextIndex]?.id;
      if (nextIndex === -1 || nextId === undefined) return;
      activeMenuId = nextId;
      focusTopLevelTrigger(nextId);
      if (openMenuId !== null) openMenu(nextId);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? firstEnabledMenuIndex() : lastEnabledMenuIndex();
      const nextId = menus[nextIndex]?.id;
      if (nextIndex === -1 || nextId === undefined) return;
      activeMenuId = nextId;
      focusTopLevelTrigger(nextId);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu(menuId, 'first');
      return;
    }

    // Only consume Escape when a menu or submenu is actually open. On a closed
    // menubar item, swallowing Escape (preventDefault + a no-op closeAll) would
    // block an enclosing overlay or page-level Escape handler from ever running.
    //
    // `defaultPrevented` guard (CIN-428 hazard): DropdownMenu's own
    // escape-stack registration runs at the window capture phase, before this
    // bubble-phase trigger listener ever sees the key. In the normal case it
    // already preventDefault()s + stopPropagation()s, so this branch never
    // even runs for that keystroke — this guard is defense-in-depth for any
    // path where the event still reaches here with defaultPrevented already
    // true, so this doesn't run a redundant/conflicting closeAll() on top of
    // whatever the stack handler already did.
    if (
      event.key === 'Escape' &&
      !event.defaultPrevented &&
      (openMenuId !== null || openSubmenuKey !== null)
    ) {
      event.preventDefault();
      closeAll();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(menuId, 'last');
    }
  }

  function handleRootKeydown(event: KeyboardEvent): void {
    if (consumerOnKeydown) {
      (consumerOnKeydown as (event: KeyboardEvent) => void)(event);
    }
    if (event.defaultPrevented) return;

    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.key.length === 1
    ) {
      const accessKey = event.key.toLocaleLowerCase();
      const matchedMenu = menus.find(
        (menu) => !menu.disabled && menu.accessKey?.toLocaleLowerCase() === accessKey,
      );
      if (!matchedMenu) return;
      event.preventDefault();
      openMenu(matchedMenu.id, 'first');
      return;
    }

    if (openMenuId !== null && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const submenuMenu = target?.closest<HTMLElement>('.cinder-menu-bar__submenu-menu');
      if (submenuMenu) {
        const triggerId =
          submenuMenu.dataset['cinderMenuBarSubmenuTriggerId'] ??
          submenuMenu
            .closest<HTMLElement>('.cinder-menu-bar__submenu')
            ?.querySelector<HTMLElement>('[data-cinder-menu-bar-submenu-trigger]')?.id;
        const closeArrow =
          resolveTextDirection(submenuMenu, resolvedDirection) === 'rtl'
            ? 'ArrowRight'
            : 'ArrowLeft';
        if (event.key === closeArrow) {
          event.preventDefault();
          openSubmenuKey = null;
          if (triggerId) focusSubmenuTriggerAfterClose(triggerId);
        } else {
          event.preventDefault();
          const nextIndex = nextEnabledMenuIndex(
            indexOfId(openMenuId),
            horizontalArrowDirection(event.key),
          );
          const nextId = menus[nextIndex]?.id;
          if (nextId !== undefined) openMenu(nextId, 'first');
        }
        return;
      }

      if (target?.closest('[role="menu"]')) {
        const menu = target.closest<HTMLElement>('[role="menu"]');
        if (menu && handleMenuTypeahead(event, menu)) return;

        event.preventDefault();
        const nextIndex = nextEnabledMenuIndex(
          indexOfId(openMenuId),
          horizontalArrowDirection(event.key),
        );
        const nextId = menus[nextIndex]?.id;
        if (nextId !== undefined) openMenu(nextId, 'first');
      }
    } else {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const menu = target?.closest<HTMLElement>('[role="menu"]');
      if (menu) handleMenuTypeahead(event, menu);
    }
  }

  function handleDocumentPointerdown(event: PointerEvent): void {
    if (!rootElement || !(event.target instanceof Node)) return;
    if (isInsideOpenMenu(event.target)) return;
    if (!rootElement.contains(event.target)) closeAll();
  }

  function handleDocumentFocusin(event: FocusEvent): void {
    if (!rootElement || !(event.target instanceof Node)) return;
    if (openMenuId === null && openSubmenuKey === null) return;
    void tick().then(() => {
      if (document.activeElement && rootElement?.contains(document.activeElement)) return;
      if (document.activeElement && isInsideOpenMenu(document.activeElement)) return;
      closeAll();
      return undefined;
    });
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (!rootElement || !(event.target instanceof Node)) return;
    if (rootElement.contains(event.target)) return;
    if (!isInsideOpenMenu(event.target)) return;
    handleRootKeydown(event);
  }
</script>

<svelte:document
  onpointerdown={handleDocumentPointerdown}
  onpointermove={handleDocumentPointermove}
  onfocusin={handleDocumentFocusin}
  onkeydown={handleDocumentKeydown}
/>

<div
  {...rest}
  {...renderedRootDirection ? { dir: renderedRootDirection } : {}}
  bind:this={rootElement}
  id={rootId}
  class={classNames('cinder-menu-bar', customClassName)}
  role="menubar"
  aria-label={ariaLabelledby ? undefined : label}
  aria-labelledby={ariaLabelledby}
  aria-orientation="horizontal"
  onkeydown={handleRootKeydown}
>
  {#each menus as menu (menu.id)}
    {@const triggerId = topLevelTriggerId(menu.id)}
    {@const menuId = topLevelMenuId(menu.id)}
    {@const parts = labelParts(menu)}
    <div class="cinder-menu-bar__menu">
      <button
        id={triggerId}
        type="button"
        class="cinder-menu-bar__trigger"
        role="menuitem"
        aria-label={menu.label}
        aria-haspopup="menu"
        aria-expanded={openMenuId === menu.id ? 'true' : 'false'}
        aria-controls={menuId}
        aria-disabled={menu.disabled ? 'true' : undefined}
        disabled={menu.disabled}
        tabindex={!menu.disabled && activeMenuId === menu.id ? 0 : -1}
        data-cinder-state={openMenuId === menu.id ? 'open' : 'closed'}
        onkeydown={(event) => handleTriggerKeydown(event, menu.id)}
        onclick={() => {
          if (openMenuId === menu.id) closeAll();
          else openMenu(menu.id);
        }}
        onpointerenter={() => {
          if (openMenuId !== null) openMenu(menu.id);
        }}
      >
        {#if parts}
          {parts.before}<span class="cinder-menu-bar__access-key">{parts.key}</span>{parts.after}
        {:else}
          {menu.label}
        {/if}
      </button>

      <MenuBarDropdownContext
        context={makeContext({
          menuId,
          anchorElement: () => findElementById(triggerId),
          fallbackPlacement: 'bottom-start',
          isOpen: () => openMenuId === menu.id,
          close: () => closeMenuAndFocusTrigger(menu.id),
          focusTrigger: () => focusTopLevelTrigger(menu.id),
        })}
        registerMenu={makeMenuRegister(menuId)}
        registerTrigger={() => {}}
        setOpen={(open) => {
          if (open) openMenu(menu.id);
          else closeAll();
        }}
      >
        <DropdownMenu class="cinder-menu-bar__dropdown-menu" aria-labelledby={triggerId}>
          <div class="cinder-menu-bar__dropdown-scroll" role="presentation">
            {#each menu.items as entry (entry.id)}
              {#if isItem(entry)}
                <DropdownItem
                  variant={entry.variant ?? 'default'}
                  disabled={entry.disabled ?? false}
                  closeOnSelect={entry.closeOnSelect ?? true}
                  onclick={(event) => entry.onSelect?.(event)}
                  onfocus={() => {
                    openSubmenuKey = null;
                  }}
                  onpointerenter={() => {
                    clearSubmenuCloseTimer();
                    openSubmenuKey = null;
                  }}
                >
                  <span class="cinder-menu-bar__item-label">{entry.label}</span>
                  {#if entry.shortcut}
                    <span class="cinder-menu-bar__shortcut" aria-hidden="true">
                      {entry.shortcut}
                    </span>
                  {/if}
                </DropdownItem>
              {:else if isSubmenu(entry)}
                {@const submenuKey = submenuMenuId(menu.id, entry.id)}
                {@const submenuTrigger = submenuTriggerId(menu.id, entry.id)}
                <div
                  class="cinder-menu-bar__submenu"
                  role="presentation"
                  onpointerenter={() => {
                    if (openSubmenuKey === submenuKey) clearSubmenuCloseTimer();
                  }}
                  onfocusin={() => {
                    if (openSubmenuKey === submenuKey) clearSubmenuCloseTimer();
                  }}
                  onpointerout={(event) =>
                    handleSubmenuPointerOut(event, submenuKey, submenuTrigger)}
                  onmouseleave={(event) =>
                    handleSubmenuPointerOut(event, submenuKey, submenuTrigger)}
                >
                  <DropdownItem
                    id={submenuTrigger}
                    class="cinder-menu-bar__submenu-trigger"
                    disabled={entry.disabled}
                    closeOnSelect={false}
                    aria-haspopup="menu"
                    aria-expanded={openSubmenuKey === submenuKey ? 'true' : 'false'}
                    aria-controls={submenuKey}
                    data-cinder-menu-bar-submenu-trigger
                    onclick={() => {
                      if (!entry.disabled) openSubmenu(submenuKey);
                    }}
                    onfocus={() => {
                      if (!entry.disabled && !suppressSubmenuFocusOpen)
                        openSubmenu(submenuKey, 'none');
                    }}
                    onpointerenter={() => {
                      clearSubmenuCloseTimer();
                      if (openMenuId === menu.id && !entry.disabled)
                        openSubmenu(submenuKey, 'none');
                    }}
                    onpointerout={(event) =>
                      handleSubmenuPointerOut(event, submenuKey, submenuTrigger)}
                    onmouseleave={(event) =>
                      handleSubmenuPointerOut(event, submenuKey, submenuTrigger)}
                    onkeydown={(event) => {
                      if (entry.disabled) return;
                      if (
                        event.key === submenuOpenArrow(submenuTrigger) ||
                        event.key === 'Enter' ||
                        event.key === ' '
                      ) {
                        event.preventDefault();
                        event.stopPropagation();
                        openSubmenu(submenuKey);
                      }
                    }}
                  >
                    <span class="cinder-menu-bar__item-label">{entry.label}</span>
                    <span
                      class="cinder-menu-bar__submenu-indicator"
                      dir={submenuDirection(submenuTrigger)}
                      aria-hidden="true"
                    >
                      <ChevronRight size={16} strokeWidth={2} />
                    </span>
                  </DropdownItem>

                  <MenuBarDropdownContext
                    context={makeContext({
                      menuId: submenuKey,
                      anchorElement: () => findElementById(submenuTrigger),
                      fallbackPlacement: () => submenuFallbackPlacement(submenuTrigger),
                      isOpen: () => openSubmenuKey === submenuKey,
                      close: () => closeMenuAndFocusTrigger(menu.id),
                      focusTrigger: () => focusSubmenuTriggerAfterClose(submenuTrigger),
                    })}
                    registerMenu={makeMenuRegister(submenuKey)}
                    registerTrigger={() => {}}
                    setOpen={(open) => {
                      if (open) openSubmenu(submenuKey);
                      else openSubmenuKey = null;
                    }}
                  >
                    <DropdownMenu
                      class="cinder-menu-bar__submenu-menu"
                      dir={submenuDirection(submenuTrigger)}
                      data-cinder-menu-bar-submenu-trigger-id={submenuTrigger}
                      aria-labelledby={submenuTrigger}
                      onfocusin={() => {
                        clearSubmenuCloseTimer();
                      }}
                      onpointerenter={() => {
                        clearSubmenuCloseTimer();
                      }}
                      onpointerout={(event) =>
                        handleSubmenuPointerOut(event, submenuKey, submenuTrigger)}
                      onmouseleave={(event) =>
                        handleSubmenuPointerOut(event, submenuKey, submenuTrigger)}
                    >
                      {#each entry.items as submenuEntry (submenuEntry.id)}
                        {#if isItem(submenuEntry)}
                          <DropdownItem
                            variant={submenuEntry.variant ?? 'default'}
                            disabled={submenuEntry.disabled ?? false}
                            closeOnSelect={submenuEntry.closeOnSelect ?? true}
                            onclick={(event) => submenuEntry.onSelect?.(event)}
                          >
                            <span class="cinder-menu-bar__item-label">{submenuEntry.label}</span>
                            {#if submenuEntry.shortcut}
                              <span class="cinder-menu-bar__shortcut" aria-hidden="true">
                                {submenuEntry.shortcut}
                              </span>
                            {/if}
                          </DropdownItem>
                        {:else if submenuEntry.type === 'label'}
                          <DropdownLabel>{submenuEntry.label}</DropdownLabel>
                        {:else}
                          <DropdownSeparator />
                        {/if}
                      {/each}
                    </DropdownMenu>
                  </MenuBarDropdownContext>
                </div>
              {:else if entry.type === 'label'}
                <DropdownLabel>{entry.label}</DropdownLabel>
              {:else}
                <DropdownSeparator />
              {/if}
            {/each}
          </div>
        </DropdownMenu>
      </MenuBarDropdownContext>
    </div>
  {/each}
</div>
