<script lang="ts" module>
  /**
   * @cinder
   * @category typography
   * @status alpha
   * @purpose Inline shortcut hint that renders a key combo via Kbd alongside an action label, with an accessible text representation not reliant on visual keycaps alone.
   * @tag shortcut
   * @tag inline
   * @useWhen Showing a keyboard shortcut inline beside a label in a toolbar button, menu item, or tooltip.
   * @useWhen Pairing with command-palette items to surface available shortcuts.
   * @avoidWhen Displaying a full shortcut reference table — use keyboard-shortcuts instead.
   * @related kbd, keyboard-shortcuts, tooltip
   */
  export type { ShortcutHintProps } from './shortcut-hint.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Kbd from '../kbd/kbd.svelte';
  import type { ShortcutHintProps } from './shortcut-hint.types.ts';

  let {
    keys,
    keysLabel,
    children,
    keysPosition = 'after',
    class: customClassName,
    ...rest
  }: ShortcutHintProps = $props();

  /**
   * Build a screen-reader–friendly label for the key combo.
   */
  const resolvedKeysLabel = $derived(keysLabel ?? keys.join(' plus '));
</script>

<!--
  The visual keycaps are aria-hidden so assistive technology never encounters the
  raw Kbd glyphs; the spoken representation is a single cinder-sr-only text node
  ("Ctrl plus S") — a more reliable strategy than aria-label on a generic span.
  Keycaps are inlined (not a {#snippet}) to avoid a Svelte 5 + happy-dom snippet
  ordering quirk when a snippet is the first child of an {#if} branch.
-->
<span {...rest} class={classNames('cinder-shortcut-hint', customClassName)}>
  {#if children && keysPosition === 'after'}
    <span class="cinder-shortcut-hint__label">{@render children()}</span>
  {/if}

  <span class="cinder-shortcut-hint__keys" aria-hidden="true">
    {#each keys as key, index (index)}
      <Kbd label={key} size="sm" />
      {#if index < keys.length - 1}
        <span class="cinder-shortcut-hint__separator">+</span>
      {/if}
    {/each}
  </span>
  <span class="cinder-sr-only">{resolvedKeysLabel}</span>

  {#if children && keysPosition === 'before'}
    <span class="cinder-shortcut-hint__label">{@render children()}</span>
  {/if}
</span>
