<script lang="ts">
  /**
   * Scopes tab (plan §9.7 T7.4; design `Weft UI.dc.html` "System" §
   * SCOPES). Granted/not-granted scopes for the current principal, each with
   * a one-line description and what it unlocks in the console UI.
   */
  import { Badge } from '@lostgradient/cinder';
  import { ShieldCheck, ShieldOff } from 'lucide-svelte';

  import { getPrincipalStore } from '../../lib/scopes.svelte.ts';
  import { SCOPE_CATALOG } from './scope-catalog.ts';

  const principal = getPrincipalStore();

  const granted = $derived(SCOPE_CATALOG.filter((entry) => principal.hasScope(entry.scope)));
  const denied = $derived(SCOPE_CATALOG.filter((entry) => !principal.hasScope(entry.scope)));
</script>

<div class="weft-scope-panel">
  <div class="weft-scope-panel__section-title">
    <ShieldCheck aria-hidden="true" size={16} class="weft-scope-panel__icon--success" />
    Granted scopes
  </div>
  <ul class="weft-scope-panel__list">
    {#each granted as entry (entry.scope)}
      <li>
        <Badge variant="success" monospace class="weft-scope-panel__badge">{entry.scope}</Badge>
        <div class="weft-scope-panel__copy">
          <span>{entry.description}</span>
          <span class="weft-scope-panel__unlocks">Unlocks: {entry.unlocks}</span>
        </div>
      </li>
    {/each}
  </ul>

  <div class="weft-scope-panel__section-title">
    <ShieldOff aria-hidden="true" size={16} class="weft-scope-panel__icon--disabled" />
    Not granted
  </div>
  <ul class="weft-scope-panel__list weft-scope-panel__list--denied">
    {#each denied as entry (entry.scope)}
      <li>
        <Badge variant="neutral" monospace class="weft-scope-panel__badge">{entry.scope}</Badge>
        <div class="weft-scope-panel__copy">
          <span>{entry.description}</span>
          <span class="weft-scope-panel__unlocks">Unlocks: {entry.unlocks}</span>
        </div>
      </li>
    {/each}
  </ul>
</div>

<style>
  .weft-scope-panel {
    max-width: 720px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .weft-scope-panel__section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--cinder-text-sm);
    font-weight: 600;
    margin-top: 14px;
  }

  .weft-scope-panel__section-title:first-child {
    margin-top: 0;
  }

  :global(.weft-scope-panel__icon--success) {
    color: var(--cinder-color-success-fg);
  }

  :global(.weft-scope-panel__icon--disabled) {
    color: var(--cinder-text-disabled);
  }

  .weft-scope-panel__list {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    overflow: hidden;
  }

  .weft-scope-panel__list li {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 11px 16px;
    border-bottom: 1px solid var(--cinder-border-muted);
  }

  .weft-scope-panel__list li:last-child {
    border-bottom: 0;
  }

  /**
   * T9.4 accessibility pass: this was `opacity: 0.7`. Measured in a real
   * browser with `ctx.globalAlpha` (canvas 2D composites exactly like CSS
   * `opacity`, in gamma-encoded sRGB — a naive `color-mix(in oklch, …)`
   * stand-in reads noticeably higher and is NOT trustworthy near a 4.5:1
   * threshold): the row's `.weft-scope-panel__unlocks` span renders in
   * `--cinder-text-subtle`, which was 3.81:1 (light) / 3.82:1 (dark) at 0.7
   * opacity — under WCAG AA's 4.5:1 for normal text, and this text is a
   * real description of what the missing scope would unlock, not
   * decorative. 0.85 is the binding value (dark theme's floor, 4.94:1 —
   * light theme clears sooner at 5.60:1) that keeps every row's text at or
   * above AA in both themes; 0.8 was tried first and rejected (dark theme
   * only reaches 4.55:1, too close to the line to trust across renderers).
   */
  .weft-scope-panel__list--denied li {
    opacity: 0.85;
  }

  .weft-scope-panel__copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
  }

  .weft-scope-panel__unlocks {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
  }
</style>
