<script lang="ts">
  import { getAnnouncer } from './announcer.svelte.ts';
  import type { BackgroundChoice, ThemeChoice } from './preview-store.svelte.ts';
  import { getPreviewStore } from './preview-store.svelte.ts';
  import { buildIframeSrc } from './routing.ts';
  import {
    Button,
    NumberInput,
    Segment,
    SegmentedControl,
    Toolbar,
  } from '../../../components/src/index.ts';

  const store = getPreviewStore();
  const announcer = getAnnouncer();

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
  // option — the NumberInput is the visual indicator of custom mode.
  let viewportPresetKey = $derived<string | undefined>(
    store.previewWidth === null
      ? 'full'
      : VIEWPORT_PRESETS.find((p) => p.value === store.previewWidth)?.key,
  );

  // The custom width NumberInput is only visible when the viewport is
  // constrained to a numeric value (i.e., previewWidth is not null).
  let isCustomWidthVisible = $derived(store.previewWidth !== null);

  function handleViewportChange(key: string): void {
    const preset = VIEWPORT_PRESETS.find((p) => p.key === key);
    if (preset === undefined) return;
    store.previewWidth = preset.value;
    announce(`Viewport: ${preset.label}${preset.value !== null ? `, ${preset.value} pixels` : ''}`);
  }

  function handleCustomWidthChange(newValue: number | null): void {
    // NumberInput defers commit to blur; clearing the input then blurring
    // surfaces as `newValue === null`. Treat that as "keep the current width"
    // — the user navigates to Full via the SegmentedControl, not by clearing
    // this input. Without this guard, clearing-to-retype kicks the user out
    // of custom-width mode and hides the input mid-edit.
    if (newValue === null) return;
    store.previewWidth = newValue;
    announce(`Viewport: custom, ${newValue} pixels`);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────
  // setTheme is the only legitimate write path — it also persists to
  // localStorage and updates the document's color-scheme. Never assign
  // store.theme directly.

  const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
    { value: 'light', label: 'Light theme' },
    { value: 'system', label: 'System theme' },
    { value: 'dark', label: 'Dark theme' },
  ];

  function selectTheme(value: ThemeChoice): void {
    store.setTheme(value);
    const option = THEME_OPTIONS.find((o) => o.value === value);
    announce(`Color scheme: ${option?.label ?? value}`);
  }

  // ── Background ────────────────────────────────────────────────────────────

  let isCheckerActive = $derived(store.background === 'checker');

  function toggleCheckerboard(): void {
    const next: BackgroundChoice = store.background === 'checker' ? 'surface' : 'checker';
    store.background = next;
    announce(next === 'checker' ? 'Checkerboard background on' : 'Checkerboard background off');
  }

  // ── Focus mode ────────────────────────────────────────────────────────────

  function toggleFocusMode(): void {
    store.isFocusMode = !store.isFocusMode;
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
    <span class="wordmark" aria-label="Cinder design system">cinder</span>
  </div>

  <Toolbar class="top-bar__toolbar" aria-label="Preview controls">
    <Toolbar.Group>
      <span class="component-name" title={store.currentComponent} aria-label="Current component">
        {store.currentComponent || ' '}
      </span>
    </Toolbar.Group>

    <Toolbar.Group>
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
        <NumberInput
          id="viewport-width-input"
          value={store.previewWidth}
          min={200}
          max={3840}
          step={1}
          aria-label="Custom viewport width in pixels (200 to 3840)"
          onchange={handleCustomWidthChange}
        />
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

      <Button
        variant="ghost"
        size="sm"
        aria-pressed={isCheckerActive}
        aria-label="Show transparency grid"
        onclick={toggleCheckerboard}
      >
        <span aria-hidden="true">▦</span>
      </Button>
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
</style>
