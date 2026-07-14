<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Compact segmented selector that surfaces a small fixed set of options as a connected bar, including bindable selections and route-backed links.
   * @tag form
   * @tag selection
   * @useWhen Choosing one of two to five mutually exclusive options that all fit on screen at once.
   * @useWhen Picking a view filter where seeing every option beats hiding them inside a toggle or tabs control.
   * @useWhen Rendering route-backed filters as real links with `variant="navigation"` and `Segment href`.
   * @avoidWhen Toggling a single binary on or off — use toggle or checkbox instead.
   * @avoidWhen Switching between panels of associated content — use tabs instead.
   * @related toggle, checkbox, tabs, button-group
   */
  export type { SegmentedControlProps } from './segmented-control.types.ts';
</script>

<script lang="ts" generics="T extends string = string">
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

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
    name,
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
  let resetInputElement = $state<HTMLInputElement | null>(null);
  let resetSyncTimeout: ReturnType<typeof setTimeout> | undefined;
  const initialSingleValue = untrack(() => (typeof value === 'string' ? value : undefined));
  const initialMultipleValues = untrack(() =>
    selectionMode === 'multiple' && value instanceof SvelteSet ? Array.from(value) : undefined,
  );
  const effectiveVariant = $derived(
    variant === 'navigation' && selectionMode === 'multiple' ? 'radiogroup' : variant,
  );
  const rendersNavigation = $derived(effectiveVariant === 'navigation');

  const controller = new SegmentedControlController({
    selectionMode: () => selectionMode,
    variant: () => effectiveVariant,
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
      return effectiveVariant;
    },
    get controlDisabled() {
      return disabled;
    },
    register: (registration) => controller.register(registration),
    isSelected: (segmentValue) => controller.isSelected(segmentValue),
    isFocusable: (segmentValue) => controller.isFocusable(segmentValue),
    toggle: (segmentValue) => controller.toggle(segmentValue),
  };

  setSegmentedControlContext(contextValue);

  // See docs/decisions/segmented-control-tablist-variant.md for why tablist remains a SegmentedControl variant.
  const groupRole = $derived(
    selectionMode === 'multiple'
      ? 'group'
      : variant === 'navigation'
        ? undefined
        : variant === 'tablist'
          ? 'tablist'
          : 'radiogroup',
  );

  // When density="toolbar" is requested it resolves to the compact `sm` visual
  // size — explicit `size` values are ignored while toolbar density is on so
  // toolbars line up with sibling toolbar controls. `data-cinder-size` reflects
  // this resolved size; raw requested `size` is not surfaced through the DOM.
  const effectiveSize = $derived(density === 'toolbar' ? 'sm' : size);
  const selectedValues = $derived(
    selectionMode === 'multiple'
      ? value instanceof SvelteSet
        ? Array.from(value as SvelteSet<T>)
        : []
      : typeof value === 'string'
        ? [value]
        : [],
  );

  function resetToInitialValue(event: Event): void {
    if (resetSyncTimeout !== undefined) clearTimeout(resetSyncTimeout);
    resetSyncTimeout = setTimeout(() => {
      resetSyncTimeout = undefined;
      if (event.defaultPrevented) return;
      if (selectionMode === 'multiple') {
        value =
          initialMultipleValues === undefined
            ? undefined
            : new SvelteSet(initialMultipleValues as T[]);
        return;
      }
      value = initialSingleValue as T | undefined;
    }, 0);
  }

  $effect(() => {
    const input = resetInputElement;
    if (input === null) return;
    const form = input.form;
    form?.addEventListener('reset', resetToInitialValue);
    return () => {
      form?.removeEventListener('reset', resetToInitialValue);
      if (resetSyncTimeout !== undefined) {
        clearTimeout(resetSyncTimeout);
        resetSyncTimeout = undefined;
      }
    };
  });
</script>

<div class="cinder-segmented-control-container">
  <span
    id={`${id}-label`}
    class={classNames('cinder-segmented-control-label', hideLabel && 'cinder-sr-only')}
  >
    {label}
  </span>
  {#if rendersNavigation}
    <nav
      {...rest}
      {id}
      role="navigation"
      aria-labelledby={`${id}-label`}
      data-cinder-orientation={orientation}
      data-cinder-size={effectiveSize}
      data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
      data-cinder-selection-mode={selectionMode}
      data-cinder-detached={detached ? '' : undefined}
      data-cinder-full-width={fullWidth ? '' : undefined}
      data-cinder-variant={effectiveVariant}
      class={classNames('cinder-segmented-control', customClassName)}
    >
      {@render children()}
    </nav>
  {:else}
    <div
      {...rest}
      {id}
      role={groupRole}
      aria-labelledby={`${id}-label`}
      aria-disabled={disabled ? 'true' : undefined}
      aria-orientation={selectionMode === 'single' ? orientation : undefined}
      data-cinder-orientation={orientation}
      data-cinder-size={effectiveSize}
      data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
      data-cinder-selection-mode={selectionMode}
      data-cinder-detached={detached ? '' : undefined}
      data-cinder-full-width={fullWidth ? '' : undefined}
      data-cinder-variant={effectiveVariant}
      class={classNames('cinder-segmented-control', customClassName)}
      onkeydown={(event) => controller.handleKeydown(event)}
    >
      {@render children()}
    </div>
  {/if}
  {#if name && !rendersNavigation}
    <input bind:this={resetInputElement} type="hidden" disabled />
    {#each selectedValues as selectedValue (selectedValue)}
      <input type="hidden" {name} value={selectedValue} {disabled} />
    {/each}
  {/if}
</div>
