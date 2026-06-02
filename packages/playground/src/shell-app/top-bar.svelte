<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';

  import { getAnnouncer } from './announcer.svelte.ts';
  import type { ThemeChoice } from './preview-store.svelte.ts';
  import { getPreviewStore } from './preview-store.svelte.ts';
  import { buildIframeSrc } from './routing.ts';
  import {
    Button,
    Input,
    Segment,
    SegmentedControl,
    Toolbar,
  } from '../../../components/src/index.ts';

  const store = getPreviewStore();
  const announcer = getAnnouncer();

  // The viewport-size presets (Mobile/Tablet/Desktop/Full + custom px) simulate
  // a narrower preview canvas on a wide screen. Below ~840px the toolbar can't
  // fit them AND they're meaningless (you're already constrained), so the CSS
  // hides that group. 840px (not 720px) because at 768px the 220px brand column
  // still eats most of the bar. When hidden, drop any constrained width so the
  // preview uses the real available space instead of a phantom 1280px box.
  const hidesViewportControls = new MediaQuery('(max-width: 840px)');
  $effect(() => {
    if (hidesViewportControls.current && store.previewWidth !== null) {
      store.previewWidth = null;
    }
  });

  // Forward toolbar feedback to the shell's single shared live region. The
  // empty-then-set coalescing trick (so identical repeats still read) lives
  // in the Announcer; see announcer.svelte.ts.
  function announce(text: string): void {
    announcer.announce(text);
  }

  // ── Viewport presets ──────────────────────────────────────────────────────
  // SegmentedControl requires string values. Numeric preset widths are keyed
  // as their string form ('375', '768', '1280'); null maps to 'full'.

  const VIEWPORT_PRESETS = [
    { label: 'Mobile', value: 375, key: '375' },
    { label: 'Tablet', value: 768, key: '768' },
    { label: 'Desktop', value: 1280, key: '1280' },
    { label: 'Full', value: null, key: 'full' },
  ] as const;

  const VIEWPORT_SEGMENTED_OPTIONS = VIEWPORT_PRESETS.map((preset) => ({
    value: preset.key,
    label: preset.value !== null ? `${preset.label} (${preset.value} pixels)` : preset.label,
  }));

  // Derive the SegmentedControl value from store.previewWidth. When no preset
  // matches exactly (custom width), pass `undefined` so SegmentedControl
  // renders without a selected segment instead of trying to select a phantom
  // option — the custom-width number field is the visual indicator of custom
  // mode.
  let viewportPresetKey = $derived<string | undefined>(
    store.previewWidth === null
      ? 'full'
      : VIEWPORT_PRESETS.find((p) => p.value === store.previewWidth)?.key,
  );

  // The custom-width number field is only visible when the viewport is
  // constrained to a numeric value (i.e., previewWidth is not null).
  let isCustomWidthVisible = $derived(store.previewWidth !== null);

  function handleViewportChange(key: string): void {
    const preset = VIEWPORT_PRESETS.find((p) => p.key === key);
    if (preset === undefined) return;
    store.previewWidth = preset.value;
    announce(`Viewport: ${preset.label}${preset.value !== null ? `, ${preset.value} pixels` : ''}`);
  }

  function handleCustomWidthChange(newValue: number | null): void {
    // An empty or otherwise non-numeric field surfaces as `newValue === null`.
    // Treat that as "keep the current width" — the user navigates to Full via
    // the SegmentedControl, not by clearing this input. Without this guard,
    // clearing-to-retype kicks the user out of custom-width mode and hides the
    // input mid-edit.
    if (newValue === null) return;
    store.previewWidth = newValue;
    announce(`Viewport: custom, ${newValue} pixels`);
  }

  // Native <input type="number"> surfaces its value as a string on the change
  // event (empty when the field is cleared). Coerce to `number | null` so
  // `handleCustomWidthChange` keeps its numeric contract.
  function handleCustomWidthInput(event: Event & { currentTarget: HTMLInputElement }): void {
    const raw = event.currentTarget.value.trim();
    const parsed = raw === '' ? Number.NaN : Number(raw);
    handleCustomWidthChange(Number.isFinite(parsed) ? parsed : null);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────
  // setTheme is the only legitimate write path — it also persists to
  // localStorage and updates the document's color-scheme. Never assign
  // store.theme directly.

  // Short visible labels keep the control compact enough to fit a phone-width
  // toolbar; the SegmentedControl's `label="Color scheme"` supplies the group
  // context, and `announce` uses the full phrase for assistive tech. There is no
  // 'System' option: with no explicit choice the playground follows the browser
  // preference live, and the control highlights whichever theme is resolved.
  const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string; announce: string }> = [
    { value: 'light', label: 'Light', announce: 'Light theme' },
    { value: 'dark', label: 'Dark', announce: 'Dark theme' },
  ];

  function selectTheme(value: ThemeChoice): void {
    store.setTheme(value);
    const option = THEME_OPTIONS.find((o) => o.value === value);
    announce(`Color scheme: ${option?.announce ?? value}`);
  }

  // ── Sidebar drawer (narrow viewports) ──────────────────────────────────────
  // The menu button is only visible below the responsive breakpoint (CSS), but
  // toggling shell-local state is harmless on wide viewports where the sidebar
  // is always in view.

  function toggleSidebar(): void {
    store.isSidebarOpen = !store.isSidebarOpen;
    announce(store.isSidebarOpen ? 'Component list shown' : 'Component list hidden');
  }

  // ── Focus mode ────────────────────────────────────────────────────────────

  function toggleFocusMode(): void {
    store.isFocusMode = !store.isFocusMode;
    // Entering focus mode hides the sidebar entirely; close the narrow-viewport
    // drawer too so it doesn't leave an orphaned full-screen scrim with no
    // visible dismiss affordance behind the now-hidden chrome.
    if (store.isFocusMode) store.isSidebarOpen = false;
    announce(store.isFocusMode ? 'Focus mode on. Press Escape to exit.' : 'Focus mode off');
  }

  // ── Open in new tab ───────────────────────────────────────────────────────
  // Opens the isolated /page/:name route in a fresh tab. The button is hidden
  // when no component is selected so we never open a /page/ URL with an empty
  // name. `noopener` severs the new tab's `window.opener` reference for safety.

  function openInNewTab(): void {
    if (store.currentComponent === '') return;
    // Reuse buildIframeSrc so the component name is encodeURIComponent-escaped
    // exactly like every other /page/:name URL the shell builds (and like the
    // preview-frame tests assert), then make it absolute for window.open.
    const url = `${window.location.origin}${buildIframeSrc(store.currentComponent)}`;
    window.open(url, '_blank', 'noopener');
    announce(`Opened ${store.currentComponent} preview in a new tab`);
  }
</script>

<header class="top-bar">
  <div class="top-bar__brand">
    <button
      type="button"
      class="sidebar-toggle"
      aria-label="Toggle component list"
      aria-expanded={store.isSidebarOpen}
      aria-controls="sidebar-drawer"
      onclick={toggleSidebar}
    >
      <span aria-hidden="true">☰</span>
    </button>
    <span class="wordmark" aria-label="Cinder design system">cinder</span>
  </div>

  <Toolbar class="top-bar__toolbar" aria-label="Preview controls">
    <Toolbar.Group>
      <span class="component-name" title={store.currentComponent} aria-label="Current component">
        {store.currentComponent || ' '}
      </span>
    </Toolbar.Group>

    <Toolbar.Group class="viewport-size-controls">
      <SegmentedControl
        id="viewport-preset"
        label="Viewport width"
        hideLabel
        density="toolbar"
        {...viewportPresetKey !== undefined ? { value: viewportPresetKey } : {}}
        disallowEmptySelection={false}
        onchange={handleViewportChange}
      >
        {#each VIEWPORT_SEGMENTED_OPTIONS as option (option.value)}
          <Segment value={option.value}>{option.label}</Segment>
        {/each}
      </SegmentedControl>

      {#if isCustomWidthVisible}
        <!-- A native <input type="number"> renders the value as a plain integer
             ("1280", never the locale-grouped "1,280") and exposes the browser's
             spinner. Its field is inline-size:100% and would otherwise stretch to
             fill the toolbar row, crushing the segmented controls — the
             .width-input wrapper pins it to a fixed width wide enough for a
             four-digit value plus the spinner. The block only renders when
             previewWidth is a number, so String(...) is always a bare integer. -->
        <span class="width-input">
          <Input
            id="viewport-width-input"
            type="number"
            value={String(store.previewWidth)}
            min={200}
            max={3840}
            step={1}
            aria-label="Custom viewport width in pixels (200 to 3840)"
            onchange={handleCustomWidthInput}
          />
        </span>
        <span class="unit" aria-hidden="true">px</span>
      {/if}
    </Toolbar.Group>

    <Toolbar.Group>
      <SegmentedControl
        id="theme-preset"
        label="Color scheme"
        hideLabel
        density="toolbar"
        value={store.theme}
        onchange={selectTheme}
      >
        {#each THEME_OPTIONS as option (option.value)}
          <Segment value={option.value}>{option.label}</Segment>
        {/each}
      </SegmentedControl>
    </Toolbar.Group>

    <Toolbar.Spacer />

    <Toolbar.Group>
      {#if store.currentComponent !== ''}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Open preview in new tab"
          onclick={openInNewTab}
        >
          <span aria-hidden="true">↗</span>
        </Button>
      {/if}

      <Button
        variant="ghost"
        size="sm"
        aria-pressed={store.isFocusMode}
        aria-label="Focus mode — hide sidebar and toolbar (press Escape to exit)"
        onclick={toggleFocusMode}
      >
        <span aria-hidden="true">⛶</span>
      </Button>
    </Toolbar.Group>
  </Toolbar>
</header>

<style>
  /* ============================================================
   * TOP BAR
   * A single full-width bar that unifies the "CINDER" wordmark
   * (left, sidebar-column width) with the preview toolbar (right,
   * filling the remaining space). Both regions share one height so
   * the horizontal rule formed by the bar's bottom border runs wall
   * to wall without a seam.
   * ============================================================ */

  .top-bar {
    /*
     * Height reads from the shared --cinder-top-bar-height token, declared
     * once on :root by render-shell.ts. The sidebar and main column reference
     * the same token for their top offset, so all three stay in sync.
     */
    box-sizing: border-box;
    height: var(--cinder-top-bar-height);
    background: var(--cinder-surface);
    border-bottom: 1px solid var(--cinder-border);
    display: flex;
    align-items: center;
    flex-shrink: 0;
    /* Span full viewport width across both the sidebar column and main column */
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
  }

  .top-bar__brand {
    display: flex;
    align-items: center;
    height: 100%;
    flex-shrink: 0;
  }

  /*
   * Hamburger that opens the off-canvas sidebar drawer. Hidden on wide
   * viewports (the sidebar is always visible there); shown below the 720px
   * breakpoint where the sidebar slides off canvas.
   */
  .sidebar-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    /* 44px wide to meet the WCAG 2.5.5 pointer target size (the full bar height
       already exceeds it); matches the in-drawer close button. */
    /* stylelint-disable-next-line csstools/use-logical */
    width: 2.75rem;
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--cinder-text);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  .sidebar-toggle:hover {
    color: var(--cinder-text-subtle);
  }

  /* No local :focus-visible rule — the foundation.css global default paints the
     baseline accent ring (per docs/focus-ring-policy.md), and inventing a
     colored outline here would violate cinder/no-focus-visible-colored-outline. */

  .top-bar :global(.cinder-toolbar) {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    background: transparent;
    min-width: 0;
  }

  /* ── Wordmark ── */
  .wordmark {
    /* Match the sidebar width exactly so the bar's left block aligns with
       the nav list below it. Physical width keeps it in sync with sidebar's
       physical left anchor. */
    /* stylelint-disable-next-line csstools/use-logical */
    width: 220px;
    min-width: 220px;
    padding: 0 16px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--cinder-text-subtle);
    /* stylelint-disable-next-line csstools/use-logical */
    border-right: 1px solid var(--cinder-border);
    flex-shrink: 0;
    /* Vertically center the text within the bar */
    display: flex;
    align-items: center;
    height: 100%;
    box-sizing: border-box;
  }

  .top-bar :global(.top-bar__toolbar) {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    padding: 0 12px;
    overflow-x: auto;
    height: 100%;
  }

  .top-bar :global(.cinder-toolbar__group) {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  /*
   * Keep segmented-control labels on a single line. Cinder's toolbar-density
   * segments have no `white-space: nowrap`, so a long label ("Mobile (375
   * pixels)") wraps to two/three cramped lines the moment the row tightens —
   * which is exactly what mangled the toolbar when a viewport preset was
   * selected. Force single-line segments.
   */
  .top-bar :global(.cinder-segmented-control-option) {
    white-space: nowrap;
  }

  /*
   * The custom-width number field is inline-size:100% by default and would
   * stretch across the whole toolbar. Pin it to a fixed width so it never
   * crushes the segmented controls beside it. Narrower than the old stepper
   * field — the native spinner is slimmer than NumberInput's two steppers, but
   * a four-digit value plus the spinner still needs more than a default field.
   */
  .width-input {
    display: inline-flex;
    /* Wide enough for a four-digit value plus the native number spinner. */
    /* stylelint-disable-next-line csstools/use-logical */
    width: 6.5rem;
    flex: 0 0 auto;
  }

  .width-input :global(.cinder-input-field),
  .width-input :global(.cinder-input) {
    /* stylelint-disable-next-line csstools/use-logical */
    width: 100%;
  }

  .component-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--cinder-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 0 1 200px;
    min-width: 0;
  }

  .unit {
    font-size: 11px;
    color: var(--cinder-text-subtle);
    padding-inline-start: 3px;
    flex-shrink: 0;
  }

  /*
   * Narrow viewports: surface the hamburger and collapse the brand block down
   * to just the toggle so the toolbar gets the room it needs. The wordmark's
   * fixed 220px width (which mirrors the wide sidebar column) is dropped here
   * since there's no static sidebar column to align with.
   */
  @media (max-width: 720px) {
    .sidebar-toggle {
      display: inline-flex;
    }

    .wordmark {
      /* stylelint-disable-next-line csstools/use-logical */
      width: auto;
      /* stylelint-disable-next-line csstools/use-logical */
      min-width: 0;
      padding-inline: var(--cinder-space-2);
      /* stylelint-disable-next-line csstools/use-logical */
      border-right: none;
    }
  }

  /*
   * The viewport-size presets (Mobile/Tablet/Desktop/Full + custom px) simulate
   * a narrower canvas on a wide screen — meaningless once the screen itself is
   * narrow, and the controls that overflow/overlap the toolbar at these widths.
   * Hide the whole group below 840px (768px still carries the 220px brand
   * column, so the bar is most pinched there); the script resets previewWidth
   * to Full so the preview uses the real width. The theme control + icon buttons
   * fit comfortably without them.
   */
  @media (max-width: 840px) {
    .top-bar :global(.viewport-size-controls) {
      display: none;
    }
  }

  /* Below the phone breakpoint the wordmark and the redundant component-name
     label are just noise next to the menu button and controls — the page title
     and the sidebar already name the component. Hide them so the toolbar wins
     the space. */
  @media (max-width: 520px) {
    .wordmark,
    .component-name {
      display: none;
    }
  }
</style>
