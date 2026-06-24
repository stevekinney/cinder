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
  import { tick } from 'svelte';

  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import { resolveTextDirection } from '../../_internal/text-direction.ts';
  import { classNames } from '../../utilities/class-names.ts';
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
    labelledBy,
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
  let activeMenuIndex = $state(0);
  let openMenuIndex = $state<number | null>(null);
  let openSubmenuKey = $state<string | null>(null);
  let initialFocus = $state<'first' | 'last' | 'none' | undefined>(undefined);
  let suppressSubmenuFocusOpen = false;
  const localeContext = getLocaleContext();
  const menuElements = new Map<string, HTMLElement>();
  const resolvedDirection = $derived(
    providedDirection === 'rtl' || providedDirection === 'ltr'
      ? providedDirection
      : resolveTextDirection(rootElement?.parentElement ?? rootElement, localeContext?.direction),
  );

  const enabledIndexes = $derived(
    menus.map((menu, index) => ({ menu, index })).filter(({ menu }) => !menu.disabled),
  );

  $effect(() => {
    const firstEnabledIndex = enabledIndexes[0]?.index ?? -1;
    if (firstEnabledIndex === -1) {
      activeMenuIndex = -1;
      openMenuIndex = null;
      openSubmenuKey = null;
    } else if (!menus[activeMenuIndex] || menus[activeMenuIndex]?.disabled) {
      activeMenuIndex = firstEnabledIndex;
    }
  });

  function ancestryKey(...parts: Array<number | string>): string {
    return [rootId, ...parts].map((part) => String(part).replaceAll(/\s+/g, '-')).join('-');
  }

  function topLevelTriggerId(index: number, menu: MenuBarMenu): string {
    return ancestryKey('menu', index, menu.id, 'trigger');
  }

  function topLevelMenuId(index: number, menu: MenuBarMenu): string {
    return ancestryKey('menu', index, menu.id, 'menu');
  }

  function submenuTriggerId(
    menuIndex: number,
    menu: MenuBarMenu,
    entryIndex: number,
    submenu: MenuBarSubmenu,
  ): string {
    return ancestryKey('menu', menuIndex, menu.id, 'submenu', entryIndex, submenu.id, 'trigger');
  }

  function submenuMenuId(
    menuIndex: number,
    menu: MenuBarMenu,
    entryIndex: number,
    submenu: MenuBarSubmenu,
  ): string {
    return ancestryKey('menu', menuIndex, menu.id, 'submenu', entryIndex, submenu.id, 'menu');
  }

  function focusElement(id: string): void {
    document.getElementById(id)?.focus();
  }

  function findElementById(id: string): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const element = document.getElementById(id);
    return element instanceof HTMLElement ? element : null;
  }

  function focusSubmenuTriggerAfterClose(id: string): void {
    suppressSubmenuFocusOpen = true;
    focusElement(id);
    void tick().then(() => {
      suppressSubmenuFocusOpen = false;
    });
  }

  function focusTopLevelTrigger(index: number): void {
    const menu = menus[index];
    if (!menu) return;
    focusElement(topLevelTriggerId(index, menu));
  }

  function nextEnabledMenuIndex(currentIndex: number, direction: -1 | 1): number {
    if (!enabledIndexes.length) return -1;
    const indexes = enabledIndexes.map(({ index }) => index);
    const currentPosition = Math.max(0, indexes.indexOf(currentIndex));
    return indexes[(currentPosition + direction + indexes.length) % indexes.length] ?? -1;
  }

  function firstEnabledMenuIndex(): number {
    return enabledIndexes[0]?.index ?? -1;
  }

  function lastEnabledMenuIndex(): number {
    return enabledIndexes.at(-1)?.index ?? -1;
  }

  function openMenu(index: number, focus: 'first' | 'last' = 'first'): void {
    const menu = menus[index];
    if (!menu || menu.disabled) return;
    activeMenuIndex = index;
    openMenuIndex = index;
    openSubmenuKey = null;
    initialFocus = focus;
  }

  function openSubmenu(key: string, focus: 'first' | 'last' | 'none' = 'first'): void {
    openSubmenuKey = key;
    initialFocus = focus;
  }

  function closeAll(): void {
    openMenuIndex = null;
    openSubmenuKey = null;
    initialFocus = undefined;
  }

  function closeMenuAndFocusTrigger(index: number): void {
    closeAll();
    void tick().then(() => focusTopLevelTrigger(index));
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
      | DropdownContext['fallbackPlacement']
      | (() => DropdownContext['fallbackPlacement']);
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

  function submenuDirection(submenuTriggerId: string): 'ltr' | 'rtl' | undefined {
    return resolveTextDirection(findElementById(submenuTriggerId), resolvedDirection);
  }

  function submenuFallbackPlacement(
    submenuTriggerId: string,
  ): DropdownContext['fallbackPlacement'] {
    return submenuDirection(submenuTriggerId) === 'rtl' ? 'left-start' : 'right-start';
  }

  function submenuOpenArrow(submenuTriggerId: string): 'ArrowLeft' | 'ArrowRight' {
    return submenuDirection(submenuTriggerId) === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
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

  function handleTriggerKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const nextIndex = nextEnabledMenuIndex(index, event.key === 'ArrowRight' ? 1 : -1);
      if (nextIndex === -1) return;
      activeMenuIndex = nextIndex;
      focusTopLevelTrigger(nextIndex);
      if (openMenuIndex !== null) openMenu(nextIndex);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? firstEnabledMenuIndex() : lastEnabledMenuIndex();
      if (nextIndex === -1) return;
      activeMenuIndex = nextIndex;
      focusTopLevelTrigger(nextIndex);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu(index, 'first');
      return;
    }

    // Only consume Escape when a menu or submenu is actually open. On a closed
    // menubar item, swallowing Escape (preventDefault + a no-op closeAll) would
    // block an enclosing overlay or page-level Escape handler from ever running.
    if (event.key === 'Escape' && (openMenuIndex !== null || openSubmenuKey !== null)) {
      event.preventDefault();
      closeAll();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(index, 'last');
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
      const index = menus.findIndex(
        (menu) => !menu.disabled && menu.accessKey?.toLocaleLowerCase() === accessKey,
      );
      if (index === -1) return;
      event.preventDefault();
      openMenu(index, 'first');
      return;
    }

    if (openMenuIndex !== null && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
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
            openMenuIndex,
            event.key === 'ArrowRight' ? 1 : -1,
          );
          if (nextIndex !== -1) openMenu(nextIndex, 'first');
        }
        return;
      }

      if (target?.closest('[role="menu"]')) {
        event.preventDefault();
        const nextIndex = nextEnabledMenuIndex(openMenuIndex, event.key === 'ArrowRight' ? 1 : -1);
        if (nextIndex !== -1) openMenu(nextIndex, 'first');
      }
    }
  }

  function handleDocumentPointerdown(event: PointerEvent): void {
    if (!rootElement || !(event.target instanceof Node)) return;
    if (isInsideOpenMenu(event.target)) return;
    if (!rootElement.contains(event.target)) closeAll();
  }

  function handleDocumentFocusin(event: FocusEvent): void {
    if (!rootElement || !(event.target instanceof Node)) return;
    void tick().then(() => {
      if (document.activeElement && rootElement?.contains(document.activeElement)) return;
      if (document.activeElement && isInsideOpenMenu(document.activeElement)) return;
      closeAll();
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
  onfocusin={handleDocumentFocusin}
  onkeydown={handleDocumentKeydown}
/>

<div
  {...rest}
  bind:this={rootElement}
  id={rootId}
  class={classNames('cinder-menu-bar', customClassName)}
  dir={resolvedDirection}
  role="menubar"
  aria-label={labelledBy ? undefined : label}
  aria-labelledby={labelledBy}
  aria-orientation="horizontal"
  onkeydown={handleRootKeydown}
>
  {#each menus as menu, menuIndex (ancestryKey('menu', menuIndex, menu.id))}
    {@const triggerId = topLevelTriggerId(menuIndex, menu)}
    {@const menuId = topLevelMenuId(menuIndex, menu)}
    {@const parts = labelParts(menu)}
    <div class="cinder-menu-bar__menu">
      <button
        id={triggerId}
        type="button"
        class="cinder-menu-bar__trigger"
        role="menuitem"
        aria-label={menu.label}
        aria-haspopup="menu"
        aria-expanded={openMenuIndex === menuIndex ? 'true' : 'false'}
        aria-controls={menuId}
        aria-disabled={menu.disabled ? 'true' : undefined}
        disabled={menu.disabled}
        tabindex={!menu.disabled && activeMenuIndex === menuIndex ? 0 : -1}
        data-cinder-state={openMenuIndex === menuIndex ? 'open' : 'closed'}
        onkeydown={(event) => handleTriggerKeydown(event, menuIndex)}
        onclick={() => {
          if (openMenuIndex === menuIndex) closeAll();
          else openMenu(menuIndex);
        }}
        onpointerenter={() => {
          if (openMenuIndex !== null) openMenu(menuIndex);
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
          isOpen: () => openMenuIndex === menuIndex,
          close: () => closeMenuAndFocusTrigger(menuIndex),
          focusTrigger: () => focusTopLevelTrigger(menuIndex),
        })}
        registerMenu={makeMenuRegister(menuId)}
        registerTrigger={() => {}}
        setOpen={(open) => {
          if (open) openMenu(menuIndex);
          else closeAll();
        }}
      >
        <DropdownMenu class="cinder-menu-bar__dropdown-menu" aria-labelledby={triggerId}>
          <div class="cinder-menu-bar__dropdown-scroll" role="presentation">
            {#each menu.items as entry, entryIndex (ancestryKey('menu', menuIndex, menu.id, entryIndex, entry.id))}
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
                {@const submenuKey = submenuMenuId(menuIndex, menu, entryIndex, entry)}
                {@const submenuTrigger = submenuTriggerId(menuIndex, menu, entryIndex, entry)}
                <div class="cinder-menu-bar__submenu">
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
                      if (openMenuIndex === menuIndex && !entry.disabled)
                        openSubmenu(submenuKey, 'none');
                    }}
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
                    <span class="cinder-menu-bar__submenu-indicator" aria-hidden="true">&gt;</span>
                  </DropdownItem>

                  <MenuBarDropdownContext
                    context={makeContext({
                      menuId: submenuKey,
                      anchorElement: () => findElementById(submenuTrigger),
                      fallbackPlacement: () => submenuFallbackPlacement(submenuTrigger),
                      isOpen: () => openSubmenuKey === submenuKey,
                      close: () => closeMenuAndFocusTrigger(menuIndex),
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
                    >
                      {#each entry.items as submenuEntry, submenuEntryIndex (ancestryKey('submenu', submenuKey, submenuEntryIndex, submenuEntry.id))}
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
