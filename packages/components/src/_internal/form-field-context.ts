import { getContext, setContext } from 'svelte';

/** Symbol context key. Not exported from package root. */
const FORM_FIELD_CONTEXT_KEY = Symbol('cinder-form-field');

/**
 * Context published by `<FormField>` for descendant controls. Controls read this
 * to wire identity and ARIA. All members are getter properties on the object so
 * reads stay reactive — when a consumer reads `context.describedBy` inside a
 * `$derived`, the read flows through the getter, which returns a value recomputed
 * from FormField's `$derived` internals. Destructuring breaks reactivity; getter
 * reads preserve it.
 */
export type FormFieldContext = {
  /** Stable id for the underlying control element. Source of `<label for>`. */
  readonly controlId: string;
  /** Id of the `<label>` element. Used by `aria-labelledby` for grouped controls. */
  readonly labelId: string;
  /** Composed `aria-describedby` value (description + error), or undefined. */
  readonly describedBy: string | undefined;
  /** Id of the description `<p>`, or undefined. */
  readonly descriptionId: string | undefined;
  /** Id of the error `<p>`, or undefined. */
  readonly errorId: string | undefined;
  /** `'true'` when the field is in an error state, else undefined. */
  readonly invalid: 'true' | undefined;
  /** True when `required` prop is set on FormField. */
  readonly required: boolean;
  /** True when `disabled` prop is set on FormField. */
  readonly disabled: boolean;
};

export function setFormFieldContext(context: FormFieldContext): void {
  setContext(FORM_FIELD_CONTEXT_KEY, context);
}

export function getFormFieldContext(): FormFieldContext | undefined {
  try {
    // getContext returns undefined when called with a key that has no parent
    // setContext, so a missing FormField ancestor simply gives undefined.
    //
    // The try-catch handles a specific test environment constraint: the
    // SSR hydration test compiles input.svelte with generate:'server' but
    // resolves 'svelte' to the client build due to --conditions browser.
    // That combination causes the client getContext to throw
    // lifecycle_outside_component because component_context is null in the
    // server rendering path. In a normal browser or SSR-only environment
    // this code path is unreachable, so the catch is a no-op.
    return getContext<FormFieldContext | undefined>(FORM_FIELD_CONTEXT_KEY);
  } catch {
    return undefined;
  }
}
