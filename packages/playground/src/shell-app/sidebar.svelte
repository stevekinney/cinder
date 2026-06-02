<script lang="ts" module>
  /**
   * Imperative handle a parent obtains via `bind:this`. Naming the exported API
   * surface explicitly (rather than relying on `ReturnType<typeof Sidebar>`,
   * which resolves to Svelte's opaque internal component type) keeps the
   * binding's type tied to what the component actually exports.
   */
  export type SidebarHandle = { focusFilter(): void };
</script>

<script lang="ts">
  import {
    Input,
    SideNavigation,
    SideNavigationItem,
    VisuallyHidden,
  } from '../../../components/src/index.ts';
  import { humanizeComponentName } from './humanize.ts';
  import { buildShellHref } from './routing.ts';
  import { persistScrollPosition } from './sidebar-scroll.ts';

  type Props = {
    components: string[];
    currentComponent: string;
    onSelect: (componentName: string) => void;
    /**
     * Narrow-viewport drawer state. On wide viewports the sidebar is always in
     * view and this is ignored; below the breakpoint the column slides off
     * canvas unless `isOpen` is true.
     */
    isOpen?: boolean;
    /**
     * Dismiss the narrow-viewport drawer. Wired to the in-drawer close button so
     * pointer users have an explicit close affordance (the hamburger is covered
     * by the open drawer).
     */
    onClose?: () => void;
  };

  let { components, currentComponent, onSelect, isOpen = false, onClose }: Props = $props();

  let filter = $state('');

  // The cinder Input owns its native <input> and does not forward a ref, so
  // the focus handle resolves the element by its stable id. The id is unique
  // to this single sidebar instance.
  const FILTER_INPUT_ID = 'sidebar-filter';

  /** Focus and select the filter text. Exposed for the `/` keyboard shortcut. */
  export function focusFilter(): void {
    const element = document.getElementById(FILTER_INPUT_ID);
    if (element instanceof HTMLInputElement) {
      element.focus();
      element.select();
    }
  }

  // Case-insensitive substring match against both the humanized label and the
  // raw kebab name, so "side nav" and "side-nav" both find side-navigation.
  const visibleComponents = $derived.by(() => {
    const needle = filter.trim().toLowerCase();
    if (needle === '') return components;
    return components.filter((name) => {
      if (name.toLowerCase().includes(needle)) return true;
      return humanizeComponentName(name).toLowerCase().includes(needle);
    });
  });

  // Announced to assistive technology whenever the filtered count changes.
  const resultSummary = $derived(
    `${visibleComponents.length} component${visibleComponents.length === 1 ? '' : 's'} shown`,
  );

  function handleClick(event: MouseEvent, componentName: string): void {
    // Only intercept plain left-clicks. Modified clicks (cmd/ctrl/shift/alt)
    // and middle-clicks fall through to native browser navigation so
    // open-in-new-tab, "Copy Link Address", and status-bar URL preview all
    // continue to work like regular anchor semantics.
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(componentName);
  }

  function handleFilterKeydown(event: KeyboardEvent): void {
    // Escape clears the filter (and keeps focus so typing can resume).
    if (event.key === 'Escape' && filter !== '') {
      event.preventDefault();
      // Stop the shell's window-level Escape handler from also acting on this
      // keystroke (e.g. exiting focus mode) when the user only meant to clear
      // the filter.
      event.stopPropagation();
      filter = '';
    }
  }
</script>

<!--
  The top bar is fixed and 52px tall. The sidebar is also fixed but its
  top edge starts below the top bar so it never overlaps the wordmark or
  toolbar controls. The height and top values reference the shared
  --cinder-top-bar-height token, declared once on :root by render-shell.ts.
-->
<div
  id="sidebar-drawer"
  class="sidebar-chrome"
  class:is-open={isOpen}
  {@attach persistScrollPosition}
>
  <div class="sidebar-filter">
    <Input
      id={FILTER_INPUT_ID}
      type="search"
      bind:value={filter}
      placeholder="Filter components…"
      aria-label="Filter components"
      autocomplete="off"
      autocapitalize="off"
      spellcheck={false}
      onkeydown={handleFilterKeydown}
    />
    <!-- Close affordance for the narrow-viewport drawer. Hidden on wide
         viewports (CSS) where the sidebar is always in view. The open drawer
         covers the top bar's hamburger, so this is the in-drawer dismiss. -->
    <button type="button" class="sidebar-close" aria-label="Close component list" onclick={onClose}>
      <span aria-hidden="true">✕</span>
    </button>
  </div>
  <SideNavigation ariaLabel="Components">
    {#each visibleComponents as name (name)}
      <SideNavigationItem
        href={buildShellHref(name)}
        active={name === currentComponent}
        onclick={(event) => handleClick(event, name)}
      >
        {humanizeComponentName(name)}
      </SideNavigationItem>
    {/each}
  </SideNavigation>
  {#if visibleComponents.length === 0}
    <!-- Visible text only — NOT a live region. The persistent aria-live region
         below ("N components shown") is the single announcement source; marking
         this paragraph role="status" too would double-announce on zero results. -->
    <p class="sidebar-empty">No components match “{filter}”.</p>
  {/if}
  <!--
    Always-present polite live region. Kept outside the {#if} above so it
    stays in the DOM across filter changes — that is what lets screen
    readers announce the updated count on every keystroke (WCAG 4.1.3).
  -->
  <VisuallyHidden as="p" aria-live="polite" aria-atomic="true">{resultSummary}</VisuallyHidden>
</div>

<style>
  .sidebar-chrome {
    /* stylelint-disable-next-line csstools/use-logical */
    width: 220px;
    min-width: 220px;
    /* Push the sidebar below the fixed top bar */
    height: calc(100vh - var(--cinder-top-bar-height));
    position: fixed;
    top: var(--cinder-top-bar-height);
    left: 0;
    background: var(--cinder-surface);
    /* Playground sidebar is physically anchored at left: 0; keep the
       separator physical so it stays adjacent to the main content. */
    /* stylelint-disable-next-line csstools/use-logical */
    border-right: 1px solid var(--cinder-border);
    overflow-y: auto;
    /* Above the preview/main content so the off-canvas drawer (narrow
       viewports) overlays it rather than being clipped behind. */
    z-index: 9;
  }

  .sidebar-filter {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2, 0.5rem);
    padding: var(--cinder-space-2, 0.5rem);
    background: var(--cinder-surface);
    border-bottom: 1px solid var(--cinder-border);
  }

  .sidebar-filter :global(.cinder-input-field) {
    flex: 1;
    /* stylelint-disable-next-line csstools/use-logical */
    min-width: 0;
  }

  /* Close button is drawer-only; hidden until the narrow breakpoint reveals it. */
  .sidebar-close {
    display: none;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    /* 44px square — meets the WCAG 2.5.5 pointer target size for this
       phone-only control. */
    /* stylelint-disable-next-line csstools/use-logical */
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border: none;
    border-radius: var(--cinder-radius-sm, 0.25rem);
    background: transparent;
    color: var(--cinder-text);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }

  @media (hover: hover) {
    .sidebar-close:hover {
      background: var(--cinder-surface-hover, var(--cinder-surface-inset));
    }
  }

  /*
   * Inset the navigation list off the column edges so the links don't sit
   * flush against the viewport border, and tighten the per-row density so the
   * long component list reads as a compact index rather than a list of fat
   * touch targets. These override cinder's global navigation-item spacing
   * (which has no per-component style hook), scoped to the playground sidebar.
   */
  .sidebar-chrome :global(.cinder-side-navigation__list) {
    padding-block: var(--cinder-space-1, 0.25rem);
    padding-inline: var(--cinder-space-2, 0.5rem);
    gap: 0;
  }

  .sidebar-chrome :global(.cinder-navigation-item) {
    min-height: 0;
    padding-block: var(--cinder-space-1, 0.25rem);
    padding-inline: var(--cinder-space-2, 0.5rem);
    border-radius: var(--cinder-radius-sm, 0.25rem);
  }

  .sidebar-empty {
    margin: 0;
    padding: var(--cinder-space-3, 0.75rem) var(--cinder-space-2, 0.5rem);
    color: var(--cinder-text-muted, var(--cinder-text));
    font-size: var(--cinder-text-sm, 0.875rem);
  }

  /*
   * Off-canvas drawer for narrow viewports. The shell adds `is-open` when the
   * top bar's menu button toggles it; otherwise the column slides out of view
   * to the inline-start edge. Above the wide breakpoint the transform/visibility
   * rules are inert (the column is statically in-flow via the fixed anchor).
   */
  @media (max-width: 720px) {
    .sidebar-chrome {
      /* Full top-to-bottom so the drawer covers the viewport height. dvh (not
         vh) so the bottom of the scrollable list isn't hidden behind mobile
         browser chrome — matches cinder's drawer/sheet/modal convention. A hair
         wider for comfortable reading on a phone. */
      height: 100dvh;
      top: 0;
      /* stylelint-disable-next-line csstools/use-logical */
      width: min(85vw, 280px);
      /* stylelint-disable-next-line csstools/use-logical */
      min-width: min(85vw, 280px);
      z-index: 20;
      transform: translateX(-100%);
      transition:
        transform 0.2s ease,
        visibility 0.2s;
      box-shadow: var(--cinder-shadow-lg, 0 10px 25px rgb(0 0 0 / 25%));
      /* Closed drawer is removed from the a11y tree and Tab order — a purely
         off-canvas transform leaves its filter input and nav links focusable
         (a keyboard user would land on invisible controls), contradicting the
         toggle's aria-expanded="false". visibility:hidden is animatable so the
         slide-out still plays before the panel goes inert. */
      visibility: hidden;
    }

    .sidebar-chrome.is-open {
      transform: translateX(0);
      visibility: visible;
    }

    @media (prefers-reduced-motion: reduce) {
      .sidebar-chrome {
        transition: none;
      }
    }

    /* On a phone the drawer floats over the top bar too, so re-create the
       filter's offset from the very top of the viewport. */
    .sidebar-filter {
      padding-block-start: var(--cinder-space-3, 0.75rem);
    }

    .sidebar-close {
      display: inline-flex;
    }

    /* Restore comfortable touch targets in the drawer. The compact desktop
       density (min-height:0, 4px padding) makes ~32px rows that are too small
       and too tightly packed for a finger; give phone users a 44px row
       (WCAG 2.5.5) with real vertical breathing room. */
    .sidebar-chrome :global(.cinder-side-navigation__list) {
      gap: var(--cinder-space-1, 0.25rem);
    }

    .sidebar-chrome :global(.cinder-navigation-item) {
      min-height: 2.75rem;
      padding-block: var(--cinder-space-2, 0.5rem);
    }
  }
</style>
