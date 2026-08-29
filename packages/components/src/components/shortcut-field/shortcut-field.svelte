<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Keyboard shortcut recorder that captures normalized modifier combinations and announces validation results.
   * @tag form
   * @tag keyboard
   * @useWhen Letting a user assign or replace an application keyboard shortcut.
   * @avoidWhen Displaying a shortcut without editing it—use kbd or shortcut-hint.
   * @related kbd, shortcut-hint
   */
  export type { ShortcutFieldProps } from './shortcut-field.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Kbd from '../kbd/kbd.svelte';
  import type { ShortcutFieldProps } from './shortcut-field.types.ts';
  let {
    value = $bindable<string[]>([]),
    onValueChange,
    validate,
    label = 'Keyboard shortcut',
    disabled = false,
    class: className,
    ...rest
  }: ShortcutFieldProps = $props();
  let armed = $state(false);
  let message = $state('');
  const modifierNames = new Set(['Meta', 'Control', 'Alt', 'Shift']);
  function normalize(event: KeyboardEvent): string[] {
    const modifiers = [
      event.metaKey ? 'Meta' : '',
      event.ctrlKey ? 'Control' : '',
      event.altKey ? 'Alt' : '',
      event.shiftKey ? 'Shift' : '',
    ].filter(Boolean);
    const key = modifierNames.has(event.key) ? '' : event.key === ' ' ? 'Space' : event.key;
    return [...modifiers, ...(key ? [key] : [])];
  }
  function handleKeydown(event: KeyboardEvent): void {
    if (disabled || !armed) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      armed = false;
      message = 'Shortcut capture cancelled';
      return;
    }
    const next = normalize(event);
    if (next.length === 0) return;
    const error = validate?.(next);
    if (error) {
      message = error;
      return;
    }
    value = next;
    onValueChange?.(next);
    message = `Captured ${next.join(' plus ')}`;
    armed = false;
  }
  function clear(): void {
    value = [];
    onValueChange?.([]);
    message = 'Shortcut cleared';
  }
</script>

<div {...rest} class={classNames('cinder-shortcut-field', className)}>
  <div
    role="textbox"
    tabindex={disabled ? -1 : 0}
    aria-readonly="true"
    aria-label={label}
    aria-disabled={disabled ? 'true' : undefined}
    class="cinder-shortcut-field__control"
    onfocus={() => (armed = true)}
    onclick={() => (armed = true)}
    onkeydown={handleKeydown}
  >
    {#if value.length}{#each value as key (key)}<Kbd label={key} size="sm" />{/each}{:else}<span
        class="cinder-shortcut-field__placeholder"
        >{armed ? 'Press a key combination' : 'Click to record shortcut'}</span
      >{/if}
  </div>
  {#if value.length}<button
      type="button"
      class="cinder-shortcut-field__clear"
      aria-label="Clear shortcut"
      onclick={clear}>Clear</button
    >{/if}
  <div class="cinder-sr-only" aria-live="polite">{message}</div>
</div>
