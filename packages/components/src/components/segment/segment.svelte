<script lang="ts" module>
  export type { SegmentProps } from './segment.types.ts';
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import { classNames } from '../../utilities/class-names.ts';
  import { getSegmentedControlContext } from '../segmented-control/segmented-control-state.svelte.ts';
  import type { SegmentProps } from './segment.types.ts';

  let {
    value,
    disabled = false,
    controls,
    leading,
    trailing,
    children,
    class: customClassName,
    ...rest
  }: SegmentProps = $props();

  const context = getSegmentedControlContext();

  const registerSegment: Attachment<HTMLButtonElement> = (node) => {
    // Attachments run inside a tracked effect. Wrap the call to register() in
    // `untrack` so the controller's mutation of its internal state does not
    // re-arm this attachment, which would otherwise unregister + re-register
    // on every render and starve the reactivity graph. The registration
    // object exposes props via getters so prop changes flow live to consumers
    // without needing to re-register.
    return untrack(() =>
      context.register({
        node,
        get value() {
          return value;
        },
        get disabled() {
          return disabled || context.controlDisabled;
        },
        get controls() {
          return controls;
        },
      }),
    );
  };

  const isSelected = $derived(context.isSelected(value));
  const isFocusable = $derived(context.isFocusable(value));
  const effectiveDisabled = $derived(disabled || context.controlDisabled);

  const role = $derived(
    context.selectionMode === 'multiple'
      ? undefined
      : context.variant === 'tablist'
        ? 'tab'
        : 'radio',
  );
</script>

<button
  {...rest}
  type="button"
  {role}
  data-cinder-segment-value={value}
  aria-checked={role === 'radio' ? isSelected : undefined}
  aria-selected={role === 'tab' ? isSelected : undefined}
  aria-pressed={context.selectionMode === 'multiple' ? isSelected : undefined}
  aria-controls={role === 'tab' ? controls : undefined}
  aria-disabled={effectiveDisabled ? 'true' : undefined}
  disabled={effectiveDisabled}
  tabindex={isFocusable ? 0 : -1}
  class={classNames('cinder-segmented-control-option', customClassName)}
  data-cinder-selected={isSelected ? '' : undefined}
  data-cinder-pressed={context.selectionMode === 'multiple' && isSelected ? '' : undefined}
  onclick={() => context.toggle(value)}
  onfocus={() => context.onSegmentFocus(value)}
  onblur={() => context.onSegmentBlur()}
  {@attach registerSegment}
>
  {#if leading}
    <span class="cinder-segmented-control-option-icon" aria-hidden="true">
      {@render leading()}
    </span>
  {/if}
  {@render children()}
  {#if trailing}
    <span class="cinder-segmented-control-option-trailing" aria-hidden="true">
      {@render trailing()}
    </span>
  {/if}
</button>
