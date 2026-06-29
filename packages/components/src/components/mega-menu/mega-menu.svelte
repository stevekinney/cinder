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
   * @a11yPattern WAI-ARIA Menubar
   * @keyboardShortcut ArrowLeft / ArrowRight / Home / End / ArrowDown / Escape | Traverses triggers and opens/closes panels.
   * @a11yNote Trigger focus remains in the tab order; Escape closes and returns focus to the active trigger.
   */
  export type {
    MegaMenuItem,
    MegaMenuLink,
    MegaMenuProps,
    MegaMenuSection,
  } from './mega-menu.types.ts';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import type { MegaMenuItem, MegaMenuProps } from './mega-menu.types.ts';

  let {
    id: providedId,
    items,
    openOnHover = false,
    showViewport = true,
    showIndicator = true,
    label = 'Main navigation',
    class: className,
    ...rest
  }: MegaMenuProps = $props();

  let navElement = $state<HTMLElement | null>(null);
  const generatedId = $props.id();
  let openItemId = $state<string | null>(null);
  let previousOpenIndex = $state<number | null>(null);
  let openSubmenuId = $state<string | null>(null);
  let indicatorStyle = $state('');

  const openItem = $derived(items.find((item) => item.id === openItemId) ?? null);
  const openIndex = $derived(openItemId ? items.findIndex((item) => item.id === openItemId) : -1);
  const motionDirection = $derived.by(() => {
    if (openIndex < 0 || previousOpenIndex === null || previousOpenIndex === openIndex)
      return 'none';
    return openIndex > previousOpenIndex ? 'from-end' : 'from-start';
  });
  const openSubmenu = $derived.by(() => {
    if (!openItem?.submenu?.length || !openSubmenuId) return openItem?.submenu?.[0] ?? null;
    return (
      openItem.submenu.find((entry) => entry.id === openSubmenuId) ?? openItem.submenu[0] ?? null
    );
  });

  function safeDomId(value: string): string {
    return value
      .trim()
      .replaceAll(/[^A-Za-z0-9_-]+/g, '-')
      .replaceAll(/^-+|-+$/g, '');
  }

  function stableHash(value: string): string {
    let hash = 0;
    for (const character of value) {
      hash = (hash * 31 + character.charCodeAt(0)) | 0;
    }
    return Math.abs(hash).toString(36);
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

  function updateIndicator() {
    if (!showIndicator || !navElement || !openItemId) {
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
    openSubmenuId = next.submenu?.[0]?.id ?? null;
  }

  function closeMenu(restoreFocus = false) {
    const currentItemId = openItemId;
    const shouldRestoreFocus =
      restoreFocus &&
      currentItemId !== null &&
      typeof document !== 'undefined' &&
      navElement?.contains(document.activeElement);

    openItemId = null;
    openSubmenuId = null;
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
    if (openItemId === target.id) {
      closeMenu();
      return;
    }
    openItemByIndex(index);
  }

  function onTriggerEnter(index: number) {
    if (!openOnHover) return;
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
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTriggerAt(index + 1);
        if (openItemId) openItemByIndex(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTriggerAt(index - 1);
        if (openItemId) openItemByIndex(index - 1);
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

  function onContentKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeMenu(true);
  }

  function onRootFocusOut(event: FocusEvent) {
    if (!navElement) return;
    if (event.relatedTarget instanceof Node && navElement.contains(event.relatedTarget)) return;
    closeMenu();
  }

  $effect(() => {
    updateIndicator();
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => updateIndicator();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  });

  $effect(() => {
    if (!openOnHover || !openItemId) return;
    const closeIfOutside = (event: MouseEvent) => {
      if (!navElement) return;
      if (event.target instanceof Node && navElement.contains(event.target)) return;
      closeMenu(true);
    };
    document.addEventListener('mousemove', closeIfOutside, true);
    return () => document.removeEventListener('mousemove', closeIfOutside, true);
  });

  $effect(() => {
    if (!openItemId) return;
    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (!navElement) return;
      if (event.target instanceof Node && navElement.contains(event.target)) return;
      closeMenu(true);
    };
    document.addEventListener('mousedown', closeOnOutsidePointer, true);
    return () => document.removeEventListener('mousedown', closeOnOutsidePointer, true);
  });

  function sections(item: MegaMenuItem | null) {
    return item?.sections ?? [];
  }
</script>

<nav
  id={providedId}
  {...rest}
  bind:this={navElement}
  class={classNames('cinder-mega-menu', className)}
  aria-label={label}
  onfocusout={onRootFocusOut}
>
  <ul class="cinder-mega-menu__list" role="menubar">
    {#each items as item, index (item.id)}
      <li role="none">
        <button
          id={triggerId(item.id)}
          type="button"
          role="menuitem"
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

  {#if showIndicator}
    <div class="cinder-mega-menu__indicator-track" aria-hidden="true">
      <div class="cinder-mega-menu__indicator" style={indicatorStyle}></div>
    </div>
  {/if}

  {#if openItem}
    <div class={showViewport ? 'cinder-mega-menu__viewport' : undefined}>
      <section
        id={contentId(openItem.id)}
        class="cinder-mega-menu__content"
        role="group"
        aria-labelledby={triggerId(openItem.id)}
        tabindex="-1"
        data-motion={motionDirection}
        onkeydown={onContentKeydown}
      >
        <div class="cinder-mega-menu__sections">
          {#each sections(openItem) as section (section.id)}
            <section>
              {#if section.title}
                <h3 class="cinder-mega-menu__section-title">{section.title}</h3>
              {/if}
              <ul class="cinder-mega-menu__links">
                {#each section.links as link (link.id)}
                  <li>
                    <a class="cinder-mega-menu__link" href={link.href}>
                      <span>{link.label}</span>
                      {#if link.description}
                        <span class="cinder-mega-menu__link-description">{link.description}</span>
                      {/if}
                    </a>
                  </li>
                {/each}
              </ul>
            </section>
          {/each}
        </div>

        {#if openItem.submenu && openItem.submenu.length > 0}
          <section class="cinder-mega-menu__sub" aria-label={`${openItem.label} submenu`}>
            <ul class="cinder-mega-menu__submenu-list">
              {#each openItem.submenu as sub (sub.id)}
                <li>
                  <button
                    type="button"
                    class="cinder-mega-menu__submenu-trigger"
                    data-active={openSubmenu?.id === sub.id ? 'true' : 'false'}
                    onmouseenter={() => (openSubmenuId = sub.id)}
                    onclick={() => (openSubmenuId = sub.id)}
                  >
                    {sub.label}
                  </button>
                </li>
              {/each}
            </ul>

            {#if openSubmenu}
              <div class="cinder-mega-menu__sections">
                {#each sections(openSubmenu) as section (section.id)}
                  <section>
                    {#if section.title}
                      <h4 class="cinder-mega-menu__section-title">{section.title}</h4>
                    {/if}
                    <ul class="cinder-mega-menu__links">
                      {#each section.links as link (link.id)}
                        <li>
                          <a class="cinder-mega-menu__link" href={link.href}>
                            <span>{link.label}</span>
                            {#if link.description}
                              <span class="cinder-mega-menu__link-description"
                                >{link.description}</span
                              >
                            {/if}
                          </a>
                        </li>
                      {/each}
                    </ul>
                  </section>
                {/each}
              </div>
            {/if}
          </section>
        {/if}
      </section>
    </div>
  {/if}
</nav>
