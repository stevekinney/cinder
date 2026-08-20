# JsonSchemaEditor

Multi-view editor for authoring JSON Schema documents with form, raw JSON, and diff modes plus undo history and validation.

## Usage

```svelte
<script lang="ts">
  import JsonSchemaEditor from '@lostgradient/cinder/json-schema-editor';
  import type { JsonSchemaValue } from '@lostgradient/cinder/json-schema-editor';

  let schema = $state<JsonSchemaValue | string>({ type: 'string' });
</script>

<JsonSchemaEditor
  id="schema-editor"
  {schema}
  onValueChangeRequest={({ schema: nextSchema }) => (schema = nextSchema)}
/>
```

## State ownership

Pass `schema` with `onValueChangeRequest` when the parent owns the current schema. Every committed edit asks the parent to update its value, and a later `schema` value from the parent becomes authoritative. The handler may return the accepted or replacement schema, including through a promise, to settle a request without changing the prop—for example, when rejecting it with the same current schema. While a request is pending, a later commit is restored to the authoritative parent schema instead of creating a second request. Use the optional `onSchemaChange` callback to observe changes the parent accepts. Supplying `schema` without `onValueChangeRequest` preserves the previous locally managed behavior: it is an initial value, not a controlled contract.

```svelte
<JsonSchemaEditor
  id="controlled-schema-editor"
  {schema}
  onValueChangeRequest={({ schema: nextSchema }) => (schema = nextSchema)}
/>
```

Pass `defaultSchema` when the editor should own changes after initialization. Omitting both starts with an empty JSON Schema. Do not pass `schema` and `defaultSchema` together.

```svelte
<JsonSchemaEditor id="local-schema-editor" defaultSchema={{ type: 'object', properties: {} }} />
```

## Guidance

### Use When

- Letting users edit a JSON Schema with a guided form alongside the raw source.
- Reviewing schema changes against a baseline via the built-in diff view.

### Avoid When

- Editing arbitrary free-form JSON with no schema semantics — use a plain code editor instead.

## Props

<!-- generated:props:start -->

| Prop                   | Type                                       | Required | Default | Description                                                                                                                                                           |
| ---------------------- | ------------------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                | `string`                                   | no       | —       | Additional class merged onto the `.cinder-jse` root element.                                                                                                          |
| `draftOverride`        | `"2020-12"` \| `"2019-09"` \| `"draft-07"` | no       | —       | Force a draft override regardless of $schema.                                                                                                                         |
| `id`                   | `string`                                   | yes      | —       | Required for ARIA wiring.                                                                                                                                             |
| `maxHistory`           | `number`                                   | no       | —       | Maximum history entries (default 100).                                                                                                                                |
| `readonly`             | `boolean`                                  | no       | —       | Read-only mode disables all mutations.                                                                                                                                |
| `schemaKey`            | `string`                                   | no       | —       | Changing this triggers a full reset (history clears).                                                                                                                 |
| `view`                 | `"form"` \| `"json"` \| `"diff"`           | no       | —       | Active view: form / json / diff. Bindable.                                                                                                                            |
| `defaultSchema`        | `(opaque)`                                 | no       | —       | Omit `schema` to use this as the initial value of an uncontrolled editor. Not expressible in JSON Schema; see the component types for the signature.                  |
| `onRevert`             | `(opaque)`                                 | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                            |
| `onSchemaChange`       | `(opaque)`                                 | no       | —       | Observe a schema change after the parent accepts the request. Not expressible in JSON Schema; see the component types for the signature.                              |
| `onValidate`           | `(opaque)`                                 | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                            |
| `onValueChangeRequest` | `(opaque)`                                 | no       | —       | Request that the parent replace `schema` with a committed editor value. Not expressible in JSON Schema; see the component types for the signature.                    |
| `original`             | `(opaque)`                                 | no       | —       | Optional explicit baseline; defaults to the initial schema input. Not expressible in JSON Schema; see the component types for the signature.                          |
| `schema`               | `(opaque)`                                 | no       | —       | Parent-owned schema. Requires `onValueChangeRequest`; do not combine with `defaultSchema`. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
