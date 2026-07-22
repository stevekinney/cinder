import type { HTMLFormAttributes } from 'svelte/elements';

import type { JsonSchemaObject } from './schema-form-model.ts';

export type SchemaFormSchema = JsonSchemaObject;

export type SchemaFormOutput = unknown;

export type SchemaFormDraftChangeHandler = (value: SchemaFormOutput) => void;

export type SchemaFormSubmitHandler = (
  value: SchemaFormOutput,
  event: SubmitEvent,
) => void | Promise<void>;

/** Props for the SchemaForm component. */
export type SchemaFormProps<Schema extends SchemaFormSchema = SchemaFormSchema> = Omit<
  HTMLFormAttributes,
  'class' | 'onsubmit'
> & {
  /** JSON Schema object used to render and validate the form. */
  schema: Schema;
  /**
   * Initial form value. Missing fields are seeded from the schema where possible.
   *
   * **Seed-only — value changes do not reset form state.** After mount the
   * consumer owns the form state. Changing `value` with the same `schema` does
   * NOT reset the form (formValue, errors, rawDrafts). Only changing `schema`
   * causes a remount and resets form state. This is intentional: the form is an
   * editing surface and resetting it on every external value change would
   * silently discard in-progress user edits.
   */
  value?: unknown;
  /** Name of the hidden serialized output field. Defaults to `value`. */
  name?: string;
  /** Label for the built-in submit button. Defaults to `Submit`. */
  submitLabel?: string;
  /** Custom class merged with `.cinder-schema-form`. */
  class?: string;
  /** Called after validation passes with the schema-conformant output value. */
  onsubmit?: SchemaFormSubmitHandler;
  /**
   * Called after each edit with the complete current draft, before schema validation.
   * The draft can be schema-invalid and does not change the seed-only `value` contract.
   */
  ondraftchange?: SchemaFormDraftChangeHandler;
};
