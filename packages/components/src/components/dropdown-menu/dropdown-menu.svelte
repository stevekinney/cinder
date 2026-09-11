<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Popover-backed menu surface that hosts dropdown-item rows and owns arrow-key, Home, End, and Escape navigation.
   * @tag overlay
   * @tag menu
   * @useWhen Rendering the floating panel that holds a dropdown's menu items.
   * @useWhen Composing a dropdown's body from dropdown-item, dropdown-label, and dropdown-separator children.
   * @avoidWhen Used outside a dropdown context — it requires the dropdown provider and will throw otherwise.
   * @avoidWhen Showing arbitrary non-menu content — use popover.
   * @related dropdown, dropdown-trigger, dropdown-item, dropdown-label, dropdown-separator
   */
  export type { DropdownMenuProps } from './dropdown-menu.types.ts';
</script>

<script lang="ts">
  import type { DropdownMenuProps } from './dropdown-menu.types.ts';
  import { tick } from 'svelte';

  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { observeTextDirection, resolveTextDirection } from '../../_internal/text-direction.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import {
    findTypeaheadMatch,
    isTypeaheadKey,
    TypeaheadBuffer,
  } from '../../utilities/typeahead.ts';
  import {
    getDropdownContext,
    getDropdownRegister,
    getDropdownSetOpen,
  } from '../dropdown/dropdown.context.ts';
  import { createPortalAttachment } from '../portal/index.ts';

  function terminated(declaration: string): string {
    const trimmed = declaration.trim();
    return trimmed.length === 0 || trimmed.endsWith(';') ? trimmed : `${trimmed};`;
  }

  let {
    class: customClassName,
    children,
    dir: direction,
    style: consumerStyle,
    ...rest
  }: DropdownMenuProps = $props();

  const context = getDropdownContext();
  const registerMenu = getDropdownRegister();
  const setOpen = getDropdownSetOpen();
  const localeContext = getLocaleContext();
  let directionRevision = $state(0);
  const resolvedDirection = $derived.by(() => {
    directionRevision;
    if (direction === 'auto') {
      return resolveTextDirection(context.anchorElement, localeContext?.direction) ?? direction;
    }
    return direction ?? resolveTextDirection(context.anchorElement, localeContext?.direction);
  });
  const fallbackAnchorElement = $derived(
    context.fallbackAnchorElement === undefined
      ? context.anchorElement
      : context.fallbackAnchorElement,
  );

  let menuElement = $state<HTMLDivElement | null>(null);
  let focusedFallbackOpen = false;
  const typeaheadBuffer = new TypeaheadBuffer();
  const preferredPlacement = $derived(context.fallbackPlacement ?? 'bottom-start');
  const anchoredFallback = createAnchoredOverlay({
    open: () => context.isOpen && !context.supportsPopover && Boolean(fallbackAnchorElement),
    anchor: () => fallbackAnchorElement,
    panel: () => menuElement,
    placement: () => preferredPlacement,
    offset: () => 4,
    widthMode: () => context.widthMode ?? 'menu',
  });
  const fallbackPositionStyle = $derived(
    context.fallbackPositionStyle ??
      (fallbackAnchorElement ? anchoredFallback.positionStyle : undefined),
  );
  const anchorStyle = $derived(
    context.supportsPopover ? `position-anchor: --${context.menuId};` : fallbackPositionStyle,
  );
  const mergedStyle = $derived(
    [consumerStyle, anchorStyle]
      .filter((declaration): declaration is string => Boolean(declaration))
      .map(terminated)
      .join(' ') || undefined,
  );
  const fallbackPositionReady = $derived(
    context.fallbackPositionReady ??
      (fallbackAnchorElement ? anchoredFallback.positionReady : undefined),
  );
  const fallbackPortalAttachment = createPortalAttachment({
    target: () => (typeof document === 'undefined' ? null : document.body),
    source: () => context.anchorElement,
    inheritAttributes: true,
    disabled: () => context.supportsPopover,
  });

  $effect(() => {
    registerMenu(menuElement);
    return () => registerMenu(null);
  });

  $effect(() => {
    return () => typeaheadBuffer.reset();
  });

  $effect(() => {
    if (!context.isOpen) typeaheadBuffer.reset();
  });

  $effect(() => {
    if (direction && direction !== 'auto') return;
    return observeTextDirection(context.anchorElement, () => {
      directionRevision += 1;
    });
  });

  $effect(() => {
    if (context.supportsPopover || !context.isOpen) {
      focusedFallbackOpen = false;
      return;
    }
    if (focusedFallbackOpen) return;
    if (context.initialFocus === 'none') return;
    focusedFallbackOpen = true;
    void tick().then(() => focusMenuItem(context.initialFocus === 'last' ? -1 : 0));
  });

  function getOwnedMenuItems(): HTMLElement[] {
    if (!menuElement) return [];

    return Array.from(
      menuElement.querySelectorAll<HTMLElement>(
        [
          '[role="menuitem"]:not([data-disabled])',
          '[role="menuitemcheckbox"]:not([data-disabled])',
          '[role="menuitemradio"]:not([data-disabled])',
        ].join(', '),
      ),
    ).filter((item) => item.closest('[role="menu"]') === menuElement);
  }

  function focusMenuItem(index: number): void {
    const items = getOwnedMenuItems();
    if (!items.length) {
      menuElement?.focus();
      return;
    }

    const resolvedIndex = index < 0 ? items.length - 1 : index;
    const item = items.at(resolvedIndex);
    item?.focus();
  }

  // Escape ownership (CIN-428). The local, target-scoped Escape branch is
  // deleted — the escape-stack registration below is the single Escape
  // dispatch path, and it fires whenever this menu is open regardless of
  // where focus sits. The `target.closest('[role="menu"]')` scoping in
  // handleKeydown below still applies to ArrowDown/Up/Home/End/typeahead —
  // Escape no longer needs it, since the shared stack itself arbitrates
  // between nested/sibling overlays via LIFO ordering (MenuBar's staged
  // submenu-then-menubar close falls out of this naturally: each open
  // DropdownMenu instance — submenu, then top-level — registers separately,
  // so the submenu's registration sits above the top-level's on the stack).
  //
  // Split by `context.supportsPopover`, mirroring dropdown.svelte's own
  // legacy native-popover branch: the fallback (non-popover) path dismisses
  // directly. The native-popover path must NOT call `preventDefault()` —
  // doing so would cancel the browser's own Escape close-request for the
  // top-layer `popover="auto"` element, leaving it visually open (and
  // `ontoggle` never firing to sync `context.isOpen` back to false) even
  // though this handler had already called `setOpen(false)`. Registering a
  // no-op still matters: without an entry here, a lower escape-stack overlay
  // would incorrectly react to the same keystroke, since the stack only
  // invokes the top-most handler. The browser's native light-dismiss closes
  // the popover on its own, and `handleToggle`'s `ontoggle` listener keeps
  // `context.isOpen` in sync once it does.
  function dismissMenu(event?: KeyboardEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    setOpen(false);
    context.focusTrigger();
  }

  $effect(() => {
    if (context.supportsPopover || !context.isOpen) return;
    const releaseEscape = pushEscapeHandler(dismissMenu);
    return releaseEscape;
  });

  $effect(() => {
    if (!context.supportsPopover || !context.isOpen) return;
    const releaseEscape = pushEscapeHandler((event?: KeyboardEvent) => {
      // Still must not preventDefault (see above) — the browser's own
      // Escape close-request is what actually hides the popover. It DOES
      // still call stopPropagation(): the two are independent (propagation
      // only controls whether the event keeps reaching other listeners in
      // its path; only preventDefault() cancels the browser's own default
      // action), so stopping propagation here is safe and is what keeps a
      // focused descendant's own keydown listener, or a page-level Escape
      // handler, from also reacting to the same keystroke while the
      // top-most overlay's stack registration is supposed to own it.
      event?.stopPropagation();
      // Native focus restoration only returns focus to the invoker if focus
      // was still *inside* the popover at the moment it closes; if focus had
      // already moved outside (e.g. the user tabbed out while the menu was
      // open), native restoration doesn't apply and focus would otherwise
      // be left on whatever was outside — breaking dropdown.a11y.md's
      // Escape-returns-focus-to-trigger contract. Restore it ourselves in
      // that case only; when focus is still inside, leave it to native.
      if (menuElement && !menuElement.contains(document.activeElement)) {
        context.focusTrigger();
      }
    });
    return releaseEscape;
  });

  function handleKeydown(event: KeyboardEvent): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('[role="menu"]') !== menuElement) return;

    const itemsArray = getOwnedMenuItems();
    if (!itemsArray.length) return;
    const currentIndex = itemsArray.findIndex((item) => item === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(currentIndex < itemsArray.length - 1 ? currentIndex + 1 : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(currentIndex > 0 ? currentIndex - 1 : itemsArray.length - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(itemsArray.length - 1);
    } else if (isTypeaheadKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      const match = findTypeaheadMatch(
        itemsArray.map((item, index) => ({
          value: index,
          label: item.textContent?.trim() ?? '',
          disabled: item.hasAttribute('data-disabled'),
        })),
        typeaheadBuffer.push(event.key),
        currentIndex,
      );
      if (match !== undefined) focusMenuItem(match);
    }
  }

  function handleToggle(event: ToggleEvent): void {
    const isOpenNow = event.newState === 'open';
    setOpen(isOpenNow);

    if (isOpenNow) {
      if (context.initialFocus === 'none') return;
      void tick().then(() => focusMenuItem(context.initialFocus === 'last' ? -1 : 0));
    }
  }
</script>

{#if context.supportsPopover || context.isOpen}
  <div
    bind:this={menuElement}
    id={context.menuId}
    popover={context.supportsPopover ? 'auto' : undefined}
    class={classNames('cinder-_floating-surface', 'cinder-dropdown-menu', customClassName)}
    style={mergedStyle}
    role="menu"
    aria-orientation="vertical"
    data-cinder-placement={context.supportsPopover
      ? preferredPlacement
      : anchoredFallback.resolvedPlacement}
    data-cinder-position-ready={!context.supportsPopover && fallbackPositionReady !== undefined
      ? fallbackPositionReady
      : undefined}
    tabindex={-1}
    onkeydown={handleKeydown}
    ontoggle={context.supportsPopover ? handleToggle : undefined}
    {@attach fallbackPortalAttachment}
    {...rest}
    dir={resolvedDirection}
    data-cinder-explicit-direction={resolvedDirection ? 'true' : undefined}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}
