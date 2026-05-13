<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { SvelteSet } from 'svelte/reactivity';

  export type SegmentedControlOption<T extends string = string> = {
    value: T;
    label: string;
    disabled?: boolean;
  };

  type ComponentOwnedAttributes =
    | 'id'
    | 'class'
    | 'role'
    | 'tabindex'
    | 'aria-label'
    | 'aria-labelledby'
    | 'aria-disabled'
    | 'aria-orientation'
    | 'onkeydown';

  type CommonProps<T extends string> = Omit<
    HTMLAttributes<HTMLDivElement>,
    ComponentOwnedAttributes
  > & {
    /** Unique identifier for the control. */
    id: string;
    /** Accessible label for the group. */
    label: string;
    /** Visually hide the label while keeping it available to assistive technology. */
    hideLabel?: boolean;
    /** Disable the whole control. */
    disabled?: boolean;
    /** Visual size of the control. */
    size?: 'sm' | 'md' | 'lg';
    /** Layout orientation. */
    orientation?: 'horizontal' | 'vertical';
    /** Show options as detached individual buttons instead of a unified strip. */
    detached?: boolean;
    /** Stretch the control to fill available width. */
    fullWidth?: boolean;
    /** Available options. */
    options: readonly SegmentedControlOption<T>[];
    /** Additional class names merged with `.cinder-segmented-control`. */
    class?: string;
  };

  type SingleProps<T extends string> = CommonProps<T> & {
    selectionMode?: 'single';
    /** Selected option value. */
    value?: T;
    /**
     * When true (default), clicking the already-selected option is a no-op.
     * When false, clicking the selected option clears value to undefined.
     */
    disallowEmptySelection?: boolean;
  };

  type MultipleProps<T extends string> = CommonProps<T> & {
    selectionMode: 'multiple';
    /** Set of selected option values. Must be a SvelteSet for reactivity. */
    value?: SvelteSet<T>;
    /** Not applicable in multiple mode — present for Svelte destructuring compatibility. */
    disallowEmptySelection?: undefined;
  };

  export type SegmentedControlProps<T extends string = string> = SingleProps<T> | MultipleProps<T>;
</script>

<script lang="ts" generics="T extends string = string">
  import { classNames } from '../utilities/class-names.ts';
  import { getFocusableIndex, handleRovingKeydown } from '../utilities/roving-tabindex.ts';

  let {
    id,
    value = $bindable<T | SvelteSet<T> | undefined>(),
    options,
    label,
    hideLabel = false,
    disabled = false,
    size = 'md',
    orientation = 'horizontal',
    detached = false,
    fullWidth = false,
    selectionMode = 'single',
    disallowEmptySelection = true,
    class: customClassName,
    ...rest
  }: SegmentedControlProps<T> = $props();

  // Single-mode state
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
    // If every option is disabled, getFocusableIndex falls back to index 0.
    // Don't give tabindex="0" to a disabled option — return -1 so no option is focusable.
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
      horizontal: true,
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
    role={selectionMode === 'single' ? 'radiogroup' : 'group'}
    aria-labelledby={`${id}-label`}
    aria-disabled={disabled ? 'true' : undefined}
    aria-orientation={selectionMode === 'single' ? orientation : undefined}
    data-cinder-orientation={orientation}
    data-cinder-size={size}
    data-cinder-selection-mode={selectionMode}
    data-cinder-detached={detached ? '' : undefined}
    data-cinder-full-width={fullWidth ? '' : undefined}
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
          role="radio"
          aria-checked={isSelected}
          disabled={isDisabled}
          tabindex={index === focusableIndex ? 0 : -1}
          class="cinder-segmented-control-option"
          data-cinder-selected={isSelected ? '' : undefined}
          onclick={() => handleSingleClick(index)}
          onfocus={() => (focusedIndex = index)}
          onblur={() => (focusedIndex = null)}
        >
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
          {option.label}
        </button>
      {/if}
    {/each}
  </div>
</div>
