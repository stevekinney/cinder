import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { HTMLFormAttributes } from 'svelte/elements';

import type { JsonSchemaObject } from './schema-form-model.ts';

export type SchemaFormStandardSchema<Output = unknown> = StandardSchemaV1<unknown, Output>;

export type SchemaFormSchema = JsonSchemaObject | SchemaFormStandardSchema;

export type SchemaFormOutput<Schema extends SchemaFormSchema> = Schema extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<Schema>
  : unknown;

export type SchemaFormSubmitHandler<Schema extends SchemaFormSchema> = (
  value: SchemaFormOutput<Schema>,
  event: SubmitEvent,
) => void | Promise<void>;

/** Props for the SchemaForm component. */
export type SchemaFormProps<Schema extends SchemaFormSchema = SchemaFormSchema> = Omit<
  HTMLFormAttributes,
  'class' | 'onsubmit'
> & {
  /** JSON Schema object or Standard Schema object used to render and validate the form. */
  schema: Schema;
  /** Initial form value. Missing fields are seeded from the schema where possible. */
  value?: unknown;
  /** Name of the hidden serialized output field. Defaults to `value`. */
  name?: string;
  /** Label for the built-in submit button. Defaults to `Submit`. */
  submitLabel?: string;
  /** Custom class merged with `.cinder-schema-form`. */
  class?: string;
  /** Called after validation passes with the schema-conformant output value. */
  onsubmit?: SchemaFormSubmitHandler<Schema>;
};
