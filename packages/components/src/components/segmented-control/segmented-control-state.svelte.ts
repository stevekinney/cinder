import type { SvelteSet } from 'svelte/reactivity';

import { strictStableContext } from '../../_internal/strict-stable-context.ts';
import { inDocumentOrder } from '../../utilities/document-order.ts';
import { getFocusableIndex, handleRovingKeydown } from '../../utilities/roving-tabindex.ts';

// Re-export for backward compatibility with anything that imported the helper
// from this module before the utility was promoted to its own file.
export { inDocumentOrder };

/**
 * A registered child segment, as seen by the parent control.
 *
 * Fields are read live via getters so reactive prop changes flow through
 * without re-registering. The controller never mutates a registration — it
 * only stores the live view that the child segment passes in.
 */
export type SegmentRegistration = {
  /** The button DOM node — used for DOM-order sorting and focus(). */
  readonly node: HTMLButtonElement;
  /** The value this segment represents (read live). */
  readonly value: string;
  /** Per-segment effective disabled flag (read live, includes control-level disabled). */
  readonly disabled: boolean;
  /** ID of the panel a tab segment controls (read live; tablist variant). */
  readonly controls?: string | undefined;
};

/** Options the parent passes down to inform segment rendering. */
export type SegmentedControlContextValue = {
  /** True when the control is in single-selection mode. */
  readonly selectionMode: 'single' | 'multiple';
  /** 'radiogroup' or 'tablist' — single mode only. */
  readonly variant: 'radiogroup' | 'tablist';
  /** True when the whole control is disabled. */
  readonly controlDisabled: boolean;
  /** Register a segment when its DOM node mounts. Returns an unregister fn. */
  register(registration: SegmentRegistration): () => void;
  /** True when a given value is currently selected. */
  isSelected(value: string): boolean;
  /** True when the segment with this value should receive `tabindex="0"`. */
  isFocusable(value: string): boolean;
  /** Toggle a value (called by Segment on click). */
  toggle(value: string): void;
};

const [getSegmentedControlContext, setSegmentedControlContext] =
  strictStableContext<SegmentedControlContextValue>(
    '@lostgradient/cinder/segmented-control/context',
    'Segment must be rendered inside a SegmentedControl',
  );

export { getSegmentedControlContext, setSegmentedControlContext };

/**
 * Options for building a SegmentedControlController.
 *
 * Getters are used so the controller can read live prop values without
 * destructuring the reactive proxy at construction time.
 */
export type SegmentedControlControllerOptions = {
  selectionMode: () => 'single' | 'multiple';
  variant: () => 'radiogroup' | 'tablist';
  orientation: () => 'horizontal' | 'vertical';
  controlDisabled: () => boolean;
  disallowEmptySelection: () => boolean;
  getValue: () => string | SvelteSet<string> | undefined;
  setValue: (next: string | SvelteSet<string> | undefined) => void;
  onChange?: (value: string) => void;
};

/**
 * Encapsulates state and keyboard logic for SegmentedControl.
 *
 * Lives in a `.svelte.ts` module so the parent component can hold a single
 * controller instance and pass it via context to all child Segments.
 */
export class SegmentedControlController {
  // Non-reactive store for raw segment registrations. Mutations are signalled
  // explicitly via #version so we avoid Svelte's deep proxying — that proxy
  // wraps stored objects, and the wrapped views can be undefined briefly
  // during effect teardown, which crashes `compareDocumentPosition`.
  #registrations: SegmentRegistration[] = [];
  #version = $state(0);
  #options: SegmentedControlControllerOptions;

  constructor(options: SegmentedControlControllerOptions) {
    this.#options = options;
  }

  /** DOM-ordered view of registered segments. Re-sorts on every read. */
  get segments(): SegmentRegistration[] {
    // Read #version so consumers re-run when the registration list changes.
    void this.#version;
    return inDocumentOrder(this.#registrations);
  }

  get selectionMode(): 'single' | 'multiple' {
    return this.#options.selectionMode();
  }

  get variant(): 'radiogroup' | 'tablist' {
    return this.#options.variant();
  }

  get controlDisabled(): boolean {
    return this.#options.controlDisabled();
  }

  register(registration: SegmentRegistration): () => void {
    this.#registrations.push(registration);
    this.#version += 1;
    return () => {
      const index = this.#registrations.indexOf(registration);
      if (index >= 0) this.#registrations.splice(index, 1);
      this.#version += 1;
    };
  }

  isSelected(value: string): boolean {
    const current = this.#options.getValue();
    if (this.#options.selectionMode() === 'multiple') {
      if (!current || typeof current === 'string') return false;
      return current.has(value);
    }
    return current === value;
  }

  isFocusable(value: string): boolean {
    if (this.#options.selectionMode() !== 'single') {
      // In multi-select, every enabled segment is independently tabbable.
      const segment = this.segments.find((entry) => entry.value === value);
      if (!segment) return false;
      return !segment.disabled && !this.#options.controlDisabled();
    }

    const focusableValue = this.#computeFocusableValue();
    return focusableValue === value;
  }

  /**
   * Determine which segment should currently carry `tabindex="0"`.
   *
   * Priority:
   * 1. Selected segment (if enabled).
   * 2. First enabled segment in DOM order — used when value is unset OR
   *    when value points to a disabled segment (per the plan's
   *    "selected-but-disabled" contract).
   */
  #computeFocusableValue(): string | null {
    const segments = this.segments;
    if (segments.length === 0) return null;

    const current = this.#options.getValue();
    const isMultiple = this.#options.selectionMode() === 'multiple';

    if (!isMultiple && typeof current === 'string') {
      const selectedSegment = segments.find((segment) => segment.value === current);
      if (selectedSegment && !selectedSegment.disabled && !this.#options.controlDisabled()) {
        return selectedSegment.value;
      }
    }

    if (this.#options.controlDisabled()) return null;
    const firstEnabled = segments.find((segment) => !segment.disabled);
    return firstEnabled?.value ?? null;
  }

  toggle(value: string): void {
    if (this.#options.controlDisabled()) return;
    const segment = this.segments.find((entry) => entry.value === value);
    if (!segment || segment.disabled) return;

    if (this.#options.selectionMode() === 'multiple') {
      const set = this.#options.getValue();
      if (!set || typeof set === 'string') return;
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return;
    }

    const current = this.#options.getValue();
    if (current === value) {
      if (!this.#options.disallowEmptySelection()) {
        this.#options.setValue(undefined);
      }
      return;
    }
    this.#options.setValue(value);
    this.#options.onChange?.(value);
  }

  /**
   * Handle a keydown event on the strip. Implements roving tabindex with
   * immediate selection per C6 of the plan: arrow keys move focus AND
   * update value simultaneously in single mode.
   *
   * Reads focus directly from `document.activeElement` rather than mirroring
   * it in state — the DOM is the source of truth, and a separate `#focusedValue`
   * field could drift if focus moved programmatically outside the control.
   */
  handleKeydown(event: KeyboardEvent): void {
    if (this.#options.controlDisabled()) return;
    if (this.#options.selectionMode() !== 'single') return;

    const segments = this.segments;
    if (segments.length === 0) return;

    const focusedSegment =
      typeof document === 'undefined'
        ? null
        : (segments.find((segment) => segment.node === document.activeElement) ?? null);
    const value = this.#options.getValue();
    const currentValue = focusedSegment?.value ?? (typeof value === 'string' ? value : null);

    const currentIndex =
      currentValue === null
        ? segments.findIndex((segment) => !segment.disabled)
        : segments.findIndex((segment) => segment.value === currentValue);

    const safeCurrentIndex =
      currentIndex >= 0
        ? currentIndex
        : getFocusableIndex(-1, segments.length, (index) => segments[index]?.disabled ?? false);

    if (safeCurrentIndex < 0) return;

    const orientation = this.#options.orientation();
    const nextIndex = handleRovingKeydown(event, safeCurrentIndex, segments.length, {
      isDisabled: (index) => segments[index]?.disabled ?? false,
      vertical: true,
      horizontal: orientation !== 'vertical',
    });

    if (nextIndex === null) return;
    event.preventDefault();
    if (nextIndex === safeCurrentIndex) return;

    const nextSegment = segments[nextIndex];
    if (!nextSegment) return;

    this.toggle(nextSegment.value);
    nextSegment.node.focus();
  }
}
