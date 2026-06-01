/**
 * Internal field-control contract shared by form-control components.
 *
 * Components that wrap a native form element (`<input>`, `<select>`,
 * `<textarea>`, custom-roled buttons that participate in form submission) all
 * need the same wiring:
 *
 * - A stable `id` for label association
 * - Derived IDs for description and error elements
 * - A combined `aria-describedby` that lists both when present
 * - `aria-invalid` set when an error message is supplied
 *
 * This module centralizes that boilerplate so:
 *
 * - All field controls produce identical ARIA wiring (audited once, here, not
 *   per-component).
 * - Phase 1's Checkbox and Radio components reuse the same shape without
 *   reimplementing the description/error/`aria-describedby` triad.
 *
 * The helpers are pure functions that take string inputs and return strings
 * or undefined — they have no Svelte runtime dependency, so they remain
 * simple to test and to consume from any component shape (Shape A, B, or C
 * per the project conventions).
 */

/**
 * Build the description element's id for a given field id.
 * Returns `undefined` when there is no description, so it can be passed
 * directly to Svelte attribute bindings (which omit the attribute when undefined).
 */
export function describeId(fieldId: string, hasDescription: boolean): string | undefined {
  return hasDescription ? `${fieldId}-description` : undefined;
}

/**
 * Build the error element's id for a given field id.
 * Returns `undefined` when there is no error.
 */
export function errorId(fieldId: string, hasError: boolean): string | undefined {
  return hasError ? `${fieldId}-error` : undefined;
}

/**
 * Compose the `aria-describedby` value for a field. Filters out undefined ids,
 * joins the remainder with a single space, and returns `undefined` when no ids
 * are present so the attribute can be omitted entirely from the rendered element.
 *
 * Accepts arbitrary additional ids so consumers can layer in extra references
 * (e.g. a tooltip id, a counter id) without re-implementing the join logic.
 */
export function composeDescribedBy(...ids: Array<string | undefined | null>): string | undefined {
  const filtered = ids.flatMap((id) =>
    typeof id === 'string' ? id.trim().split(/\s+/).filter(Boolean) : [],
  );
  const unique = Array.from(new Set(filtered));
  return unique.length > 0 ? unique.join(' ') : undefined;
}

/**
 * Convert the truthiness of an error to the value `aria-invalid` expects.
 * Returns `'true'` when `hasError` is true, `undefined` otherwise (so the
 * attribute is omitted when there's no error).
 */
export function ariaInvalid(hasError: boolean): 'true' | undefined {
  return hasError ? 'true' : undefined;
}

export type FieldControlContextLike = {
  readonly controlId: string;
  readonly descriptionId: string | undefined;
  readonly errorId: string | undefined;
  readonly describedBy: string | undefined;
  readonly invalid: 'true' | undefined;
  readonly required: boolean;
  readonly disabled: boolean;
};

export type ResolveFieldControlInput = {
  id?: string;
  generatedId: string;
  context?: FieldControlContextLike | undefined;
  localIdNamespace?: string | undefined;
  hasDescription?: boolean;
  hasError?: boolean;
  consumerDescribedBy?: string | null | undefined;
  additionalDescribedBy?: Array<string | undefined | null> | undefined;
  consumerInvalid?: 'true' | 'false' | 'grammar' | 'spelling' | boolean | null | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
};

export type ResolvedFieldControl = {
  id: string;
  ownDescriptionId: string | undefined;
  ownErrorId: string | undefined;
  descriptionId: string | undefined;
  errorId: string | undefined;
  describedBy: string | undefined;
  ariaInvalid: 'true' | 'false' | 'grammar' | 'spelling' | undefined;
  required: boolean;
  disabled: boolean;
};

export function resolveFieldControl(input: ResolveFieldControlInput): ResolvedFieldControl {
  const resolvedId = input.id ?? input.context?.controlId ?? input.generatedId;
  const defaultDescriptionId = describeId(resolvedId, input.hasDescription ?? false);
  const defaultErrorId = errorId(resolvedId, input.hasError ?? false);
  const ownDescriptionId =
    defaultDescriptionId &&
    defaultDescriptionId === input.context?.descriptionId &&
    input.localIdNamespace
      ? `${resolvedId}-${input.localIdNamespace}-description`
      : defaultDescriptionId;
  const ownErrorId =
    defaultErrorId && defaultErrorId === input.context?.errorId && input.localIdNamespace
      ? `${resolvedId}-${input.localIdNamespace}-error`
      : defaultErrorId;
  const descriptionId = ownDescriptionId ?? input.context?.descriptionId;
  const resolvedErrorId = ownErrorId ?? input.context?.errorId;
  const explicitInvalid = ariaInvalid(input.hasError ?? false);
  const consumerInvalid =
    input.consumerInvalid === true
      ? 'true'
      : input.consumerInvalid === false
        ? undefined
        : (input.consumerInvalid ?? undefined);

  return {
    id: resolvedId,
    ownDescriptionId,
    ownErrorId,
    descriptionId,
    errorId: resolvedErrorId,
    describedBy: composeDescribedBy(
      descriptionId,
      ...(input.additionalDescribedBy ?? []),
      resolvedErrorId,
      input.context?.describedBy,
      input.consumerDescribedBy,
    ),
    ariaInvalid: explicitInvalid ?? input.context?.invalid ?? consumerInvalid,
    required: input.required ?? input.context?.required ?? false,
    disabled: input.disabled ?? input.context?.disabled ?? false,
  };
}
