<script lang="ts" module>
  /**
   * @cinder
   * @category typography
   * @status alpha
   * @purpose Grouped keyboard-shortcut reference that renders key combos via Kbd with accessible labels not reliant only on visual keycaps.
   * @tag shortcut
   * @tag keyboard
   * @useWhen Displaying a reference panel of keyboard shortcuts grouped by feature area.
   * @useWhen Embedding a shortcut table inside a modal, sheet, popover, or help page.
   * @avoidWhen Showing a single inline shortcut hint — use shortcut-hint instead.
   * @related kbd, shortcut-hint, modal, sheet, popover
   */
  export type {
    KeyboardShortcutEntry,
    KeyboardShortcutGroup,
    KeyboardShortcutsProps,
  } from './keyboard-shortcuts.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Kbd from '../kbd/kbd.svelte';
  import type { KeyboardShortcutsProps } from './keyboard-shortcuts.types.ts';

  let {
    groups,
    heading,
    children,
    class: customClassName,
    ...rest
  }: KeyboardShortcutsProps = $props();

  // A stable, unique, SSR-safe id base. Group heading ids are derived from this
  // plus the group's INDEX — never from group.label, which can repeat (duplicate
  // ids break aria-labelledby).
  const baseId = $props.id();
  const groupHeadingId = (index: number) => `${baseId}-group-${index}`;

  /**
   * Build a screen-reader–friendly label for a key combo.
   * Falls back to joining keys with " plus " when no keysLabel is provided.
   */
  function resolveKeysLabel(keys: string[], keysLabel: string | undefined = undefined): string {
    if (keysLabel) return keysLabel;
    return keys.join(' plus ');
  }
</script>

<div {...rest} class={classNames('cinder-keyboard-shortcuts', customClassName)}>
  {#if heading}
    <h2 class="cinder-keyboard-shortcuts__heading">{heading}</h2>
  {/if}

  {#if children}
    <div class="cinder-keyboard-shortcuts__intro">
      {@render children()}
    </div>
  {/if}

  {#each groups as group, groupIndex (groupIndex)}
    <section class="cinder-keyboard-shortcuts__group" aria-labelledby={groupHeadingId(groupIndex)}>
      <h3 id={groupHeadingId(groupIndex)} class="cinder-keyboard-shortcuts__group-label">
        {group.label}
      </h3>

      <dl class="cinder-keyboard-shortcuts__list">
        {#each group.shortcuts as shortcut, shortcutIndex (shortcutIndex)}
          <div class="cinder-keyboard-shortcuts__row">
            <dt class="cinder-keyboard-shortcuts__action">{shortcut.action}</dt>
            <dd class="cinder-keyboard-shortcuts__keys">
              <!-- Screen-reader label for the whole key combo. -->
              <span class="cinder-sr-only"
                >{resolveKeysLabel(shortcut.keys, shortcut.keysLabel)}</span
              >
              <!-- Visual presentation via Kbd. aria-hidden so the sr-only span is the announced text. -->
              <span aria-hidden="true" class="cinder-keyboard-shortcuts__keys-visual">
                {#each shortcut.keys as key, index (key + index)}
                  <Kbd label={key} size="sm" />
                  {#if index < shortcut.keys.length - 1}
                    <span class="cinder-keyboard-shortcuts__separator">+</span>
                  {/if}
                {/each}
              </span>
            </dd>
          </div>
        {/each}
      </dl>
    </section>
  {/each}
</div>
