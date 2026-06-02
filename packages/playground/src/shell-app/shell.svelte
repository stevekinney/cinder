<script lang="ts">
  import { onDestroy } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';

  import Announcer from './announcer.svelte';
  import {
    announceNavigation,
    Announcer as AnnouncerStore,
    setAnnouncer,
  } from './announcer.svelte.ts';
  import { createEventSource } from './event-source.svelte.ts';
  import PreviewFrame, { type PreviewFrameHandle } from './preview-frame.svelte';
  import {
    applyThemeToDocument,
    PreviewStore,
    readPersistedTheme,
    setPreviewStore,
  } from './preview-store.svelte.ts';
  import { buildShellHref, parseComponentFromPath, readToolbarStateFromSearch } from './routing.ts';
  import Sidebar, { type SidebarHandle } from './sidebar.svelte';
  import TopBar from './top-bar.svelte';

  type Props = {
    initialComponent: string;
    components: string[];
  };

  let { initialComponent, components }: Props = $props();

  // Bound to the Sidebar instance so the `/` shortcut can focus its filter.
  let sidebar = $state<SidebarHandle | null>(null);

  // Bound to the PreviewFrame so live-reload events reload through it (re-arming
  // the loading overlay) instead of poking the raw iframe.
  let previewFrame = $state<PreviewFrameHandle | null>(null);

  // Seed the toolbar from the URL (shareable, survives reload). When the URL
  // is silent about theme, fall back to the localStorage preference so the
  // next visit honors the user's last choice.
  const initialSearch =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URL(window.location.href).searchParams;
  const initialUrlState = readToolbarStateFromSearch(initialSearch);
  const initialTheme = initialUrlState.theme ?? readPersistedTheme();
  const store = new PreviewStore(initialComponent, {
    ...initialUrlState,
    theme: initialTheme,
  });
  setPreviewStore(store);

  // Single shared polite live region for the shell. The top bar pushes
  // toolbar feedback through it; client-side navigation (below) announces the
  // newly-viewed component. One instance keeps exactly one live region in the
  // document (two would double-read every message).
  const announcer = new AnnouncerStore();
  setAnnouncer(announcer);

  // Clear any pending live-region announcement if the shell is ever torn down,
  // so a queued setTimeout never fires into a detached component tree. The
  // shell lives for the page lifetime in practice, but cancelling on teardown
  // keeps the announcer leak-free and prevents flaky timer carryover in tests.
  // onDestroy (not a teardown-only $effect) states the intent directly: this is
  // pure lifecycle cleanup that never tracks reactive state.
  onDestroy(() => announcer.cancel());

  // `<main>` is programmatically focusable (tabindex="-1") so keyboard focus
  // can move to the freshly-rendered content after client-side navigation.
  let mainEl = $state<HTMLElement | null>(null);

  // True below the responsive breakpoint, where the sidebar is a modal-style
  // off-canvas drawer rather than a static column. Used to gate the drawer's
  // focus-trap / inert behavior so the wide-viewport sidebar (always visible)
  // never makes the rest of the shell inert. Mirrors the 720px CSS breakpoint.
  const isNarrow = new MediaQuery('max-width: 720px');

  // When the viewport grows past the breakpoint, the drawer is no longer a
  // drawer — it's the static sidebar. Drop the open state so it doesn't linger
  // as a hidden-but-"open" drawer that would (a) re-appear if the viewport
  // narrows again, (b) make Escape close a phantom drawer before exiting focus
  // mode, and (c) leave an orphaned scrim. Closing here also means the
  // focus/inert effect below tears down while the hamburger is still visible,
  // so focus restoration targets a focusable element.
  $effect(() => {
    if (!isNarrow.current && store.isSidebarOpen) store.isSidebarOpen = false;
  });

  // Modal semantics for the narrow-viewport drawer. When it opens we move focus
  // into the drawer's filter and mark the content behind the scrim `inert` so a
  // keyboard / screen-reader user can't tab "behind" the dimmed backdrop. When
  // it closes, the cleanup CLEARS inert *before* restoring focus — order
  // matters: the opener (the hamburger) lives inside `header.top-bar`, so
  // focusing it while the header is still inert would be silently dropped. On
  // wide viewports none of this runs.
  function setShellInert(value: boolean): void {
    const header = document.querySelector<HTMLElement>('header.top-bar');
    if (mainEl) mainEl.inert = value;
    if (header) header.inert = value;
  }

  $effect(() => {
    const drawerIsModal = store.isSidebarOpen && isNarrow.current;

    if (!drawerIsModal) {
      // Not modal (closed, or wide viewport): the content behind it must be
      // reachable. Idempotent — safe to run on every non-modal pass.
      setShellInert(false);
      return;
    }

    setShellInert(true);
    // Capture the opener (the hamburger) before moving focus into the drawer.
    const opener = document.activeElement;
    sidebar?.focusFilter();
    return () => {
      // Clear inert FIRST so the opener is no longer in an inert subtree, then
      // restore focus — but only if the opener is still connected AND focusable
      // (`.focus()` on a display:none element, e.g. the hamburger after a resize
      // to wide, silently strands focus, so skip it then).
      setShellInert(false);
      if (opener instanceof HTMLElement && opener.isConnected && opener.offsetParent !== null) {
        opener.focus();
      }
    };
  });

  // Apply the persisted theme to the shell's root document on first paint.
  // The inline pre-paint script in render-shell.ts already did this before
  // the bundle loaded, but reapplying here keeps the state machine simple
  // (the inline script is a perf optimization, not a correctness gate).
  if (typeof document !== 'undefined') applyThemeToDocument(document, store.theme);

  async function selectComponent(name: string): Promise<void> {
    // Selecting from the off-canvas drawer (narrow viewports) should always
    // dismiss it so the preview is visible — including when the user taps the
    // already-active component, which short-circuits below. Harmless on wide
    // viewports where the drawer is the static sidebar.
    store.isSidebarOpen = false;
    if (name === store.currentComponent) return;
    store.currentComponent = name;
    // Preserve the current query string (e.g. ?focus=1) and hash when
    // navigating between components.
    const { search, hash } = window.location;
    history.pushState({}, '', `${buildShellHref(name)}${search}${hash}`);

    // Title (2.4.2) + live-region announcement (4.1.3) + focus move to the
    // freshly-rendered <main> (2.4.3). Centralized in announceNavigation so the
    // shell and its tests exercise the same code path.
    await announceNavigation(announcer, name, () => mainEl);
  }

  async function handlePopState(): Promise<void> {
    const parsed = parseComponentFromPath(window.location.pathname);
    if (parsed !== null) store.currentComponent = parsed;
    // Re-sync the toolbar (theme/viewport/focus mode) from the URL *before*
    // announcing so the toolbar reflects the restored state by the time focus
    // lands on <main>.
    store.syncFromUrl();
    // Browser back/forward is client-side navigation too: apply the same
    // title + live-region + focus side effects as selectComponent (WCAG
    // 2.4.2 / 4.1.3 / 2.4.3). Guard on a resolved component, mirroring the
    // null check above.
    if (parsed !== null) await announceNavigation(announcer, parsed, () => mainEl);
  }

  /**
   * True when the keystroke originated from somewhere the user is actively
   * typing — a text field, textarea, or contenteditable region. Used to keep
   * the `/` shortcut from hijacking a literal slash the user is typing.
   */
  function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function handleKeydown(event: KeyboardEvent): void {
    // Escape precedence: close the drawer first (if open), otherwise exit focus
    // mode. A single key never does both.
    if (event.key === 'Escape') {
      if (store.isSidebarOpen) {
        store.isSidebarOpen = false;
        return;
      }
      if (store.isFocusMode) {
        store.isFocusMode = false;
        return;
      }
    }
    // `/` focuses the sidebar filter, but only when the user isn't already
    // typing somewhere (so a literal slash in a field is untouched) and isn't
    // holding a modifier (so browser shortcuts like ⌘/ are untouched).
    if (
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !isTypingTarget(event.target)
    ) {
      event.preventDefault();
      sidebar?.focusFilter();
    }
  }

  // The dev server exposes a server-sent-events stream at `/events` for live
  // reload. In SSR (no window), keep the URL null so the EventSource is never
  // constructed.
  const streamUrl = typeof window === 'undefined' ? null : '/events';

  function handleReloadEvent(): void {
    // Reload through the PreviewFrame handle (not the raw iframe) so the loading
    // overlay re-arms during hot reload — a direct contentWindow.reload() keeps
    // the same src, so the overlay would otherwise never show.
    previewFrame?.reload();
  }

  function handleShellReloadEvent(): void {
    window.location.reload();
  }
</script>

<svelte:window onpopstate={handlePopState} onkeydown={handleKeydown} />

<!--
  Layout overview
  ───────────────
  The top bar is fixed and spans the full viewport width. Its height lives
  in the --cinder-top-bar-height custom property (52px), declared once on
  :root by render-shell.ts. Both the sidebar and the main content area push
  their top edge down by that amount so nothing slides behind the bar.

  Focus mode hides both the top bar and the sidebar so the preview fills
  the entire viewport (Escape restores the layout).
-->
<div
  class="shell"
  class:focus-mode={store.isFocusMode}
  {@attach createEventSource(() => streamUrl, {
    events: { reload: handleReloadEvent, 'shell-reload': handleShellReloadEvent },
  })}
>
  <TopBar />
  <Sidebar
    bind:this={sidebar}
    {components}
    currentComponent={store.currentComponent}
    onSelect={selectComponent}
    isOpen={store.isSidebarOpen}
    onClose={() => (store.isSidebarOpen = false)}
  />
  <!--
    Scrim behind the off-canvas drawer (narrow viewports only — kept
    display:none on wide ones via CSS). Clicking it dismisses the drawer. It is
    aria-hidden and not a Tab stop; Escape (handled at the window level) is the
    keyboard path to close.
  -->
  {#if store.isSidebarOpen}
    <div
      class="sidebar-backdrop"
      aria-hidden="true"
      onclick={() => (store.isSidebarOpen = false)}
    ></div>
  {/if}
  <!--
    tabindex="-1" makes <main> programmatically focusable so client-side
    navigation can move keyboard focus to the new content without adding it to
    the Tab order. bind:this gives selectComponent a handle to call .focus().
  -->
  <main bind:this={mainEl} tabindex="-1">
    <PreviewFrame bind:this={previewFrame} componentName={store.currentComponent} />
  </main>
  <Announcer />
</div>

<style>
  /*
   * --cinder-top-bar-height is declared once on :root by render-shell.ts
   * (the shell scaffold's <head> \3c style>). We just read it here for layout
   * math — no local declaration or fallback needed since :root always wins
   * the cascade for an inherited custom property.
   */
  .shell {
    display: flex;
    height: 100vh;
    font-family: var(--cinder-font-sans);
    font-size: var(--cinder-text-base);
    background: var(--cinder-bg);
    color: var(--cinder-text);
  }

  main {
    /*
     * The sidebar is physically anchored at left: 0 with a fixed width of
     * 220px. Push main content past both the sidebar and the fixed top bar.
     * Physical margin-left keeps in sync with the sidebar's physical left
     * anchor — do not convert to logical margin-inline-start.
     */
    /* stylelint-disable-next-line csstools/use-logical */
    margin-left: 220px;
    margin-top: var(--cinder-top-bar-height);
    flex: 1;
    height: calc(100vh - var(--cinder-top-bar-height));
    display: flex;
    flex-direction: column;
    min-width: 0;
    /*
     * <main> is focused programmatically after client-side navigation (it has
     * tabindex="-1" but is never in the Tab order), so a visible focus ring on
     * the whole region would be noise. Suppress it — sighted keyboard users
     * still see focus rings on the interactive controls inside.
     */
    outline: none;
  }

  /* Focus mode: collapse both the fixed top bar and the sidebar */
  .shell.focus-mode :global(header.top-bar) {
    display: none;
  }

  /*
   * Hide the entire fixed sidebar column — not just its <nav> — so the
   * sticky filter input and the column's right border also disappear. The
   * filter lives in .sidebar-chrome above the nav, so hiding only the nav
   * would leave an orphaned 220px search box overlaying the fullscreen
   * preview.
   */
  .shell.focus-mode :global(.sidebar-chrome) {
    display: none;
  }

  .shell.focus-mode main {
    /* stylelint-disable-next-line csstools/use-logical */
    margin-left: 0;
    margin-top: 0;
    height: 100vh;
  }

  /*
   * Scrim behind the off-canvas sidebar drawer. Only meaningful at narrow
   * widths — the {#if store.isSidebarOpen} guard means it's never in the DOM on
   * wide viewports anyway, but the breakpoint keeps it from ever dimming the
   * full desktop layout if the drawer state is somehow set there.
   */
  .sidebar-backdrop {
    display: none;
  }

  /*
   * Narrow viewports: the sidebar is an off-canvas drawer, so the main content
   * column reclaims the full width (no 220px gutter). The drawer floats above
   * via its own fixed positioning + transform.
   */
  @media (max-width: 720px) {
    main {
      /* stylelint-disable-next-line csstools/use-logical */
      margin-left: 0;
    }

    .sidebar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 15;
      background: rgb(0 0 0 / 45%);
      /* Suppress the mobile-browser tap delay on the dismiss-by-tap scrim. */
      touch-action: manipulation;
    }
  }
</style>
