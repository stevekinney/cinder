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
  let validationError = $state('');
  const modifierNames = new Set(['Meta', 'Control', 'Alt', 'Shift']);
  function normalize(event: KeyboardEvent): string[] {
    const modifiers = [
      event.metaKey ? 'Meta' : '',
      event.ctrlKey ? 'Control' : '',
      event.altKey ? 'Alt' : '',
      event.shiftKey ? 'Shift' : '',
    ].filter(Boolean);
    const rawKey = event.key === ' ' ? 'Space' : event.key;
    const key = modifierNames.has(rawKey)
      ? ''
      : rawKey.length === 1 && /[a-z]/i.test(rawKey)
        ? rawKey.toUpperCase()
        : rawKey;
    return [...modifiers, ...(key ? [key] : [])];
  }
  function handleKeydown(event: KeyboardEvent): void {
    if (disabled || !armed) return;
    if (event.key === 'Tab') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      armed = false;
      message = 'Shortcut capture cancelled';
      return;
    }
    if (modifierNames.has(event.key)) return;
    const next = normalize(event);
    if (next.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const error = validate?.(next);
    if (error) {
      message = error;
      validationError = error;
      return;
    }
    validationError = '';
    value = next;
    onValueChange?.(next);
    message = `Captured ${next.join(' plus ')}`;
    armed = false;
  }
  function clear(): void {
    if (disabled) return;
    value = [];
    onValueChange?.([]);
    message = 'Shortcut cleared';
    validationError = '';
  }

  function arm(): void {
    if (!disabled) armed = true;
  }
</script>

<div {...rest} class={classNames('cinder-shortcut-field', className)}>
  <div
    role="textbox"
    tabindex={disabled ? -1 : 0}
    aria-readonly="true"
    aria-label={label}
    aria-disabled={disabled ? 'true' : undefined}
    aria-invalid={validationError ? 'true' : undefined}
    aria-describedby={validationError ? `${rest.id ?? 'shortcut-field'}-error` : undefined}
    class="cinder-shortcut-field__control"
    onfocus={arm}
    onclick={arm}
    onkeydown={handleKeydown}
    onblur={() => (armed = false)}
  >
    {#if value.length}{#each value as key (key)}<Kbd label={key} size="sm" />{/each}{:else}<span
        class="cinder-shortcut-field__placeholder"
        >{armed ? 'Press a key combination' : 'Click to record shortcut'}</span
      >{/if}
  </div>
  {#if value.length && !disabled}<button
      type="button"
      class="cinder-shortcut-field__clear"
      aria-label="Clear shortcut"
      onclick={clear}>Clear</button
    >{/if}
  {#if validationError}<div
      id={`${rest.id ?? 'shortcut-field'}-error`}
      class="cinder-shortcut-field__error"
    >
      {validationError}
    </div>{/if}
  <div class="cinder-sr-only" aria-live="polite">{message}</div>
</div>
