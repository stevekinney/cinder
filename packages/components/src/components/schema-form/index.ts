import './schema-form.css';

import SchemaForm from './schema-form.svelte';

export default SchemaForm;
export { readSchemaFormData } from './schema-form-validation.ts';
export type {
  SchemaFormOutput,
  SchemaFormProps,
  SchemaFormSchema,
  SchemaFormStandardSchema,
  SchemaFormSubmitHandler,
} from './schema-form.types.ts';
export { SchemaForm };
