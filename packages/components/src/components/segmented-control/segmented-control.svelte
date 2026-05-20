<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Compact radio-style selector that surfaces a small fixed set of options as a single connected bar and binds the chosen value.
   * @tag form
   * @tag selection
   * @useWhen Choosing one of two to five mutually exclusive options that all fit on screen at once.
   * @useWhen Picking a view filter where seeing every option beats hiding them inside a toggle or tabs control.
   * @avoidWhen Toggling a single binary on or off — use toggle or checkbox instead.
   * @avoidWhen Switching between panels of associated content — use tabs instead.
   * @related toggle, checkbox, tabs, button-group
   */
  export type { SegmentedControlOption, SegmentedControlProps } from './segmented-control.types.ts';
</script>

<script lang="ts" generics="T extends string = string">
  import { SvelteSet } from 'svelte/reactivity';

  import { classNames } from '../../utilities/class-names.ts';
  import { getFocusableIndex, handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import type { SegmentedControlProps } from './segmented-control.types.ts';

  let {
    id,
    value = $bindable<T | SvelteSet<T> | undefined>(),
    options,
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
    ...rest
  }: SegmentedControlProps<T> = $props();

  let focusedIndex = $state<number | null>(null);

  const selectedIndex = $derived(
    selectionMode === 'single'
      ? options.findIndex((option) => option.value === (value as T | undefined))
      : -1,
  );

  const isOptionDisabled = (index: number) => disabled || options[index]?.disabled === true;

  const focusableIndex = $derived.by((): number => {
    if (selectionMode !== 'single') return -1;
    const candidate = getFocusableIndex(selectedIndex, options.length, isOptionDisabled);
    if (candidate >= 0 && isOptionDisabled(candidate)) return -1;
    return candidate;
  });

  function handleSingleClick(index: number): void {
    const option = options[index];
    if (!option || disabled || option.disabled) return;

    const currentValue = value as T | undefined;
    if (option.value === currentValue) {
      if (!disallowEmptySelection) {
        (value as any) = undefined;
      }
      return;
    }

    (value as any) = option.value;
    onchange?.(option.value);
  }

  function handleMultipleClick(index: number): void {
    const option = options[index];
    if (!option || disabled || option.disabled) return;

    const set = value as SvelteSet<T> | undefined;
    if (!set) return;

    if (set.has(option.value)) {
      set.delete(option.value);
    } else {
      set.add(option.value);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (disabled || selectionMode !== 'single') return;

    const currentIndex = focusedIndex ?? (selectedIndex >= 0 ? selectedIndex : focusableIndex);
    const nextIndex = handleRovingKeydown(event, currentIndex, options.length, {
      isDisabled: isOptionDisabled,
      vertical: true,
      horizontal: orientation !== 'vertical',
    });

    if (nextIndex === null) return;

    event.preventDefault();
    if (nextIndex === currentIndex) return;

    handleSingleClick(nextIndex);
    focusedIndex = nextIndex;
    document.getElementById(`${id}-option-${nextIndex}`)?.focus();
  }

  function isPressed(optionValue: T): boolean {
    if (selectionMode !== 'multiple') return false;
    const set = value as SvelteSet<T> | undefined;
    return set?.has(optionValue) ?? false;
  }

  const groupRole = $derived(
    selectionMode === 'multiple' ? 'group' : variant === 'tablist' ? 'tablist' : 'radiogroup',
  );

  const optionRole = $derived(variant === 'tablist' ? 'tab' : 'radio');
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
    onkeydown={selectionMode === 'single' ? handleKeydown : undefined}
  >
    {#each options as option, index (option.value)}
      {@const isDisabled = disabled || option.disabled === true}
      {#if selectionMode === 'single'}
        {@const isSelected = option.value === (value as T | undefined)}
        <button
          id={`${id}-option-${index}`}
          type="button"
          role={optionRole}
          aria-checked={variant === 'radiogroup' ? isSelected : undefined}
          aria-selected={variant === 'tablist' ? isSelected : undefined}
          aria-controls={variant === 'tablist' ? option.controls : undefined}
          aria-disabled={isDisabled ? 'true' : undefined}
          disabled={isDisabled}
          tabindex={index === focusableIndex ? 0 : -1}
          class="cinder-segmented-control-option"
          data-cinder-selected={isSelected ? '' : undefined}
          onclick={() => handleSingleClick(index)}
          onfocus={() => (focusedIndex = index)}
          onblur={() => (focusedIndex = null)}
        >
          {#if option.icon}
            <option.icon class="icon-xs cinder-segmented-control-option-icon" aria-hidden="true" />
          {/if}
          {option.label}
        </button>
      {:else}
        {@const pressed = isPressed(option.value)}
        <button
          id={`${id}-option-${index}`}
          type="button"
          aria-pressed={pressed}
          disabled={isDisabled}
          class="cinder-segmented-control-option"
          data-cinder-pressed={pressed ? '' : undefined}
          onclick={() => handleMultipleClick(index)}
        >
          {#if option.icon}
            <option.icon class="icon-xs cinder-segmented-control-option-icon" aria-hidden="true" />
          {/if}
          {option.label}
        </button>
      {/if}
    {/each}
  </div>
</div>
