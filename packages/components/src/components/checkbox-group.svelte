<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * Props for the CheckboxGroup component.
   *
   * Wraps a set of independent checkboxes in a `<fieldset>` + `<legend>`
   * structure for semantic grouping. Unlike RadioGroup, this component does
   * NOT own a shared `value` or `name` — each child `<Checkbox>` owns its
   * own name and checked state. Native `<fieldset disabled>` propagation
   * handles the disabled cascade without any Svelte context.
   */
  export type CheckboxGroupProps = {
    /** Optional legend rendered as a `<legend>` inside the `<fieldset>`. */
    legend?: string;
    /** Helper text below the group; wired via `aria-describedby` on the fieldset. */
    description?: string;
    /**
     * Group-level validation message. Rendered as a polite live region and
     * referenced by the fieldset's `aria-describedby`. Also sets
     * `aria-invalid="true"` on the fieldset itself as a supplementary signal.
     *
     * Note: fieldset-level `aria-describedby` is not reliably re-announced as
     * focus moves between descendants. This is best-effort supplemental context
     * — if a specific control must announce as invalid on focus, pass `error`
     * to that `<Checkbox>` directly.
     */
    error?: string;
    /**
     * Disables every native form control inside via the fieldset's built-in
     * cascade. Renders as the native `disabled` attribute on `<fieldset>`.
     */
    disabled?: boolean;
    /**
     * Marks the group as visually required. Sets `data-cinder-required` on the
     * fieldset so consumers can target it (e.g. legend asterisk).
     *
     * This is a visual/data-attribute hint. It does NOT set `required` on any
     * child `<input>` and does NOT enforce constraint validation. Per-control
     * `required` must be set on the individual `<Checkbox>`.
     */
    required?: boolean;
    /**
     * Layout variant. `'default'` is a stacked column. `'card'` styles each
     * direct child `.cinder-checkbox-field` as a bordered card row.
     *
     * Always emitted as `data-variant` on the fieldset. Card variant assumes
     * each direct child of the items container is a single `<Checkbox>`.
     */
    variant?: 'default' | 'card';
    /** Additional class names merged with `.cinder-checkbox-group`. */
    class?: string;
    /** Checkbox children. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { cn } from '../utilities/class-names.ts';
  import { useId } from '../utilities/use-id.ts';

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
