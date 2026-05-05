<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { IconComponent } from './icons/index.ts';

  export type SegmentedControlOption<T extends string = string> = {
    value: T;
    label: string;
    icon?: IconComponent;
    controls?: string | undefined;
    disabled?: boolean;
  };

  export type SegmentedControlProps<T extends string = string> = Omit<
    HTMLAttributes<HTMLDivElement>,
    'id' | 'onchange'
  > & {
    /** Unique identifier for the control. */
    id: string;
    /** Selected option value. */
    value?: T;
    /** Available options. */
    options: readonly SegmentedControlOption<T>[];
    /** Accessible label for the radio group. */
    label: string;
    /** Visually hide the label while keeping it available to assistive technology. */
    hideLabel?: boolean;
    /** Disable the whole control. */
    disabled?: boolean;
    /** ARIA interaction pattern. Use `tablist` when options switch visible panels. */
    variant?: 'radiogroup' | 'tablist';
    /** Additional class names merged with `.cinder-segmented-control`. */
    class?: string;
    /** Called when the selected value changes. */
    onchange?: (value: T) => void;
  };
</script>

<script lang="ts" generics="T extends string = string">
  import { classNames } from '../utilities/class-names.ts';
  import { getFocusableIndex, handleRovingKeydown } from '../utilities/roving-tabindex.ts';

  let {
    id,
    value = $bindable<T>(),
    options,
    label,
    hideLabel = false,
    disabled = false,
    variant = 'radiogroup',
    class: customClassName,
    onchange,
    ...rest
  }: SegmentedControlProps<T> = $props();

  let focusedIndex = $state<number | null>(null);

  const selectedIndex = $derived(options.findIndex((option) => option.value === value));
  const isOptionDisabled = (index: number) => disabled || options[index]?.disabled === true;
  const focusableIndex = $derived(
    getFocusableIndex(selectedIndex, options.length, isOptionDisabled),
  );

  function selectOption(index: number): void {
    const option = options[index];
    if (!option || disabled || option.disabled) return;
    value = option.value;
    onchange?.(option.value);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (disabled) return;

    const currentIndex = focusedIndex ?? (selectedIndex >= 0 ? selectedIndex : focusableIndex);
    const nextIndex = handleRovingKeydown(event, currentIndex, options.length, {
      isDisabled: isOptionDisabled,
    });

    if (nextIndex === null) return;

    event.preventDefault();
    if (nextIndex === currentIndex) return;

    selectOption(nextIndex);
    focusedIndex = nextIndex;
    document.getElementById(`${id}-option-${nextIndex}`)?.focus();
  }

  const groupRole = $derived(variant === 'tablist' ? 'tablist' : 'radiogroup');
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
    {id}
    role={groupRole}
    aria-labelledby={`${id}-label`}
    aria-disabled={disabled ? 'true' : undefined}
    aria-orientation="horizontal"
    class={classNames('cinder-segmented-control', customClassName)}
    data-cinder-disabled={disabled ? '' : undefined}
    data-cinder-variant={variant}
    onkeydown={handleKeydown}
    {...rest}
  >
    {#each options as option, index (option.value)}
      {@const isSelected = option.value === value}
      {@const isDisabled = disabled || option.disabled === true}
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
        onclick={() => selectOption(index)}
        onfocus={() => (focusedIndex = index)}
        onblur={() => (focusedIndex = null)}
      >
        {#if option.icon}
          <option.icon class="icon-xs cinder-segmented-control-option-icon" aria-hidden="true" />
        {/if}
        {option.label}
      </button>
    {/each}
  </div>
</div>
