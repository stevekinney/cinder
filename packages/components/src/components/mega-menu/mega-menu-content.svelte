<script lang="ts">
  import { tick } from 'svelte';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import type { MegaMenuItem } from './mega-menu.types.ts';

  interface Props {
    item: MegaMenuItem;
    motionDirection: 'none' | 'from-start' | 'from-end';
    resolvedDirection: 'ltr' | 'rtl' | undefined;
    contentId: (itemId: string) => string;
    triggerId: (itemId: string) => string;
    submenuTriggerId: (itemId: string, submenuId: string) => string;
    submenuPanelId: (itemId: string, submenuId: string) => string;
    elementById: <T extends HTMLElement = HTMLElement>(id: string) => T | null;
    focusElementById: (id: string) => void;
    closeMenu: (restoreFocus?: boolean) => void;
  }

  let {
    item,
    motionDirection,
    resolvedDirection,
    contentId,
    triggerId,
    submenuTriggerId,
    submenuPanelId,
    elementById,
    focusElementById,
    closeMenu,
  }: Props = $props();

  let openSubmenuId = $state<string | null>(null);
  const openSubmenu = $derived.by(() => {
    if (!item.submenu?.length || !openSubmenuId) return item.submenu?.[0] ?? null;
    return item.submenu.find((entry) => entry.id === openSubmenuId) ?? item.submenu[0] ?? null;
  });

  function sections(menuItem: MegaMenuItem | null) {
    return menuItem?.sections ?? [];
  }

  function focusSubmenuTriggerAt(index: number) {
    if (!item.submenu?.length || typeof document === 'undefined') return;
    const bounded = ((index % item.submenu.length) + item.submenu.length) % item.submenu.length;
    const target = item.submenu[bounded];
    if (!target) return;
    openSubmenuId = target.id;
    focusElementById(submenuTriggerId(item.id, target.id));
  }

  async function focusSubmenuPanel(submenuId: string) {
    if (typeof document === 'undefined') return;
    await tick();
    const panel = elementById(submenuPanelId(item.id, submenuId));
    if (!(panel instanceof HTMLElement)) return;
    const firstFocusable = panel.querySelector<HTMLElement>('a[href], button:not([disabled])');
    (firstFocusable ?? panel).focus();
  }

  function submenuHorizontalKeys(): {
    enter: 'ArrowLeft' | 'ArrowRight';
    return: 'ArrowLeft' | 'ArrowRight';
  } {
    const isRightToLeft = resolvedDirection === 'rtl';
    return isRightToLeft
      ? { enter: 'ArrowLeft', return: 'ArrowRight' }
      : { enter: 'ArrowRight', return: 'ArrowLeft' };
  }

  function isModifiedHorizontalArrow(event: KeyboardEvent): boolean {
    return (
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
      (event.altKey || event.ctrlKey || event.metaKey)
    );
  }

  function onSubmenuChange(submenuId: string) {
    openSubmenuId = submenuId;
  }

  function onSubmenuTriggerKeydown(event: KeyboardEvent, index: number) {
    if (isModifiedHorizontalArrow(event)) return;
    if (
      (event.key === 'Home' || event.key === 'End') &&
      (event.altKey || event.ctrlKey || event.metaKey)
    )
      return;
    const horizontalKeys = submenuHorizontalKeys();
    if (event.key === horizontalKeys.enter) {
      event.preventDefault();
      if (item.submenu?.[index]) {
        const submenuId = item.submenu[index].id;
        openSubmenuId = submenuId;
        void focusSubmenuPanel(submenuId);
      }
      return;
    }
    if (event.key === horizontalKeys.return) {
      event.preventDefault();
      focusElementById(triggerId(item.id));
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusSubmenuTriggerAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusSubmenuTriggerAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusSubmenuTriggerAt(0);
        break;
      case 'End':
        event.preventDefault();
        if (item.submenu) focusSubmenuTriggerAt(item.submenu.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (item.submenu?.[index]) {
          const submenuId = item.submenu[index].id;
          openSubmenuId = submenuId;
          void focusSubmenuPanel(submenuId);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu(true);
        break;
      default:
        break;
    }
  }

  function onSubmenuPanelKeydown(event: KeyboardEvent) {
    if (isModifiedHorizontalArrow(event)) return;
    if (event.key === submenuHorizontalKeys().return && openSubmenu) {
      event.preventDefault();
      event.stopPropagation();
      focusElementById(submenuTriggerId(item.id, openSubmenu.id));
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    }
  }

  function onContentKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeMenu(true);
  }
</script>

<!-- Keyboard events are delegated from focusable descendants, with tabindex as the empty-panel fallback. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  id={contentId(item.id)}
  class="cinder-mega-menu__content"
  role="group"
  aria-labelledby={triggerId(item.id)}
  tabindex="-1"
  data-motion={motionDirection}
  onkeydown={onContentKeydown}
>
  <div class="cinder-mega-menu__sections">
    {#each sections(item) as section (section.id)}
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

  {#if item.submenu && item.submenu.length > 0}
    <section class="cinder-mega-menu__sub" aria-label={`${item.label} submenu`}>
      <ul class="cinder-mega-menu__submenu-list">
        {#each item.submenu as sub, subIndex (sub.id)}
          <li>
            <button
              id={submenuTriggerId(item.id, sub.id)}
              type="button"
              class="cinder-mega-menu__submenu-trigger"
              aria-controls={openSubmenu?.id === sub.id
                ? submenuPanelId(item.id, sub.id)
                : undefined}
              aria-expanded={openSubmenu?.id === sub.id ? 'true' : 'false'}
              data-active={openSubmenu?.id === sub.id ? 'true' : 'false'}
              onmouseenter={() => onSubmenuChange(sub.id)}
              onclick={() => onSubmenuChange(sub.id)}
              onfocus={() => onSubmenuChange(sub.id)}
              onkeydown={(event) => onSubmenuTriggerKeydown(event, subIndex)}
            >
              {sub.label}
              {#if resolvedDirection === 'rtl'}
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              {:else}
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              {/if}
            </button>
          </li>
        {/each}
      </ul>

      {#if openSubmenu}
        <!-- Keyboard events are delegated from links, with tabindex as the empty-panel fallback. -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          id={submenuPanelId(item.id, openSubmenu.id)}
          class="cinder-mega-menu__sections cinder-mega-menu__submenu-panel"
          role="group"
          aria-labelledby={submenuTriggerId(item.id, openSubmenu.id)}
          tabindex="-1"
          onkeydown={onSubmenuPanelKeydown}
        >
          {#each sections(openSubmenu) as section (section.id)}
            <section>
              {#if section.title && section.title !== openSubmenu.label}
                <h4 class="cinder-mega-menu__section-title">{section.title}</h4>
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
      {/if}
    </section>
  {/if}
</section>
