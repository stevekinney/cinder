# JsonSchemaEditor

Multi-view editor for authoring JSON Schema documents with form, raw JSON, and diff modes plus undo history and validation.

## Usage

```svelte
<script lang="ts">
  import { JsonSchemaEditor } from '@lostgradient/cinder/json-schema-editor';
</script>
```

## Guidance

### Use When

- Letting users edit a JSON Schema with a guided form alongside the raw source.
- Reviewing schema changes against a baseline via the built-in diff view.

### Avoid When

- Editing arbitrary free-form JSON with no schema semantics — use a plain code editor instead.

## Props

<!-- generated:props:start -->

| Prop            | Type                                       | Required | Default | Description                                                                                                                                          |
| --------------- | ------------------------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`         | `string`                                   | no       | —       |                                                                                                                                                      |
| `draftOverride` | `"2020-12"` \| `"2019-09"` \| `"draft-07"` | no       | —       | Force a draft override regardless of $schema.                                                                                                        |
| `id`            | `string`                                   | yes      | —       | Required for ARIA wiring.                                                                                                                            |
| `maxHistory`    | `number`                                   | no       | —       | Maximum history entries (default 100).                                                                                                               |
| `readonly`      | `boolean`                                  | no       | —       | Read-only mode disables all mutations.                                                                                                               |
| `schemaKey`     | `string`                                   | no       | —       | Changing this triggers a full reset (history clears).                                                                                                |
| `view`          | `"form"` \| `"json"` \| `"diff"`           | no       | —       | Active view: form / json / diff. Bindable.                                                                                                           |
| `onchange`      | `(opaque)`                                 | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                           |
| `onrevert`      | `(opaque)`                                 | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                           |
| `onvalidate`    | `(opaque)`                                 | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                           |
| `original`      | `(opaque)`                                 | no       | —       | Optional explicit baseline; defaults to the initial `schema`. Not expressible in JSON Schema; see the component types for the signature.             |
| `schema`        | `(opaque)`                                 | yes      | —       | The schema being edited. May be a string (JSON text) or pre-parsed value. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
