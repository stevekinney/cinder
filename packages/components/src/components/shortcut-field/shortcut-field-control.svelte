<script lang="ts">
  /**
   * Private control for `<ShortcutField>`. Rendered under `FormFieldFrame`'s
   * `control` snippet — a real child component (not inline markup in
   * `shortcut-field.svelte`'s own script) so `getFormFieldContext()` here
   * resolves the `FormFieldProvider` context `FormFieldFrame` sets moments
   * earlier, not a self-computed guess. See shortcut-field.svelte and COR-443.
   */
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import Kbd from '../kbd/kbd.svelte';

  let {
    value = $bindable<string[]>([]),
    onValueChange,
    validate,
    validationError = $bindable(''),
  }: {
    value?: string[] | undefined;
    onValueChange?: ((value: string[]) => void) | undefined;
    validate?: ((value: string[]) => string | undefined) | undefined;
    validationError?: string | undefined;
  } = $props();

  const context = getFormFieldContext();

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
    const rawKey = event.key === ' ' ? 'Space' : event.key;
    const key = modifierNames.has(rawKey)
      ? ''
      : rawKey.length === 1 && /[a-z]/i.test(rawKey)
        ? rawKey.toUpperCase()
        : rawKey;
    return [...modifiers, ...(key ? [key] : [])];
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (context?.disabled || !armed) return;
    if (event.key === 'Tab') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      armed = false;
      message = 'Shortcut capture cancelled';
      validationError = '';
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
    if (context?.disabled) return;
    value = [];
    onValueChange?.([]);
    message = 'Shortcut cleared';
    validationError = '';
  }

  function arm(): void {
    if (!context?.disabled) armed = true;
  }
</script>

<div
  id={context?.controlId}
  role="textbox"
  tabindex={context?.disabled ? -1 : 0}
  aria-readonly="true"
  aria-labelledby={context?.labelId}
  aria-describedby={context?.describedBy}
  aria-invalid={context?.invalid}
  aria-disabled={context?.disabled ? 'true' : undefined}
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
{#if value.length && !context?.disabled}<button
    type="button"
    class="cinder-shortcut-field__clear"
    aria-label="Clear shortcut"
    onclick={clear}>Clear</button
  >{/if}
<div class="cinder-sr-only" aria-live="polite">{message}</div>
