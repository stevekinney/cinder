<script lang="ts">
  import { Button, ColorPicker, Input, Popover } from '../../../components/src/index.ts';
  import {
    COLOR_TOKEN_GROUPS,
    isSafeColorTokenValue,
    type ColorTokenName,
  } from './color-token-registry.ts';
  import { getPreviewStore } from './preview-store.svelte.ts';

  type Props = {
    onClose: () => void;
  };

  let { onClose }: Props = $props();

  const store = getPreviewStore();

  const COLOR_PICKER_SWATCHES = [
    '#0f172a',
    '#334155',
    '#64748b',
    '#e2e8f0',
    '#ffffff',
    '#dc2626',
    '#ea580c',
    '#d97706',
    '#16a34a',
    '#0891b2',
    '#336699',
    '#2563eb',
    '#7c3aed',
    '#db2777',
  ];

  let query = $state('');
  let draftValues: Partial<Record<ColorTokenName, string>> = $state({});
  let pickerValues: Partial<Record<ColorTokenName, string>> = $state({});
  let previewValues: Partial<Record<ColorTokenName, string>> = $state({});
  let errors: Partial<Record<ColorTokenName, string>> = $state({});
  let pickerOpen = $state(false);
  let pickerAnchorElement: HTMLElement | null = $state(null);
  let activePickerTokenName: ColorTokenName | null = $state(null);

  const activeTheme = $derived(store.theme);
  const activeOverrides = $derived(store.colorTokenOverrides[activeTheme]);
  const activeOverrideCount = $derived(Object.keys(activeOverrides).length);
  const activePickerToken = $derived.by(() => {
    if (activePickerTokenName === null) return null;

    for (const group of COLOR_TOKEN_GROUPS) {
      const token = group.tokens.find((candidate) => candidate.name === activePickerTokenName);
      if (token !== undefined) return token;
    }

    return null;
  });
  const activePickerValue = $derived(
    activePickerTokenName === null ? '#000000' : (pickerValues[activePickerTokenName] ?? '#000000'),
  );

  function defaultValueFor(tokenName: ColorTokenName): string {
    if (typeof document === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  }

  function normalizeHexColor(value: string): string | null {
    const trimmed = value.trim();
    const match = /^#(?<hex>[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(trimmed);
    const hex = match?.groups?.['hex'];
    if (hex === undefined) return null;

    if (hex.length === 3 || hex.length === 4) {
      const [red = '0', green = '0', blue = '0'] = hex;
      return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
    }

    return `#${hex.slice(0, 6)}`.toLowerCase();
  }

  function byteToHex(channel: number): string {
    const clamped = Math.min(255, Math.max(0, Math.round(channel)));
    return clamped.toString(16).padStart(2, '0');
  }

  function rgbChannelToHex(channel: string): string | null {
    const trimmed = channel.trim();
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) return null;
    return byteToHex(trimmed.endsWith('%') ? (parsed / 100) * 255 : parsed);
  }

  function rgbColorToHex(value: string): string | null {
    const match = /^rgba?\((?<channels>.+)\)$/i.exec(value.trim());
    const channels = match?.groups?.['channels'];
    if (channels === undefined) return null;

    const [red, green, blue] = channels
      .replaceAll(',', ' ')
      .split(/\s+/)
      .filter((part) => part !== '' && part !== '/');

    if (red === undefined || green === undefined || blue === undefined) return null;
    const redHex = rgbChannelToHex(red);
    const greenHex = rgbChannelToHex(green);
    const blueHex = rgbChannelToHex(blue);
    if (redHex === null || greenHex === null || blueHex === null) return null;
    return `#${redHex}${greenHex}${blueHex}`;
  }

  function splitColorChannels(value: string): string[] {
    return value
      .replace(/\s*\/\s*/g, ' ')
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part !== '');
  }

  function parseUnitIntervalChannel(channel: string): number | null {
    const parsed = Number.parseFloat(channel);
    if (!Number.isFinite(parsed)) return null;
    return channel.trim().endsWith('%') ? parsed / 100 : parsed;
  }

  function parseHueDegrees(channel: string): number | null {
    const trimmed = channel.trim().toLowerCase();
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) return null;
    if (trimmed.endsWith('turn')) return parsed * 360;
    if (trimmed.endsWith('rad')) return (parsed * 180) / Math.PI;
    if (trimmed.endsWith('grad')) return parsed * 0.9;
    return parsed;
  }

  function linearSrgbToDisplayChannel(channel: number): number {
    const clamped = Math.min(1, Math.max(0, channel));
    if (clamped <= 0.003_130_8) return clamped * 12.92;
    return 1.055 * clamped ** (1 / 2.4) - 0.055;
  }

  function oklabToHex(lightness: number, greenRed: number, blueYellow: number): string {
    const long = lightness + 0.396_337_777_4 * greenRed + 0.215_803_757_3 * blueYellow;
    const medium = lightness - 0.105_561_345_8 * greenRed - 0.063_854_172_8 * blueYellow;
    const short = lightness - 0.089_484_177_5 * greenRed - 1.291_485_548 * blueYellow;

    const longCubed = long ** 3;
    const mediumCubed = medium ** 3;
    const shortCubed = short ** 3;

    const red =
      4.076_741_662_1 * longCubed - 3.307_711_591_3 * mediumCubed + 0.230_969_929_2 * shortCubed;
    const green =
      -1.268_438_004_6 * longCubed + 2.609_757_401_1 * mediumCubed - 0.341_319_396_5 * shortCubed;
    const blue =
      -0.004_196_086_3 * longCubed - 0.703_418_614_7 * mediumCubed + 1.707_614_701 * shortCubed;

    return `#${byteToHex(linearSrgbToDisplayChannel(red) * 255)}${byteToHex(
      linearSrgbToDisplayChannel(green) * 255,
    )}${byteToHex(linearSrgbToDisplayChannel(blue) * 255)}`;
  }

  function oklchColorToHex(value: string): string | null {
    const match = /^oklch\((?<body>.+)\)$/i.exec(value.trim());
    const body = match?.groups?.['body'];
    if (body === undefined) return null;

    const [lightnessValue, chromaValue, hueValue] = splitColorChannels(body);
    if (lightnessValue === undefined || chromaValue === undefined || hueValue === undefined) {
      return null;
    }

    const lightness = parseUnitIntervalChannel(lightnessValue);
    const chroma = parseUnitIntervalChannel(chromaValue);
    const hue = parseHueDegrees(hueValue);
    if (lightness === null || chroma === null || hue === null) return null;

    const hueRadians = (hue * Math.PI) / 180;
    return oklabToHex(lightness, chroma * Math.cos(hueRadians), chroma * Math.sin(hueRadians));
  }

  function oklabColorToHex(value: string): string | null {
    const match = /^oklab\((?<body>.+)\)$/i.exec(value.trim());
    const body = match?.groups?.['body'];
    if (body === undefined) return null;

    const [lightnessValue, greenRedValue, blueYellowValue] = splitColorChannels(body);
    if (
      lightnessValue === undefined ||
      greenRedValue === undefined ||
      blueYellowValue === undefined
    ) {
      return null;
    }

    const lightness = parseUnitIntervalChannel(lightnessValue);
    const greenRed = parseUnitIntervalChannel(greenRedValue);
    const blueYellow = parseUnitIntervalChannel(blueYellowValue);
    if (lightness === null || greenRed === null || blueYellow === null) return null;

    return oklabToHex(lightness, greenRed, blueYellow);
  }

  function srgbColorFunctionToHex(value: string): string | null {
    const match = /^color\((?<body>.+)\)$/i.exec(value.trim());
    const body = match?.groups?.['body'];
    if (body === undefined) return null;

    const [space, redValue, greenValue, blueValue] = splitColorChannels(body);
    if (
      space?.toLowerCase() !== 'srgb' ||
      redValue === undefined ||
      greenValue === undefined ||
      blueValue === undefined
    ) {
      return null;
    }

    const red = parseUnitIntervalChannel(redValue);
    const green = parseUnitIntervalChannel(greenValue);
    const blue = parseUnitIntervalChannel(blueValue);
    if (red === null || green === null || blue === null) return null;

    return `#${byteToHex(red * 255)}${byteToHex(green * 255)}${byteToHex(blue * 255)}`;
  }

  function modernColorFunctionToHex(value: string): string | null {
    return oklchColorToHex(value) ?? oklabColorToHex(value) ?? srgbColorFunctionToHex(value);
  }

  function canvasColorToHex(value: string): string | null {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context === null) return null;
      context.fillStyle = '#000000';
      context.fillStyle = value;
      return normalizeHexColor(context.fillStyle) ?? rgbColorToHex(context.fillStyle);
    } catch {
      return null;
    }
  }

  function resolvedBackgroundColorToHex(value: string): string | null {
    if (typeof document === 'undefined') return null;

    const probe = document.createElement('span');
    probe.style.position = 'fixed';
    probe.style.pointerEvents = 'none';
    probe.style.inlineSize = '1px';
    probe.style.blockSize = '1px';
    probe.style.inset = '0';
    probe.style.backgroundColor = value;

    if (probe.style.backgroundColor === '') return null;

    const parent = document.body ?? document.documentElement;
    parent.append(probe);
    const resolved = getComputedStyle(probe).backgroundColor;
    probe.remove();

    if (resolved === '' || resolved === 'transparent') return null;

    return (
      normalizeHexColor(resolved) ??
      rgbColorToHex(resolved) ??
      modernColorFunctionToHex(resolved) ??
      canvasColorToHex(resolved)
    );
  }

  function resolveColorToPickerValue(value: string, fallback = '#000000'): string {
    if (typeof document === 'undefined') return fallback;

    const normalizedHex = normalizeHexColor(value);
    if (normalizedHex !== null) return normalizedHex;

    return (
      resolvedBackgroundColorToHex(value) ??
      modernColorFunctionToHex(value) ??
      canvasColorToHex(value) ??
      fallback
    );
  }

  function pickerValueFor(tokenName: ColorTokenName, value: string): string {
    return resolveColorToPickerValue(
      value,
      resolvedBackgroundColorToHex(`var(${tokenName})`) ?? '#000000',
    );
  }

  function syncDrafts(): void {
    const nextDrafts: Partial<Record<ColorTokenName, string>> = {};
    const nextPickerValues: Partial<Record<ColorTokenName, string>> = {};
    const nextPreviewValues: Partial<Record<ColorTokenName, string>> = {};
    for (const group of COLOR_TOKEN_GROUPS) {
      for (const token of group.tokens) {
        const value = activeOverrides[token.name] ?? defaultValueFor(token.name);
        nextDrafts[token.name] = value;
        nextPickerValues[token.name] = pickerValueFor(token.name, value);
        nextPreviewValues[token.name] = value;
      }
    }
    draftValues = nextDrafts;
    pickerValues = nextPickerValues;
    previewValues = nextPreviewValues;
    errors = {};
  }

  $effect(() => {
    activeTheme;
    activeOverrides;
    syncDrafts();
  });

  const filteredGroups = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return COLOR_TOKEN_GROUPS;

    return COLOR_TOKEN_GROUPS.map((group) => ({
      ...group,
      tokens: group.tokens.filter((token) => {
        return (
          token.name.toLowerCase().includes(needle) ||
          token.label.toLowerCase().includes(needle) ||
          group.label.toLowerCase().includes(needle)
        );
      }),
    })).filter((group) => group.tokens.length > 0);
  });

  function inputIdFor(tokenName: ColorTokenName): string {
    return `color-token-${tokenName.replace(/^--/, '').replaceAll('-', '_')}`;
  }

  function hasOverride(tokenName: ColorTokenName): boolean {
    return activeOverrides[tokenName] !== undefined;
  }

  function handleTokenInput(
    tokenName: ColorTokenName,
    event: Event & { currentTarget: HTMLInputElement },
  ): void {
    const value = event.currentTarget.value;
    draftValues[tokenName] = value;

    if (!isSafeColorTokenValue(value)) {
      errors[tokenName] = 'Enter a valid CSS color value.';
      return;
    }

    delete errors[tokenName];
    pickerValues[tokenName] = pickerValueFor(tokenName, value);
    previewValues[tokenName] = value;
    store.setColorTokenOverride(activeTheme, tokenName, value);
  }

  function handleColorPickerValue(tokenName: ColorTokenName, value: string): void {
    pickerValues[tokenName] = value;
    draftValues[tokenName] = value;
    previewValues[tokenName] = value;
    delete errors[tokenName];
    store.setColorTokenOverride(activeTheme, tokenName, value);
  }

  function openColorPicker(
    tokenName: ColorTokenName,
    event: MouseEvent & { currentTarget: EventTarget & HTMLElement },
  ): void {
    pickerAnchorElement = event.currentTarget;
    activePickerTokenName = tokenName;
    pickerOpen = true;
  }

  function resetToken(tokenName: ColorTokenName): void {
    store.resetColorTokenOverride(activeTheme, tokenName);
    draftValues[tokenName] = defaultValueFor(tokenName);
    pickerValues[tokenName] = pickerValueFor(tokenName, draftValues[tokenName] ?? '');
    previewValues[tokenName] = draftValues[tokenName];
    delete errors[tokenName];
  }

  function resetActiveTheme(): void {
    store.resetColorTokenOverrides(activeTheme);
    syncDrafts();
  }
</script>

<aside
  class="color-token-panel"
  aria-labelledby="color-token-panel-heading"
  data-testid="color-token-panel"
>
  <header class="panel-header">
    <div>
      <h2 id="color-token-panel-heading">Color tokens</h2>
      <p>{activeTheme} theme overrides</p>
    </div>
    <Button variant="ghost" size="sm" aria-label="Close color token panel" onclick={onClose}>
      <span aria-hidden="true">×</span>
    </Button>
  </header>

  <div class="panel-controls">
    <Input
      id="color-token-filter"
      type="search"
      bind:value={query}
      aria-label="Filter color tokens"
      placeholder="Filter tokens…"
      autocomplete="off"
      spellcheck={false}
    />
    <Button
      variant="secondary"
      size="sm"
      disabled={activeOverrideCount === 0}
      onclick={resetActiveTheme}
    >
      Reset {activeTheme}
    </Button>
  </div>

  <div class="token-groups">
    {#each filteredGroups as group (group.id)}
      <section class="token-group" aria-labelledby="color-token-group-{group.id}">
        <h3 id="color-token-group-{group.id}">{group.label}</h3>
        <div class="token-list">
          {#each group.tokens as token (token.name)}
            {@const inputId = inputIdFor(token.name)}
            <div class="token-row" data-color-token={token.name}>
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                label="Pick {token.name} color"
                class="token-color-trigger"
                title="Pick {token.name} color"
                aria-expanded={pickerOpen && activePickerTokenName === token.name
                  ? 'true'
                  : undefined}
                onclick={(event) => openColorPicker(token.name, event)}
              >
                <span
                  class="token-color-trigger__swatch"
                  style={`--token-picker-color: ${
                    previewValues[token.name] ?? pickerValues[token.name] ?? 'transparent'
                  };`}
                ></span>
              </Button>
              <div class="token-copy">
                <label for={inputId}>{token.label}</label>
                <code>{token.name}</code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasOverride(token.name)}
                aria-label="Reset {token.name}"
                onclick={() => resetToken(token.name)}
              >
                Reset
              </Button>
              <div class="token-editor">
                <Input
                  id={inputId}
                  value={draftValues[token.name] ?? ''}
                  {...errors[token.name] === undefined ? {} : { error: errors[token.name] }}
                  aria-label="{token.name} CSS value"
                  autocomplete="off"
                  spellcheck={false}
                  oninput={(event) => handleTokenInput(token.name, event)}
                />
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    {#if filteredGroups.length === 0}
      <p class="empty-state">No color tokens match “{query}”.</p>
    {/if}
  </div>
</aside>

{#if activePickerToken !== null}
  <Popover
    bind:open={pickerOpen}
    triggerRef={pickerAnchorElement}
    placement="left"
    label="Pick {activePickerToken.name} color"
    class="color-token-picker-popover"
  >
    <div class="picker-popover-content">
      <div class="picker-popover-header">
        <span>{activePickerToken.label}</span>
        <code>{activePickerToken.name}</code>
      </div>
      <ColorPicker
        value={activePickerValue}
        label="Color picker for {activePickerToken.name}"
        swatches={COLOR_PICKER_SWATCHES}
        oninput={(value) => handleColorPickerValue(activePickerToken.name, value)}
        onchange={(value) => handleColorPickerValue(activePickerToken.name, value)}
      />
    </div>
  </Popover>
{/if}

<style>
  .color-token-panel {
    position: fixed;
    top: var(--cinder-top-bar-height);
    right: 0;
    bottom: 0;
    z-index: 12;
    display: flex;
    flex-direction: column;
    width: min(100vw, 28rem);
    background: var(--cinder-surface-raised);
    color: var(--cinder-text);
    border-inline-start: 1px solid var(--cinder-border);
    box-shadow: var(--cinder-shadow-lg);
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--cinder-space-3);
    padding: var(--cinder-space-4);
    border-bottom: 1px solid var(--cinder-border);
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: var(--cinder-text-lg);
    line-height: var(--cinder-leading-tight);
  }

  .panel-header p {
    margin-block-start: var(--cinder-space-1);
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
  }

  .panel-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3) var(--cinder-space-4);
    border-bottom: 1px solid var(--cinder-border);
  }

  .token-groups {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .token-group {
    border-bottom: 1px solid var(--cinder-border-muted);
  }

  .token-group h3 {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: var(--cinder-space-2) var(--cinder-space-4);
    background: var(--cinder-surface);
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--cinder-tracking-wide);
    border-bottom: 1px solid var(--cinder-border-muted);
  }

  .token-list {
    display: flex;
    flex-direction: column;
  }

  .token-row {
    display: grid;
    grid-template-columns: 2.25rem minmax(0, 1fr) auto;
    column-gap: var(--cinder-space-3);
    row-gap: var(--cinder-space-2);
    align-items: start;
    padding: var(--cinder-space-3-5) var(--cinder-space-4);
    border-bottom: 1px solid var(--cinder-border-muted);
  }

  .token-row:last-child {
    border-bottom: none;
  }

  .token-row :global(.cinder-button.token-color-trigger) {
    inline-size: 2.25rem;
    block-size: 2.25rem;
    min-width: 2.25rem;
    min-height: 2.25rem;
    padding: 0;
    align-self: start;
    background: transparent;
    border-color: transparent;
    border-radius: var(--cinder-radius-md);
    box-shadow: none;
  }

  @media (hover: hover) {
    .token-row :global(.cinder-button.token-color-trigger:hover:not(:disabled)) {
      background: color-mix(in oklch, var(--cinder-surface), var(--cinder-text) 5%);
      border-color: transparent;
    }
  }

  .token-row :global(.cinder-button.token-color-trigger:focus-visible) {
    outline: var(--cinder-ring-width) solid transparent;
    outline-offset: 2px;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  .token-row :global(.cinder-button.token-color-trigger[aria-expanded='true']) {
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  .token-row :global(.token-color-trigger .cinder-button__icon) {
    inline-size: 100%;
    block-size: 100%;
  }

  :global(.token-color-trigger__swatch) {
    display: block;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border: 1px solid var(--cinder-border-strong);
    border-radius: var(--cinder-radius-sm);
    background-color: var(--token-picker-color);
    box-shadow:
      inset 0 0 0 1px color-mix(in oklch, var(--cinder-surface), transparent 15%),
      0 1px 2px color-mix(in oklch, var(--cinder-text), transparent 88%);
  }

  .token-copy {
    display: grid;
    gap: var(--cinder-space-0-5);
    min-width: 0;
  }

  .token-copy label {
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text);
  }

  .token-copy code {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--cinder-text-subtle);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    white-space: nowrap;
  }

  .token-editor {
    grid-column: 2 / -1;
    min-width: 0;
  }

  .empty-state {
    padding: var(--cinder-space-4);
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
  }

  :global(.color-token-picker-popover) {
    width: min(18rem, calc(100vw - var(--cinder-space-4)));
  }

  .picker-popover-content {
    display: grid;
    gap: var(--cinder-space-3);
  }

  .picker-popover-header {
    display: grid;
    gap: var(--cinder-space-0-5);
    min-width: 0;
  }

  .picker-popover-header span {
    color: var(--cinder-text);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-semibold);
  }

  .picker-popover-header code {
    overflow: hidden;
    color: var(--cinder-text-subtle);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .picker-popover-content :global(.cinder-color-picker) {
    max-width: none;
  }

  @media (max-width: 520px) {
    .color-token-panel {
      width: 100vw;
    }

    .panel-controls {
      grid-template-columns: 1fr;
    }
  }
</style>
