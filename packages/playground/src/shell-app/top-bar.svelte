<script lang="ts">
  import type { BackgroundChoice, ThemeChoice } from './preview-store.svelte.ts';
  import { getPreviewStore } from './preview-store.svelte.ts';

  type Props = {
    onCopyLink: () => void;
    copiedFlash: boolean;
  };

  let { onCopyLink, copiedFlash }: Props = $props();

  const store = getPreviewStore();

  const VIEWPORT_PRESETS: ReadonlyArray<{ label: string; abbrev: string; value: number | null }> = [
    { label: 'Mobile', abbrev: '375', value: 375 },
    { label: 'Tablet', abbrev: '768', value: 768 },
    { label: 'Desktop', abbrev: '1280', value: 1280 },
    { label: 'Full', abbrev: 'Full', value: null },
  ];

  const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string; glyph: string }> = [
    { value: 'light', label: 'Light', glyph: '☀' },
    { value: 'system', label: 'System', glyph: '◐' },
    { value: 'dark', label: 'Dark', glyph: '☾' },
  ];

  const BACKGROUND_OPTIONS: ReadonlyArray<{
    value: BackgroundChoice;
    label: string;
    glyph: string;
  }> = [
    { value: 'surface', label: 'Surface', glyph: '▢' },
    { value: 'inverse', label: 'Inverse', glyph: '■' },
    { value: 'checker', label: 'Checker', glyph: '▦' },
  ];

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

  function selectBackground(option: (typeof BACKGROUND_OPTIONS)[number]): void {
    store.background = option.value;
    announce(`Preview background: ${option.label}`);
  }

  function toggleFocusMode(): void {
    store.isFocusMode = !store.isFocusMode;
    announce(store.isFocusMode ? 'Focus mode on. Press Escape to exit.' : 'Focus mode off');
  }

  // When the copy-link parent flips copiedFlash to true, announce success
  // for AT users — the visual glyph swap alone is not perceivable.
  $effect(() => {
    if (copiedFlash) announce('Link copied to clipboard');
  });
</script>

<header class="top-bar">
  <div class="controls" role="group" aria-label="Preview controls">
    <div class="breadcrumb" title={store.currentComponent}>
      {store.currentComponent || ' '}
    </div>

    <div role="group" aria-label="Viewport width" class="cluster">
      {#each VIEWPORT_PRESETS as preset (preset.abbrev)}
        {@const active = presetIsActive(preset.value)}
        <button
          type="button"
          class="segment"
          class:active
          aria-pressed={active}
          aria-label={`${preset.label}${preset.value !== null ? ` (${preset.value} pixels)` : ''}`}
          title={preset.label}
          onclick={() => selectViewport(preset)}
        >
          <!-- Always-visible abbrev so the button has content at every
               width. The friendly label shows in addition when the bar
               has room (see the .segment-label media query). -->
          <span class="segment-abbrev" aria-hidden="true">{preset.abbrev}</span>
          <span class="segment-label">{preset.label}</span>
        </button>
      {/each}
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
        placeholder="Full"
        bind:value={customWidthDraft}
        onkeydown={handleCustomKeydown}
        onblur={commitCustomWidth}
      />
      <span class="unit" aria-hidden="true">px</span>
    </div>

    <div role="group" aria-label="Color scheme" class="cluster">
      {#each THEME_OPTIONS as option (option.value)}
        {@const active = store.theme === option.value}
        <button
          type="button"
          class="segment icon-segment"
          class:active
          aria-pressed={active}
          aria-label={`${option.label} theme`}
          title={`${option.label} theme`}
          onclick={() => selectTheme(option)}
        >
          <span aria-hidden="true">{option.glyph}</span>
        </button>
      {/each}
    </div>

    <div role="group" aria-label="Preview background" class="cluster">
      {#each BACKGROUND_OPTIONS as option (option.value)}
        {@const active = store.background === option.value}
        <button
          type="button"
          class="segment icon-segment"
          class:active
          aria-pressed={active}
          aria-label={`${option.label} background`}
          title={`${option.label} background`}
          onclick={() => selectBackground(option)}
        >
          <span aria-hidden="true">{option.glyph}</span>
        </button>
      {/each}
    </div>

    <div role="group" aria-label="Actions" class="cluster">
      <button
        type="button"
        class="segment icon-segment"
        class:active={store.isFocusMode}
        aria-pressed={store.isFocusMode}
        aria-label="Focus mode (press Escape to exit)"
        title="Focus mode — hide sidebar and top bar"
        onclick={toggleFocusMode}
      >
        <span aria-hidden="true">⛶</span>
      </button>
      <button
        type="button"
        class="segment icon-segment"
        aria-label={copiedFlash ? 'Link copied to clipboard' : 'Copy component link'}
        title={copiedFlash ? 'Copied!' : 'Copy component link'}
        onclick={onCopyLink}
      >
        <span aria-hidden="true">{copiedFlash ? '✓' : '⎘'}</span>
      </button>
    </div>
  </div>
  <span class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
</header>

<style>
  .top-bar {
    box-sizing: border-box;
    height: 48px;
    padding: 0 12px;
    background: var(--cinder-surface);
    border-bottom: 1px solid var(--cinder-border);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    overflow-x: auto;
  }

  .breadcrumb {
    font-size: 13px;
    font-weight: 600;
    color: var(--cinder-text);
    flex: 0 1 240px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 12px;
    border-right: 1px solid var(--cinder-border);
  }

  .cluster {
    display: flex;
    align-items: center;
    gap: 2px;
    border-right: 1px solid var(--cinder-border);
    padding-right: 12px;
  }

  .cluster:last-of-type {
    border-right: none;
    padding-right: 0;
  }

  .segment {
    appearance: none;
    background: transparent;
    border: 1px solid transparent;
    color: var(--cinder-text-muted);
    padding: 4px 10px;
    font: inherit;
    font-size: 12px;
    line-height: 1;
    border-radius: 4px;
    cursor: pointer;
    transition:
      background 0.1s,
      border-color 0.1s;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .segment:hover {
    background: var(--cinder-surface-hover);
  }

  .segment.active {
    background: color-mix(in oklch, var(--cinder-accent), transparent 85%);
    color: var(--cinder-accent);
    border-color: color-mix(in oklch, var(--cinder-accent), transparent 80%);
    font-weight: 600;
  }

  .icon-segment {
    padding: 4px 8px;
    min-width: 30px;
    font-size: 14px;
  }

  .segment:focus-visible {
    outline: 2px solid var(--cinder-accent);
    outline-offset: 1px;
  }

  .width-input {
    width: 64px;
    height: 28px;
    margin-left: 6px;
    border: 1px solid var(--cinder-border-strong);
    border-radius: 4px;
    padding: 0 6px;
    font: inherit;
    font-size: 12px;
    text-align: right;
    background: var(--cinder-surface);
    color: var(--cinder-text);
  }

  .width-input:focus-visible {
    outline: 2px solid var(--cinder-accent);
    outline-offset: 1px;
    border-color: transparent;
  }

  .unit {
    font-size: 11px;
    color: var(--cinder-text-subtle);
    padding-left: 4px;
  }

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

  /* Viewport preset buttons render an abbrev (numeric width or "Full") that
     is ALWAYS visible, plus a friendly label that appears only when there's
     room. The aria-label on the button carries the full accessible name. */
  .segment-abbrev {
    display: inline-block;
  }

  .segment-label {
    display: inline-block;
    margin-left: 4px;
  }

  @media (max-width: 1279px) {
    .segment-label {
      display: none;
    }
    .segment-abbrev {
      margin-left: 0;
    }
  }
</style>
