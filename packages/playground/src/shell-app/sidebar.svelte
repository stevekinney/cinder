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
  };

  let { components, currentComponent, onSelect }: Props = $props();

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
<div class="sidebar-chrome" {@attach persistScrollPosition}>
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
  }

  .sidebar-filter {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: var(--cinder-space-2, 0.5rem);
    background: var(--cinder-surface);
    border-bottom: 1px solid var(--cinder-border);
  }

  .sidebar-empty {
    margin: 0;
    padding: var(--cinder-space-3, 0.75rem) var(--cinder-space-2, 0.5rem);
    color: var(--cinder-text-muted, var(--cinder-text));
    font-size: var(--cinder-text-sm, 0.875rem);
  }
</style>
