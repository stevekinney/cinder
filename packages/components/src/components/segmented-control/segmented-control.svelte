<script lang="ts" module>
  export type { SegmentedControlProps } from './segmented-control.types.ts';
</script>

<script lang="ts" generics="T extends string = string">
  import type { SvelteSet } from 'svelte/reactivity';

  import { classNames } from '../../utilities/class-names.ts';

  import {
    SegmentedControlController,
    setSegmentedControlContext,
    type SegmentedControlContextValue,
  } from './segmented-control-state.svelte.ts';
  import type { SegmentedControlProps } from './segmented-control.types.ts';

  let {
    id,
    value = $bindable<T | SvelteSet<T> | undefined>(),
    label,
    hideLabel = false,
    disabled = false,
    size = 'md',
    density,
    orientation = 'horizontal',
    detached = false,
    fullWidth = false,
    variant = 'radiogroup',
    selectionMode = 'single',
    disallowEmptySelection = true,
    class: customClassName,
    onchange,
    children,
    ...rest
  }: SegmentedControlProps<T> = $props();

  const controller = new SegmentedControlController({
    selectionMode: () => selectionMode,
    variant: () => variant,
    orientation: () => orientation,
    controlDisabled: () => disabled,
    disallowEmptySelection: () => disallowEmptySelection,
    getValue: () => value as string | SvelteSet<string> | undefined,
    setValue: (next) => {
      value = next as T | SvelteSet<T> | undefined;
    },
    onChange: (selected) => onchange?.(selected as T),
  });

  const contextValue: SegmentedControlContextValue = {
    get selectionMode() {
      return selectionMode;
    },
    get variant() {
      return variant;
    },
    get controlDisabled() {
      return disabled;
    },
    register: (registration) => controller.register(registration),
    isSelected: (segmentValue) => controller.isSelected(segmentValue),
    isFocusable: (segmentValue) => controller.isFocusable(segmentValue),
    toggle: (segmentValue) => controller.toggle(segmentValue),
    onSegmentFocus: (segmentValue) => controller.onSegmentFocus(segmentValue),
    onSegmentBlur: () => controller.onSegmentBlur(),
  };

  setSegmentedControlContext(contextValue);

  const groupRole = $derived(
    selectionMode === 'multiple' ? 'group' : variant === 'tablist' ? 'tablist' : 'radiogroup',
  );
</script>

<div class="cinder-segmented-control-container">
  <span
    id={`${id}-label`}
    class={classNames('cinder-segmented-control-label', hideLabel && 'cinder-sr-only')}
  >
    {label}
  </span>
  <div
    {...rest}
    {id}
    role={groupRole}
    aria-labelledby={`${id}-label`}
    aria-disabled={disabled ? 'true' : undefined}
    aria-orientation={selectionMode === 'single' ? orientation : undefined}
    data-cinder-orientation={orientation}
    data-cinder-size={size}
    data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
    data-cinder-selection-mode={selectionMode}
    data-cinder-detached={detached ? '' : undefined}
    data-cinder-full-width={fullWidth ? '' : undefined}
    data-cinder-variant={variant}
    class={classNames('cinder-segmented-control', customClassName)}
    onkeydown={(event) => controller.handleKeydown(event)}
  >
    {@render children()}
  </div>
</div>
