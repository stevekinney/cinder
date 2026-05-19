<script lang="ts">
  import type { BackgroundChoice, ThemeChoice } from './preview-store.svelte.ts';
  import { getPreviewStore } from './preview-store.svelte.ts';

  const store = getPreviewStore();

  const VIEWPORT_PRESETS: ReadonlyArray<{ label: string; abbrev: string; value: number | null }> = [
    { label: 'Mobile', abbrev: '375', value: 375 },
    { label: 'Tablet', abbrev: '768', value: 768 },
    { label: 'Desktop', abbrev: '1280', value: 1280 },
    { label: 'Full', abbrev: 'Full', value: null },
  ];

  const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string; glyph: string }> = [
    { value: 'light', label: 'Light theme', glyph: '☀' },
    { value: 'system', label: 'System theme', glyph: '◐' },
    { value: 'dark', label: 'Dark theme', glyph: '☾' },
  ];

  // Background is a binary toggle: themed surface (default) ↔ transparency
  // grid. Light vs dark is handled by the theme switcher next to this control.

  // Local input state for the custom width box so a partial value (e.g. user
  // mid-typing "12") doesn't blow away the iframe size on every keystroke.
  let customWidthDraft = $state<string>('');

  $effect(() => {
    customWidthDraft = store.previewWidth === null ? '' : String(store.previewWidth);
  });

  function commitCustomWidth(): void {
    const raw = customWidthDraft.trim();
    if (raw === '') {
      store.previewWidth = null;
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed < 200 || parsed > 3840) {
      // Snap back to the current value.
      customWidthDraft = store.previewWidth === null ? '' : String(store.previewWidth);
      return;
    }
    store.previewWidth = parsed;
  }

  function handleCustomKeydown(event: KeyboardEvent): void {
    const input = event.currentTarget;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitCustomWidth();
      if (input instanceof HTMLInputElement) input.blur();
    } else if (event.key === 'Escape') {
      customWidthDraft = store.previewWidth === null ? '' : String(store.previewWidth);
      if (input instanceof HTMLInputElement) input.blur();
    }
  }

  // The "Full" preset is active when previewWidth is null; numeric presets
  // are active when previewWidth matches exactly.
  function presetIsActive(presetValue: number | null): boolean {
    return store.previewWidth === presetValue;
  }

  // Show the custom width input only when the viewport is constrained to a
  // numeric value. When "Full" is active there is no pixel count to display.
  let isCustomWidthVisible = $derived(store.previewWidth !== null);

  let announcement = $state<string>('');
  let announceTimeout: ReturnType<typeof setTimeout> | null = null;

  function announce(text: string): void {
    // Clear first, then set on the next tick. Assigning the same string twice
    // in a row to a Svelte reactive value is a no-op and the aria-live region
    // never updates the DOM, so an AT user clicking the same control twice
    // would not hear the second announcement. Empty-then-set forces a DOM
    // change every time. clearTimeout ensures back-to-back announce() calls
    // resolve deterministically — the latest call wins, in order.
    if (announceTimeout !== null) clearTimeout(announceTimeout);
    announcement = '';
    announceTimeout = setTimeout(() => {
      announcement = text;
      announceTimeout = null;
    }, 50);
  }

  function selectViewport(preset: (typeof VIEWPORT_PRESETS)[number]): void {
    store.previewWidth = preset.value;
    announce(`Viewport: ${preset.label}${preset.value !== null ? `, ${preset.value} pixels` : ''}`);
  }

  function selectTheme(option: (typeof THEME_OPTIONS)[number]): void {
    store.setTheme(option.value);
    announce(`Color scheme: ${option.label}`);
  }

  function toggleCheckerboard(): void {
    const next: BackgroundChoice = store.background === 'checker' ? 'surface' : 'checker';
    store.background = next;
    announce(next === 'checker' ? 'Checkerboard background on' : 'Checkerboard background off');
  }

  let isCheckerActive = $derived(store.background === 'checker');

  function toggleFocusMode(): void {
    store.isFocusMode = !store.isFocusMode;
    announce(store.isFocusMode ? 'Focus mode on. Press Escape to exit.' : 'Focus mode off');
  }
</script>

<header class="top-bar" role="banner">
  <!-- Wordmark — spans the sidebar column width so it aligns with the nav list -->
  <div class="wordmark" aria-label="Cinder design system">cinder</div>

  <div class="toolbar" role="group" aria-label="Preview controls">
    <!-- Component breadcrumb -->
    <span class="component-name" title={store.currentComponent} aria-label="Current component">
      {store.currentComponent || ' '}
    </span>

    <div class="divider" aria-hidden="true"></div>

    <!-- Viewport width presets -->
    <div role="group" aria-label="Viewport width" class="control-group">
      {#each VIEWPORT_PRESETS as preset (preset.abbrev)}
        {@const active = presetIsActive(preset.value)}
        <button
          type="button"
          class="segment"
          class:active
          aria-pressed={active}
          aria-label={`${preset.label}${preset.value !== null ? ` (${preset.value} pixels)` : ''}`}
          title={preset.value !== null ? `${preset.label} — ${preset.value}px` : preset.label}
          onclick={() => selectViewport(preset)}
        >
          <!--
            Numeric presets: show the number always; show the friendly label
            alongside when there is room (see .segment-label media query).
            Full preset: abbrev and label are identical — render just one span
            to avoid "Full Full" at wide viewports.
          -->
          {#if preset.value !== null}
            <span class="segment-abbrev" aria-hidden="true">{preset.abbrev}</span>
            <span class="segment-label" aria-hidden="true">{preset.label}</span>
          {:else}
            <span aria-hidden="true">{preset.abbrev}</span>
          {/if}
        </button>
      {/each}

      {#if isCustomWidthVisible}
        <label for="viewport-width-input" class="sr-only">Custom viewport width in pixels</label>
        <input
          id="viewport-width-input"
          class="width-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          spellcheck="false"
          maxlength="4"
          aria-label="Custom viewport width in pixels (200 to 3840)"
          bind:value={customWidthDraft}
          onkeydown={handleCustomKeydown}
          onblur={commitCustomWidth}
        />
        <span class="unit" aria-hidden="true">px</span>
      {/if}
    </div>

    <div class="divider" aria-hidden="true"></div>

    <!-- Color scheme -->
    <div role="group" aria-label="Color scheme" class="control-group">
      {#each THEME_OPTIONS as option (option.value)}
        {@const active = store.theme === option.value}
        <button
          type="button"
          class="segment icon-segment"
          class:active
          aria-pressed={active}
          aria-label={option.label}
          title={option.label}
          onclick={() => selectTheme(option)}
        >
          <span aria-hidden="true">{option.glyph}</span>
        </button>
      {/each}
    </div>

    <div class="divider" aria-hidden="true"></div>

    <!-- Preview background — transparency grid toggle -->
    <div class="control-group">
      <button
        type="button"
        class="segment icon-segment"
        class:active={isCheckerActive}
        aria-pressed={isCheckerActive}
        aria-label="Show transparency grid"
        title="Transparency grid"
        onclick={toggleCheckerboard}
      >
        <span aria-hidden="true">▦</span>
      </button>
    </div>

    <div class="divider" aria-hidden="true"></div>

    <!-- Actions -->
    <div role="group" aria-label="Actions" class="control-group">
      <button
        type="button"
        class="segment icon-segment"
        class:active={store.isFocusMode}
        aria-pressed={store.isFocusMode}
        aria-label="Focus mode — hide sidebar and toolbar (press Escape to exit)"
        title="Focus mode — hide sidebar and toolbar"
        onclick={toggleFocusMode}
      >
        <span aria-hidden="true">⛶</span>
      </button>
    </div>
  </div>

  <span class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
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
     * Canonical height token used by shell.svelte for the sidebar's top
     * offset. Keep them in sync — shell.svelte reads this custom property
     * via var(--cinder-top-bar-height) on the <main> element.
     */
    --cinder-top-bar-height: 52px;

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

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0;
    flex: 1;
    min-width: 0;
    padding: 0 12px;
    overflow-x: auto;
    height: 100%;
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

  /* Vertical rule between toolbar sections */
  .divider {
    width: 1px;
    height: 20px;
    background: var(--cinder-border);
    margin: 0 10px;
    flex-shrink: 0;
  }

  /* ── Control group ── */
  .control-group {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  /* ── Segment button ── */
  .segment {
    appearance: none;
    background: transparent;
    border: 1px solid transparent;
    color: var(--cinder-text-muted);
    padding: 0 10px;
    font: inherit;
    font-size: 12px;
    line-height: 1;
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      border-color var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
    /* Toolbar-density height — aligns with --cinder-control-height-sm (32px) */
    height: var(--cinder-control-height-sm);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    white-space: nowrap;
  }

  .segment:hover {
    background: var(--cinder-surface-hover);
    color: var(--cinder-text);
  }

  .segment.active {
    background: color-mix(in oklch, var(--cinder-accent), transparent 85%);
    color: var(--cinder-accent);
    border-color: color-mix(in oklch, var(--cinder-accent), transparent 78%);
    font-weight: 600;
  }

  .segment:focus-visible {
    outline: 2px solid var(--cinder-accent);
    outline-offset: 1px;
  }

  /* Icon-only segments are square */
  .icon-segment {
    padding: 0 8px;
    min-width: var(--cinder-control-height-sm);
    font-size: 14px;
  }

  /* ── Viewport abbrev / label ── */
  /* The abbrev (number) is always shown. The friendly label appears
     alongside it when there is horizontal room. */
  .segment-abbrev {
    display: inline-block;
  }

  .segment-label {
    display: inline-block;
  }

  @media (max-width: 1279px) {
    .segment-label {
      display: none;
    }
  }

  /* ── Custom width input ── */
  .width-input {
    width: 52px;
    height: var(--cinder-control-height-sm);
    margin-inline-start: 4px;
    border: 1px solid var(--cinder-border-strong);
    border-radius: var(--cinder-radius-sm);
    padding: 0 6px;
    font: inherit;
    font-size: 12px;
    text-align: right;
    background: var(--cinder-surface-inset);
    color: var(--cinder-text);
    box-sizing: border-box;
  }

  .width-input:focus-visible {
    outline: 2px solid var(--cinder-accent);
    outline-offset: 1px;
    border-color: transparent;
  }

  .unit {
    font-size: 11px;
    color: var(--cinder-text-subtle);
    padding-inline-start: 3px;
  }

  /* ── Accessibility ── */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
