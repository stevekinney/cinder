import { createContext } from 'svelte';

import { optionalContext } from './optional-context.ts';

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

const [getFormFieldContextStrict, setFormFieldContextRaw] = createContext<FormFieldContext>();

export function setFormFieldContext(context: FormFieldContext): void {
  setFormFieldContextRaw(context);
}

/**
 * Read the nearest enclosing `<FormField>` context, or `undefined` when no
 * `<FormField>` ancestor exists. Controls rely on the `undefined` contract to
 * fall back to their standalone behavior.
 *
 * Svelte 5's `createContext` getter throws when no provider exists;
 * `optionalContext` converts that throw to `undefined` so the consumer
 * contract is preserved.
 */
export const getFormFieldContext: () => FormFieldContext | undefined =
  optionalContext(getFormFieldContextStrict);
