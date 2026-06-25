<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Schema-driven form that renders accessible controls from JSON Schema and submits one validated value object.
   * @tag form
   * @tag schema
   * @tag validation
   * @useWhen Capturing a payload whose shape is already described by a workflow, API, or JSON Schema document.
   * @useWhen You need callback submission and native FormData submission to expose the same validated object.
   * @avoidWhen Authoring or editing a JSON Schema document — use json-schema-editor instead.
   * @avoidWhen You need bespoke multi-step flows or custom cross-field user interface beyond schema validation.
   * @related json-schema-editor, form-field, input, select, toggle
   * @a11yPattern Native HTML form with labelled controls
   * @keyboardShortcut Enter | Submits the form from text-like controls.
   * @a11yNote Invalid submission moves focus to the first invalid field and associates each field error through aria-describedby.
   */
  export type {
    SchemaFormOutput,
    SchemaFormProps,
    SchemaFormSchema,
    SchemaFormSubmitHandler,
  } from './schema-form.types.ts';
</script>

<script lang="ts" generics="Schema extends SchemaFormSchema = SchemaFormSchema">
  import type { SchemaFormProps, SchemaFormSchema } from './schema-form.types.ts';
  import SchemaFormBody from './schema-form-body.svelte';

  /**
   * Schema-driven form that renders accessible controls from JSON Schema or
   * JSON Schema and submits one validated value object.
   *
   * **Schema changes reset form state.** When the `schema` prop changes, the
   * internal form body is remounted and all mutable state (formValue, errors,
   * rawDrafts, arrayKeys) is reset to values seeded from the new schema and the
   * current `value` prop.
   *
   * **`value` is a seed, not a live binding.** The consumer owns the form state
   * after mount. Changing `value` with the same schema does NOT reset formValue —
   * only a schema change triggers a remount and state reset. This is intentional:
   * the form is an editing surface, and resetting it on every external value change
   * would discard in-progress user edits.
   */
  let { schema, ...rest }: SchemaFormProps<Schema> = $props();
</script>

<!--
  {#key schema} destroys and recreates SchemaFormBody whenever schema changes.
  Because all mutable form state ($state variables) lives inside SchemaFormBody's
  script, the key-block remount causes genuine $state recreation — not just DOM
  reconciliation. This is the idiomatic Svelte 5 fix for "reset component state
  on prop change" without a write-back $effect.
-->
{#key schema}
  <SchemaFormBody {schema} {...rest} />
{/key}
