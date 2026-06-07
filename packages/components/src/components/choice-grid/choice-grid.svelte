<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status alpha
   * @purpose Responsive grid of large selectable choices with roving keyboard focus, selection state, and optional correct/incorrect/pending feedback for quiz and assessment surfaces.
   * @tag form
   * @tag selection
   * @tag quiz
   * @tag assessment
   * @useWhen Presenting a small fixed set of large selectable answers where all options should stay visible (quiz or assessment surfaces).
   * @useWhen Building a touch-friendly selector grid with stable cell dimensions that must not shift when feedback states are applied.
   * @avoidWhen Selecting from a long dynamic list — use combobox or select instead.
   * @avoidWhen Choosing one of two to five short values in a compact inline context — use segmented-control instead.
   * @related choice-grid-item, segmented-control, radio-group, checkbox-group
   */
  export type {
    ChoiceGridColumns,
    ChoiceGridContext,
    ChoiceGridItemState,
    ChoiceGridProps,
  } from './choice-grid.types.ts';
</script>

<script lang="ts">
  import type { ChoiceGridProps } from './choice-grid.types.ts';
  import { setChoiceGridContext } from './choice-grid-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { createSingleSelection, createMultiSelection } from '../../_internal/collection.ts';
  import { handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';

  let {
    value = $bindable(null),
    values = $bindable([]),
    multiple = false,
    columns = 'responsive',
    minColumnWidth = '10rem',
    ariaLabel,
    ariaLabelledby,
    disabled = false,
    class: className,
    children,
    ...rest
  }: ChoiceGridProps = $props();

  // Registry of items keyed by value. Insertion order determines navigation
  // order (linear roving through the visual grid). `disabled` is tracked so both
  // the roving-tabindex computation and arrow-key navigation skip disabled items.
  type RegisteredItem = { element: HTMLElement; disabled: boolean };
  const items: Map<string, RegisteredItem> = new Map();
  let version = $state(0);

  const singleSelection = $derived(
    createSingleSelection(
      () => value ?? null,
      (next) => {
        value = next;
      },
    ),
  );

  const multiSelection = $derived(
    createMultiSelection(
      () => values,
      (next) => {
        values = next;
      },
    ),
  );

  function isSelected(candidate: string): boolean {
    if (multiple) {
      return multiSelection.isSelected(candidate);
    }
    return singleSelection.isSelected(candidate);
  }

  function select(candidate: string): void {
    if (disabled) return;
    if (multiple) {
      multiSelection.toggle(candidate);
    } else {
      singleSelection.select(candidate);
    }
  }

  function isItemDisabled(candidate: string): boolean {
    if (disabled) return true;
    return items.get(candidate)?.disabled ?? false;
  }

  // The single ENABLED value that should hold `tabindex="0"`. Disabled items are
  // never focusable: prefer the (enabled) selected value, else the first enabled
  // registered item. Returns null when every item is disabled.
  const focusableValue = $derived.by(() => {
    void version;
    void value;
    void values;
    const entries = [...items.entries()];
    if (entries.length === 0) return null;

    if (!multiple && value !== null && value !== undefined) {
      if (items.has(value) && !isItemDisabled(value)) return value;
    }
    if (multiple && values.length > 0) {
      for (const selected of values) {
        if (items.has(selected) && !isItemDisabled(selected)) return selected;
      }
    }
    for (const [key] of entries) {
      if (!isItemDisabled(key)) return key;
    }
    return null;
  });

  function isFocusable(candidate: string): boolean {
    // Subscribe to reactive inputs so this stays current inside $derived.
    void version;
    void value;
    void values;
    return focusableValue === candidate;
  }

  function register(itemValue: string, element: HTMLElement, itemDisabled: boolean): void {
    items.set(itemValue, { element, disabled: itemDisabled });
    version += 1;
  }

  function setItemDisabled(itemValue: string, itemDisabled: boolean): void {
    const existing = items.get(itemValue);
    if (existing && existing.disabled !== itemDisabled) {
      items.set(itemValue, { element: existing.element, disabled: itemDisabled });
      version += 1;
    }
  }

  function unregister(itemValue: string): void {
    if (items.delete(itemValue)) {
      version += 1;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    const keys = [...items.keys()];
    const currentIndex = keys.findIndex((key) => {
      const entry = items.get(key);
      return entry?.element === event.currentTarget || entry?.element === event.target;
    });

    if (currentIndex === -1) return;

    // Space/Enter: activate the currently focused item.
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      const focusedValue = keys[currentIndex];
      if (focusedValue !== undefined) {
        select(focusedValue);
      }
      return;
    }

    // Arrow keys: LINEAR roving through the visual grid in DOM order (the
    // responsive column count is layout-dependent, so v1 uses linear roving
    // rather than measured 2D movement). Disabled items are skipped.
    const nextIndex = handleRovingKeydown(event, currentIndex, keys.length, {
      horizontal: true,
      vertical: true,
      isDisabled: (index) => {
        const key = keys[index];
        return key === undefined ? true : isItemDisabled(key);
      },
    });

    if (nextIndex === null || nextIndex === currentIndex) return;
    event.preventDefault();

    const nextValue = keys[nextIndex];
    if (nextValue === undefined) return;
    items.get(nextValue)?.element.focus();

    // WAI-ARIA radiogroup pattern: arrow navigation also moves the selection in
    // single-select mode. Multi-select (checkbox semantics) only moves focus —
    // selection toggles on Space/Enter/click.
    if (!multiple) {
      select(nextValue);
    }
  }

  setChoiceGridContext({
    get value() {
      return value ?? null;
    },
    get multiple() {
      return multiple;
    },
    get disabled() {
      return disabled;
    },
    isSelected,
    select,
    register,
    setItemDisabled,
    unregister,
    isFocusable,
    handleKeydown,
  });

  // Dev-time guardrails for the two easy-to-miss API contracts.
  $effect(() => {
    if (values.length > 0 && !multiple) {
      devWarn(
        'ChoiceGrid: `values` was provided without `multiple`. Binding `values` does not enable multi-select — set `multiple` explicitly. The grid is operating in single-select mode and ignoring `values`.',
      );
    }
    if (ariaLabel === undefined && ariaLabelledby === undefined) {
      devWarn(
        'ChoiceGrid: no `ariaLabel` or `ariaLabelledby` provided. The radiogroup/group has no accessible name — pass one.',
      );
    }
  });

  // Grid template columns CSS.
  const gridTemplateColumns = $derived(
    columns === 'responsive'
      ? `repeat(auto-fill, minmax(min(${minColumnWidth}, 100%), 1fr))`
      : `repeat(${columns}, 1fr)`,
  );

  // ARIA role: radiogroup for single-select, group for multi-select.
  const role = $derived(multiple ? 'group' : 'radiogroup');
</script>

<div
  {...rest}
  {role}
  class={classNames('cinder-choice-grid', className)}
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledby}
  aria-disabled={disabled || undefined}
  data-cinder-multiple={multiple || undefined}
  data-cinder-disabled={disabled || undefined}
  style:--cinder-choice-grid-columns={gridTemplateColumns}
>
  {@render children()}
</div>
