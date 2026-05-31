<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Fieldset wrapper that groups independent checkboxes under a shared legend, description, and group-level error.
   * @tag form
   * @tag group
   * @useWhen Presenting several unrelated checkboxes that share a common heading or validation message.
   * @useWhen Cascading a disabled state to every child checkbox via native fieldset propagation.
   * @avoidWhen Picking exactly one option from a fixed set — use radio-group instead.
   * @related checkbox, radio-group, form-field
   */
  export type { CheckboxGroupProps } from './checkbox-group.types.ts';
</script>

<script lang="ts">
  import type { CheckboxGroupProps } from './checkbox-group.types.ts';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { cn } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';

  let {
    legend,
    description,
    error,
    disabled = false,
    required = false,
    variant = 'default',
    class: className,
    children,
  }: CheckboxGroupProps = $props();

  const groupId = useId('cinder-checkbox-group');
  const descriptionId = $derived(describeId(groupId, !!description));
  const errId = $derived(buildErrorId(groupId, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId));
</script>

<!--
  `aria-invalid` on the <fieldset> (implicit role=group) is a deliberate,
  best-effort supplemental signal — see checkbox-group.a11y.md. ARIA does not
  formally list aria-invalid for role=group and most screen readers do not
  announce it there, so the PRIMARY error signal is the visible aria-live region
  referenced by aria-describedby. This group wraps independent checkboxes and
  does not propagate its error to them; per-control aria-invalid is set by each
  <Checkbox> from its own `error` prop, which the consumer supplies when a
  specific control is invalid. The lint rule is suppressed for this documented,
  tested tradeoff.
-->
<!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
<fieldset
  class={cn('cinder-checkbox-group', className)}
  {disabled}
  aria-invalid={ariaInvalid(!!error)}
  aria-describedby={describedBy}
  data-cinder-disabled={disabled || undefined}
  data-cinder-required={required || undefined}
  data-variant={variant}
>
  {#if legend}
    <legend class="cinder-checkbox-group__legend">{legend}</legend>
  {/if}

  <div class="cinder-checkbox-group__items">
    {@render children()}
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-checkbox-group__description">{description}</p>
  {/if}

  {#if error}
    <p id={errId} class="cinder-checkbox-group__error" aria-live="polite">{error}</p>
  {/if}
</fieldset>
