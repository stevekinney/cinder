<script lang="ts">
  import { Button, Input } from '../../../components/src/index.ts';
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

  let query = $state('');
  let draftValues: Partial<Record<ColorTokenName, string>> = $state({});
  let errors: Partial<Record<ColorTokenName, string>> = $state({});

  const activeTheme = $derived(store.theme);
  const activeOverrides = $derived(store.colorTokenOverrides[activeTheme]);
  const activeOverrideCount = $derived(Object.keys(activeOverrides).length);

  function defaultValueFor(tokenName: ColorTokenName): string {
    if (typeof document === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  }

  function syncDrafts(): void {
    const nextDrafts: Partial<Record<ColorTokenName, string>> = {};
    for (const group of COLOR_TOKEN_GROUPS) {
      for (const token of group.tokens) {
        nextDrafts[token.name] = activeOverrides[token.name] ?? defaultValueFor(token.name);
      }
    }
    draftValues = nextDrafts;
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
    store.setColorTokenOverride(activeTheme, tokenName, value);
  }

  function resetToken(tokenName: ColorTokenName): void {
    store.resetColorTokenOverride(activeTheme, tokenName);
    draftValues[tokenName] = defaultValueFor(tokenName);
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
              <span
                class="token-swatch"
                style={`background: var(${token.name});`}
                aria-hidden="true"
              ></span>
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
    grid-template-columns: 1.25rem minmax(0, 1fr) auto;
    gap: var(--cinder-space-2);
    align-items: start;
    padding: var(--cinder-space-3) var(--cinder-space-4);
    border-bottom: 1px solid var(--cinder-border-muted);
  }

  .token-row:last-child {
    border-bottom: none;
  }

  .token-swatch {
    width: 1.25rem;
    height: 1.25rem;
    border: 1px solid var(--cinder-border-strong);
    border-radius: var(--cinder-radius-sm);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--cinder-surface), transparent 20%);
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

  @media (max-width: 520px) {
    .color-token-panel {
      width: 100vw;
    }

    .panel-controls {
      grid-template-columns: 1fr;
    }
  }
</style>
