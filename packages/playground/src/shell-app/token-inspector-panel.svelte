<script lang="ts">
  /*
   * Read-only inspector over the shipped token corpus.
   *
   * Every row is derived from the generated registry — no hand-authored list of
   * tokens, labels, or groupings lives here. Adding a token to the corpus adds a
   * row; renaming one renames the row; nothing in this file needs editing.
   *
   * The two value columns are read from the BROWSER rather than formatted from
   * the DTCG `$value`. A probe element is stamped `data-theme="light"` and then
   * `data-theme="dark"`, and each token's computed custom property is read off
   * it. That makes the displayed value the value the stylesheet actually paints,
   * so an inspector cannot drift from the CSS it describes — which re-serializing
   * `$value` here would eventually do, since `serializeTypedValue` (the real
   * formatter) lives in the package's build scripts and is not published.
   *
   * `$type` is the one field the registry does not carry, so it is joined in from
   * a resolved context. Types are context-invariant, so the light one suffices.
   *
   * Both themes are shown at all times regardless of which one is active, so
   * switching theme does not change what belongs on screen.
   *
   * The values are the ones the SHIPPED stylesheet defines, never a session
   * override from the colour panel — deliberately, since this inspects the
   * design system rather than the reader's scratch edits, and "generated data
   * only" is the criterion it exists to satisfy. That falls out of how the probe
   * works: a `[data-theme]` rule matching the probe itself sets the property
   * directly on it, which outranks an inline override inherited from
   * `documentElement`. Worth stating rather than leaving to be rediscovered,
   * because it means the two panels can legitimately disagree while the colour
   * panel has unsaved edits.
   */
  import { Button } from '@lostgradient/cinder/button';
  import { FormField } from '@lostgradient/cinder/form-field';
  import { Input } from '@lostgradient/cinder/input';
  import X from 'lucide-svelte/icons/x';
  import { TOKEN_REGISTRY, type TokenRegistryEntry } from '@lostgradient/cinder/tokens/registry';
  import lightContext from '@lostgradient/cinder/tokens/resolved/light' with { type: 'json' };

  type Props = {
    onClose: () => void;
  };

  let { onClose }: Props = $props();

  /** A token's `$type`, keyed by DTCG path. Context-invariant, so one context is enough. */
  const TOKEN_TYPES: Record<string, string> = Object.fromEntries(
    Object.entries(lightContext as Record<string, { $type?: string }>).map(([path, token]) => [
      path,
      token.$type ?? 'unknown',
    ]),
  );

  type InspectedToken = {
    entry: TokenRegistryEntry;
    type: string;
    light: string;
    dark: string;
  };

  let query = $state('');
  let panelElement: HTMLElement | null = $state(null);
  let resolvedValues: Record<string, { light: string; dark: string }> = $state({});

  /**
   * Read every token's value in both themes off a probe element.
   *
   * Both themes are read in one pass per theme rather than one probe per token:
   * a single style/layout flush for 216 reads instead of 216 of them.
   *
   * The probe is `position: fixed` and `visibility: hidden` rather than
   * `display: none` — a display:none element still resolves custom properties,
   * but keeping it laid out costs nothing here and avoids depending on that.
   */
  function readResolvedValues(): Record<string, { light: string; dark: string }> {
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden';
    document.body.append(probe);

    try {
      const readTheme = (theme: 'light' | 'dark'): Map<string, string> => {
        probe.dataset['theme'] = theme;
        const styles = getComputedStyle(probe);
        const values = new Map<string, string>();
        for (const entry of TOKEN_REGISTRY.entries) {
          values.set(entry.path, styles.getPropertyValue(entry.cssProperty).trim());
        }
        return values;
      };

      const light = readTheme('light');
      const dark = readTheme('dark');

      return Object.fromEntries(
        TOKEN_REGISTRY.entries.map((entry) => [
          entry.path,
          { light: light.get(entry.path) ?? '', dark: dark.get(entry.path) ?? '' },
        ]),
      );
    } finally {
      probe.remove();
    }
  }

  $effect(() => {
    resolvedValues = readResolvedValues();
  });

  $effect(() => {
    const element = panelElement;
    if (element === null) return;
    element.querySelector<HTMLInputElement>('#token-inspector-filter')?.focus({
      preventScroll: true,
    });
  });

  const tokens: InspectedToken[] = $derived(
    TOKEN_REGISTRY.entries.map((entry) => ({
      entry,
      type: TOKEN_TYPES[entry.path] ?? 'unknown',
      light: resolvedValues[entry.path]?.light ?? '',
      dark: resolvedValues[entry.path]?.dark ?? '',
    })),
  );

  const filtered: InspectedToken[] = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return tokens;
    return tokens.filter(({ entry, type }) => {
      return (
        entry.path.toLowerCase().includes(needle) ||
        entry.cssProperty.toLowerCase().includes(needle) ||
        type.toLowerCase().includes(needle) ||
        (entry.component?.toLowerCase().includes(needle) ?? false) ||
        (entry.category?.toLowerCase().includes(needle) ?? false)
      );
    });
  });

  /**
   * True when this value can be painted as a colour.
   *
   * Asking CSS rather than matching prefixes: the corpus resolves colours to
   * `oklch()`, relative `oklch(from …)`, and `color-mix()` alike, and a prefix
   * list gets these subtly wrong — it drew a swatch for `oklch(from …)` while
   * silently skipping the equally paintable `color-mix(…)` sitting next to it.
   * `CSS.supports` also rejects dimensions and durations for free.
   */
  function isPaintable(value: string): boolean {
    if (value === '' || typeof CSS === 'undefined') return false;
    return CSS.supports('color', value);
  }
</script>

<aside
  id="token-inspector-panel"
  bind:this={panelElement}
  class="cinder-_floating-surface token-inspector-panel"
  aria-labelledby="token-inspector-heading"
  data-testid="token-inspector-panel"
>
  <header class="panel-header">
    <div>
      <h2 id="token-inspector-heading">Token inspector</h2>
      <p>{filtered.length} of {tokens.length} tokens</p>
    </div>
    <Button variant="ghost" size="sm" aria-label="Close token inspector" onclick={onClose}>
      <X size={17} strokeWidth={1.5} aria-hidden="true" />
    </Button>
  </header>

  <div class="panel-controls">
    <FormField id="token-inspector-filter" label="Filter tokens" labelVisible={false}>
      <Input
        id="token-inspector-filter"
        type="search"
        bind:value={query}
        placeholder="Filter by path, property, type…"
        autocomplete="off"
        spellcheck={false}
      />
    </FormField>
  </div>

  <div class="table-scroll">
    <table data-testid="token-inspector-table">
      <caption class="visually-hidden">
        Every shipped design token with its DTCG path, CSS custom property, type, owning component,
        and the value it resolves to in each theme.
      </caption>
      <thead>
        <tr>
          <th scope="col">Path</th>
          <th scope="col">CSS property</th>
          <th scope="col">Type</th>
          <th scope="col">Component</th>
          <th scope="col">Light</th>
          <th scope="col">Dark</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as token (token.entry.path)}
          <tr data-token-path={token.entry.path} data-theme-aware={token.entry.themeAware}>
            <th scope="row"><code>{token.entry.path}</code></th>
            <td><code>{token.entry.cssProperty}</code></td>
            <td>{token.type}</td>
            <td>{token.entry.component ?? '—'}</td>
            <td data-testid="light-value">
              <span class="value">
                {#if isPaintable(token.light)}
                  <span class="swatch" style:background={token.light}></span>
                {/if}
                <code>{token.light}</code>
              </span>
            </td>
            <td data-testid="dark-value">
              <span class="value">
                {#if isPaintable(token.dark)}
                  <span class="swatch" style:background={token.dark}></span>
                {/if}
                <code>{token.dark}</code>
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</aside>

<style>
  .token-inspector-panel {
    position: fixed;
    /* Height follows the table up to the viewport, rather than pinning both
       edges — a filter that leaves ten rows should not leave a full-height
       panel mostly empty. */
    inset-block-start: var(--cinder-space-4);
    max-block-size: calc(100vh - var(--cinder-space-8));
    inset-inline-end: var(--cinder-space-4);
    z-index: var(--cinder-z-modal);
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    /* Six columns, two of which hold CSS values: narrower than this and the
       Dark column is clipped at common laptop widths. */
    width: min(72rem, calc(100vw - var(--cinder-space-8)));
    padding: var(--cinder-space-4);
    /* Border, background, radius and shadow come from
       `cinder-_floating-surface`, the shared floating-panel primitive. */
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--cinder-space-3);
  }

  .panel-header h2 {
    margin: 0;
    font-size: var(--cinder-text-lg);
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text-default);
  }

  .panel-header p {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
  }

  .table-scroll {
    overflow: auto;
    min-height: 0;
    border: 1px solid var(--cinder-border-faint);
    border-radius: var(--cinder-radius-md);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--cinder-text-sm);
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: var(--cinder-space-2) var(--cinder-space-3);
    text-align: start;
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text-muted);
    background: var(--cinder-surface-raised);
    border-block-end: 1px solid var(--cinder-border-faint);
  }

  tbody th,
  tbody td {
    padding: var(--cinder-space-2) var(--cinder-space-3);
    text-align: start;
    font-weight: var(--cinder-font-normal);
    color: var(--cinder-text-default);
    border-block-start: 1px solid var(--cinder-border-faint);
    vertical-align: baseline;
  }

  code {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
  }

  .value {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-2);
  }

  .swatch {
    inline-size: var(--cinder-space-4);
    block-size: var(--cinder-space-4);
    flex: none;
    border: 1px solid var(--cinder-border-faint);
    border-radius: var(--cinder-radius-sm);
  }

  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
