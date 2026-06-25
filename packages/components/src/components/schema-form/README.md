# SchemaForm

Render an accessible form from a JSON Schema object and submit one validated value.

## Usage

```svelte
<script lang="ts">
  import SchemaForm, { readSchemaFormData } from '@lostgradient/cinder/schema-form';

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      count: { type: 'integer', minimum: 1 },
    },
    required: ['name', 'count'],
  };

  function save(value: unknown) {
    // Called only after validation passes.
  }
</script>

<SchemaForm {schema} name="payload" onsubmit={save} />
```

`SchemaForm` always renders a real `<form>` and a hidden serialized output field. After valid submission, `readSchemaFormData(new FormData(form), 'payload')` returns the same object delivered to `onsubmit`.

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`   | no       | —       | Custom class merged with `.cinder-schema-form`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `name`        | `string`   | no       | —       | Name of the hidden serialized output field. Defaults to `value`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `submitLabel` | `string`   | no       | —       | Label for the built-in submit button. Defaults to `Submit`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `onsubmit`    | `(opaque)` | no       | —       | Called after validation passes with the schema-conformant output value. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `schema`      | `(opaque)` | yes      | —       | JSON Schema object used to render and validate the form. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `value`       | `(opaque)` | no       | —       | Initial form value. Missing fields are seeded from the schema where possible. **Seed-only — value changes do not reset form state.** After mount the consumer owns the form state. Changing `value` with the same `schema` does NOT reset the form (formValue, errors, rawDrafts). Only changing `schema` causes a remount and resets form state. This is intentional: the form is an editing surface and resetting it on every external value change would silently discard in-progress user edits. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
