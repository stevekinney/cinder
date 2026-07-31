<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status beta
   * @purpose Wide primary navigation menu with trigger/content panels, shared viewport, active indicator, and nested submenu support.
   * @tag navigation
   * @tag mega-menu
   * @tag menu
   * @useWhen Building site-level navigation where top-level categories reveal rich multi-column content.
   * @useWhen You need optional hover-open behavior with keyboard-first trigger traversal.
   * @avoidWhen A simple single-trigger flyout is sufficient. | dropdown
   * @avoidWhen You need command-style application menus with item-by-item keyboard semantics. | menu-bar
   * @related navigation-bar, menu-bar, dropdown
   * @a11yPattern Navigation landmark + disclosure buttons
   * @keyboardShortcut ArrowLeft / ArrowRight / Home / End / ArrowDown / Escape | Traverses triggers and opens/closes panels.
   * @a11yNote Trigger focus remains in the tab order; Escape closes and returns focus to the active trigger.
   */
  export type {
    MegaMenuItem,
    MegaMenuItemWithSections,
    MegaMenuItemWithSubmenu,
    MegaMenuLink,
    MegaMenuProps,
    MegaMenuSection,
  } from './mega-menu.types.ts';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import {
    elementDirectionStyleOverride,
    composedParentElement,
    observeTextDirectionMediaQueries,
    observeTextDirection,
    resolveTextDirection,
  } from '../../_internal/text-direction.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { MegaMenuProps } from './mega-menu.types.ts';
  import MegaMenuContent from './mega-menu-content.svelte';

  let {
    id: providedId,
    items,
    openOnHover = false,
    viewportVisible = true,
    indicatorVisible = true,
    label = 'Main navigation',
    dir: providedDirection,
    class: className,
    ...rest
  }: MegaMenuProps = $props();

  let navElement = $state<HTMLElement | null>(null);
  let directionRevision = $state(0);
  let directionChainRevision = $state(0);
  const localeContext = getLocaleContext();
  const generatedId = $props.id();
  let openItemId = $state<string | null>(null);
  let previousOpenIndex = $state<number | null>(null);
  let indicatorStyle = $state('');
  // Tracks the id of the item that hover-opened; cleared once the click path runs,
  // preventing the immediately-following synthesised click from closing what hover opened.
  let hoverOpenedId = $state<string | null>(null);
  const directionElement = $derived(
    providedDirection === 'auto' ? navElement : (navElement?.parentElement ?? navElement),
  );
  const resolvedDirection = $derived.by(() => {
    directionRevision;
    if (providedDirection === 'rtl' || providedDirection === 'ltr') {
      // An explicit direction prop takes precedence over ANY ancestor —
      // resolveTextDirection()'s ignoreElementDirectionAttribute mode still
      // walks ancestors when this element has no styling hint of its own,
      // which would let an ancestor's `dir` attribute incorrectly outrank
      // an explicit prop. Only a genuine CSS override on this exact element
      // (inline style or a matching rule) should be able to override it.
      return elementDirectionStyleOverride(navElement) ?? providedDirection;
    }
    if (providedDirection === 'auto') {
      return resolveTextDirection(navElement, localeContext?.direction);
    }
    return navElement
      ? resolveTextDirection(navElement, localeContext?.direction, {
          // The rendered provider fallback is written as `dir` on the nav.
          // Ignore that generated attribute so an explicit CSS direction on
          // the menu itself still controls keyboard traversal.
          ignoreElementDirectionAttribute: true,
        })
      : resolveTextDirection(directionElement, localeContext?.direction);
  });
  const renderedDirection = $derived.by(() => {
    directionRevision;
    if (
      providedDirection === 'auto' ||
      providedDirection === 'rtl' ||
      providedDirection === 'ltr'
    ) {
      return providedDirection;
    }
    return navElement
      ? (resolveTextDirection(navElement, localeContext?.direction, {
          ignoreElementDirectionAttribute: true,
        }) ?? null)
      : (localeContext?.direction ?? null);
  });

  $effect(() => {
    return observeTextDirection(navElement, () => {
      directionRevision += 1;
      directionChainRevision += 1;
    });
  });

  $effect(() =>
    observeTextDirectionMediaQueries(navElement, () => {
      directionRevision += 1;
      updateIndicator();
    }),
  );

  const openItem = $derived(items.find((item) => item.id === openItemId) ?? null);
  const openIndex = $derived(openItemId ? items.findIndex((item) => item.id === openItemId) : -1);
  const motionDirection = $derived.by(() => {
    if (openIndex < 0 || previousOpenIndex === null || previousOpenIndex === openIndex)
      return 'none';
    const movingTowardEnd =
      resolvedDirection === 'rtl' ? openIndex < previousOpenIndex : openIndex > previousOpenIndex;
    return movingTowardEnd ? 'from-end' : 'from-start';
  });
  $effect(() => {
    if (!openItemId) return;
    if (items.some((item) => item.id === openItemId)) return;
    closeMenu();
  });

  function safeDomId(value: string): string {
    return value
      .trim()
      .replaceAll(/[^A-Za-z0-9_-]+/g, '-')
      .replaceAll(/^-+|-+$/g, '');
  }

  function stableHash(value: string): string {
    return Array.from(value)
      .map((character) => (character.codePointAt(0) ?? 0).toString(16).padStart(5, '0'))
      .join('-');
  }

  const instanceId = $derived(
    safeDomId(providedId ?? generatedId) || safeDomId(generatedId) || 'menu',
  );

  function triggerId(itemId: string): string {
    const normalized = safeDomId(itemId) || 'item';
    return `cinder-mega-menu-${instanceId}-trigger-${normalized}-${stableHash(itemId)}`;
  }

  function contentId(itemId: string): string {
    const normalized = safeDomId(itemId) || 'item';
    return `cinder-mega-menu-${instanceId}-content-${normalized}-${stableHash(itemId)}`;
  }

  function submenuTriggerId(itemId: string, submenuId: string): string {
    const normalizedItem = safeDomId(itemId) || 'item';
    const normalizedSubmenu = safeDomId(submenuId) || 'submenu';
    return `cinder-mega-menu-${instanceId}-submenu-trigger-${normalizedItem}-${normalizedSubmenu}-${stableHash(`${itemId}:${submenuId}`)}`;
  }

  function submenuPanelId(itemId: string, submenuId: string): string {
    const normalizedItem = safeDomId(itemId) || 'item';
    const normalizedSubmenu = safeDomId(submenuId) || 'submenu';
    return `cinder-mega-menu-${instanceId}-submenu-panel-${normalizedItem}-${normalizedSubmenu}-${stableHash(`${itemId}:${submenuId}`)}`;
  }

  function updateIndicator() {
    if (!indicatorVisible || !navElement || !openItemId) {
      indicatorStyle = '';
      return;
    }
    const trigger = navElement.querySelector<HTMLButtonElement>(
      `#${CSS.escape(triggerId(openItemId))}`,
    );
    if (!trigger) {
      indicatorStyle = '';
      return;
    }
    const navRect = navElement.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const left = Math.max(0, triggerRect.left - navRect.left);
    indicatorStyle = `inline-size:${triggerRect.width}px;transform:translateX(${left}px);`;
  }

  function openItemByIndex(index: number) {
    const bounded = ((index % items.length) + items.length) % items.length;
    const next = items[bounded];
    if (!next) return;
    if (openIndex >= 0) previousOpenIndex = openIndex;
    openItemId = next.id;
  }

  function closeMenu(restoreFocus = false) {
    const currentItemId = openItemId;
    const shouldRestoreFocus =
      restoreFocus &&
      currentItemId !== null &&
      typeof document !== 'undefined' &&
      navElement?.contains(document.activeElement);

    openItemId = null;
    previousOpenIndex = null;

    if (shouldRestoreFocus && currentItemId) {
      void tick().then(() => {
        document.getElementById(triggerId(currentItemId))?.focus();
      });
    }
  }

  function focusTriggerAt(index: number) {
    const bounded = ((index % items.length) + items.length) % items.length;
    const target = items[bounded];
    if (!target || typeof document === 'undefined') return;
    document.getElementById(triggerId(target.id))?.focus();
  }

  function onTriggerClick(index: number) {
    const target = items[index];
    if (!target) return;
    // If hover just opened this item, clear the flag and do nothing —
    // the synthesised click (touch / hybrid browser) must not immediately toggle it closed.
    if (hoverOpenedId === target.id) {
      hoverOpenedId = null;
      return;
    }
    hoverOpenedId = null;
    if (openItemId === target.id) {
      closeMenu();
      return;
    }
    openItemByIndex(index);
  }

  function onTriggerEnter(index: number) {
    if (!openOnHover) return;
    const target = items[index];
    if (!target) return;
    hoverOpenedId = target.id;
    openItemByIndex(index);
  }

  async function focusPanelContent(itemId: string) {
    if (typeof document === 'undefined') return;
    await tick();
    const panel = document.getElementById(contentId(itemId));
    if (!(panel instanceof HTMLElement)) return;
    const firstFocusable = panel.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (firstFocusable) {
      firstFocusable.focus();
      return;
    }
    panel.focus();
  }

  function onTriggerKeydown(event: KeyboardEvent, index: number) {
    const forwardIndexDelta = resolvedDirection === 'rtl' ? -1 : 1;
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTriggerAt(index + forwardIndexDelta);
        if (openItemId) openItemByIndex(index + forwardIndexDelta);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTriggerAt(index - forwardIndexDelta);
        if (openItemId) openItemByIndex(index - forwardIndexDelta);
        break;
      case 'Home':
        event.preventDefault();
        focusTriggerAt(0);
        if (openItemId) openItemByIndex(0);
        break;
      case 'End':
        event.preventDefault();
        focusTriggerAt(items.length - 1);
        if (openItemId) openItemByIndex(items.length - 1);
        break;
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        event.preventDefault();
        const target = items[index];
        if (!target) return;
        openItemByIndex(index);
        void focusPanelContent(target.id);
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu();
        break;
      default:
        break;
    }
  }

  function onRootFocusOut(event: FocusEvent) {
    if (!navElement) return;
    if (event.relatedTarget instanceof Node && navElement.contains(event.relatedTarget)) return;
    closeMenu();
  }

  $effect(() => {
    resolvedDirection;
    updateIndicator();
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      directionRevision += 1;
      updateIndicator();
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  });

  $effect(() => {
    if (!navElement) return;
    const refresh = () => {
      directionRevision += 1;
      updateIndicator();
    };
    navElement.addEventListener('focusin', refresh);
    navElement.addEventListener('focusout', refresh);
    return () => {
      navElement?.removeEventListener('focusin', refresh);
      navElement?.removeEventListener('focusout', refresh);
    };
  });

  $effect(() => {
    directionChainRevision;
    if (!navElement || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      directionRevision += 1;
      updateIndicator();
    });
    let current: HTMLElement | null = navElement;
    while (current) {
      observer.observe(current);
      current = composedParentElement(current);
    }
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!openOnHover || !openItemId) return;
    const closeIfOutside = (event: MouseEvent) => {
      if (!navElement) return;
      if (event.target instanceof Node && navElement.contains(event.target)) return;
      closeMenu();
    };
    document.addEventListener('mousemove', closeIfOutside, true);
    return () => document.removeEventListener('mousemove', closeIfOutside, true);
  });

  $effect(() => {
    if (!openItemId) return;
    const closeOnOutsidePointer = (event: PointerEvent | MouseEvent | TouchEvent) => {
      if (!navElement) return;
      if (event.target instanceof Node && navElement.contains(event.target)) return;
      closeMenu();
    };
    const supportsPointerEvents =
      typeof window !== 'undefined' && typeof window.PointerEvent !== 'undefined';
    if (supportsPointerEvents) {
      document.addEventListener('pointerdown', closeOnOutsidePointer as EventListener, true);
      return () =>
        document.removeEventListener('pointerdown', closeOnOutsidePointer as EventListener, true);
    }
    document.addEventListener('mousedown', closeOnOutsidePointer as EventListener, true);
    document.addEventListener('touchstart', closeOnOutsidePointer as EventListener, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer as EventListener, true);
      document.removeEventListener('touchstart', closeOnOutsidePointer as EventListener, true);
    };
  });
</script>

<nav
  id={providedId}
  {...rest}
  dir={renderedDirection}
  bind:this={navElement}
  class={classNames('cinder-mega-menu', className)}
  aria-label={label}
  onfocusout={onRootFocusOut}
>
  <ul class="cinder-mega-menu__list">
    {#each items as item, index (item.id)}
      <li>
        <button
          id={triggerId(item.id)}
          type="button"
          class="cinder-mega-menu__trigger"
          aria-controls={openItemId === item.id ? contentId(item.id) : undefined}
          aria-expanded={openItemId === item.id ? 'true' : 'false'}
          onmouseenter={() => onTriggerEnter(index)}
          onclick={() => onTriggerClick(index)}
          onkeydown={(event) => onTriggerKeydown(event, index)}
        >
          {item.label}
        </button>
      </li>
    {/each}
  </ul>

  {#if indicatorVisible}
    <div class="cinder-mega-menu__indicator-track" aria-hidden="true">
      <div class="cinder-mega-menu__indicator" style={indicatorStyle}></div>
    </div>
  {/if}

  {#if openItem}
    <div class={viewportVisible ? 'cinder-mega-menu__viewport' : undefined}>
      {#key openItem.id}
        <MegaMenuContent
          item={openItem}
          {motionDirection}
          {resolvedDirection}
          {contentId}
          {triggerId}
          {submenuTriggerId}
          {submenuPanelId}
          {closeMenu}
        />
      {/key}
    </div>
  {/if}
</nav>
