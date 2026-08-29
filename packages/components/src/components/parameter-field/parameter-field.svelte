<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Numeric parameter editor that distinguishes an inherited base value from a local override and makes reset state explicit.
   * @tag form
   * @tag numeric
   * @useWhen Editing a numeric setting that inherits a default but can be overridden locally.
   * @avoidWhen Collecting an independent numeric value with no inheritance semantics — use number-input or slider.
   * @related number-input, slider, badge
   * @rationale Nearest alternative: NumberInput — ParameterField adds base/override ownership, reset, and change-state semantics around the numeric editor.
   */
  export type { ParameterFieldEditorState, ParameterFieldProps } from './parameter-field.types.ts';
</script>

<script lang="ts">
  import Badge from '../badge/badge.svelte';
  import Tooltip from '../tooltip/tooltip.svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import type { ParameterFieldProps } from './parameter-field.types.ts';

  let {
    id,
    label,
    base,
    override = $bindable<number | undefined>(undefined),
    unit,
    onOverrideChange,
    unsaved = false,
    experimental = false,
    children,
    class: className,
  }: ParameterFieldProps = $props();

  const overridden = $derived(override !== undefined);
  const value = $derived(override ?? base);
  const formattedBase = $derived(`${String(base)}${unit ? ` ${unit}` : ''}`);

  function setOverride(next: number): void {
    if (!Number.isFinite(next)) return;
    override = next;
    onOverrideChange?.(next);
  }

  function reset(): void {
    override = undefined;
    onOverrideChange?.(undefined);
  }
</script>

<div
  class={classNames('cinder-parameter-field', className)}
  data-overridden={overridden || undefined}
  data-unsaved={unsaved || undefined}
>
  <div class="cinder-parameter-field__header">
    <span id={`${id}-label`} class="cinder-parameter-field__label">{label}</span>
    <span class="cinder-parameter-field__badges">
      {#if unsaved}
        <Badge size="xs" variant="warning">Unsaved</Badge>
      {/if}
      {#if experimental}
        <Badge size="xs" variant="info">Experimental</Badge>
      {/if}
    </span>
  </div>

  <div class="cinder-parameter-field__body">
    <span class="cinder-parameter-field__rail" aria-hidden="true"></span>
    <div class="cinder-parameter-field__editor" aria-labelledby={`${id}-label`}>
      {#if children}
        {@render children({ value, overridden, setOverride })}
      {:else}
        <output id={`${id}-value`} class="cinder-parameter-field__value">
          {value}{#if unit}<span class="cinder-parameter-field__unit"> {unit}</span>{/if}
        </output>
      {/if}
    </div>
  </div>

  {#if overridden}
    <Tooltip text={`Reset to default (${formattedBase})`}>
      <button type="button" class="cinder-parameter-field__reset" onclick={reset}>
        Reset to default
      </button>
    </Tooltip>
  {/if}
</div>
