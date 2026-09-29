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
  import FormFieldFrame from '../../_internal/form-field-frame.svelte';
  import ShortcutFieldControl from './shortcut-field-control.svelte';
  import type { ShortcutFieldProps } from './shortcut-field.types.ts';

  let {
    id: idProp,
    value = $bindable<string[]>([]),
    onValueChange,
    validate,
    label = 'Keyboard shortcut',
    labelVisible = true,
    disabled = false,
    class: className,
    ...rest
  }: ShortcutFieldProps = $props();

  const fallbackId = $props.id();
  const id = $derived(idProp ?? fallbackId);

  // Lifted out of the control so it can also drive FormFieldFrame's shared
  // `error` prop/live region — the control writes to it on a rejected chord
  // or an Escape cancellation; ShortcutField only reads it.
  let validationError = $state('');
</script>

{#snippet control()}
  <ShortcutFieldControl bind:value {onValueChange} {validate} bind:validationError />
{/snippet}

<FormFieldFrame
  {id}
  {label}
  {labelVisible}
  {disabled}
  error={validationError}
  errorMountedOnDemand
  class={classNames(
    'cinder-shortcut-field',
    disabled && 'cinder-shortcut-field--disabled',
    className,
  )}
  controlClass="cinder-shortcut-field__row"
  errorClass="cinder-shortcut-field__error"
  {control}
  {...rest}
/>
