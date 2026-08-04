<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Wrapper primitive that pairs a single control with its label, description, and error and wires the ARIA association via context.
   * @tag form
   * @tag wrapper
   * @useWhen Composing a one-off field where the input does not own its own label rendering.
   * @useWhen Forwarding shared required, disabled, and error state to an opted-in child control.
   * @avoidWhen Grouping multiple related controls under one heading — use form-section instead.
   * @related form-section, label, input
   */
  export type { FormFieldProps } from './form-field.types.ts';
</script>

<script lang="ts">
  import type { FormFieldProps } from './form-field.types.ts';
  import FormFieldFrame from '../../_internal/form-field-frame.svelte';

  let {
    id,
    label,
    hideLabel = false,
    description,
    error,
    required = false,
    disabled = false,
    class: className,
    children,
  }: FormFieldProps = $props();
</script>

<FormFieldFrame
  {id}
  {label}
  {hideLabel}
  {description}
  {error}
  {required}
  {disabled}
  class={className}
  control={children}
/>
