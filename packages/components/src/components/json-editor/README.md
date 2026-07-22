# JsonEditor

Controlled free-form JSON text editing with a native textarea, parse feedback, and accessible field wiring.

## Usage

```svelte
<script lang="ts">
  import JsonEditor from '@lostgradient/cinder/json-editor';

  let value = $state('{}');
</script>

<JsonEditor id="payload" label="Payload" {value} onValueChange={(next) => (value = next)} />
```

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                                           |
| ------------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`             | `string`   | no       | —       | Extra class names merged onto the field wrapper.                                                                                                      |
| `description`       | `string`   | no       | —       | Supporting text announced with the editor.                                                                                                            |
| `disabled`          | `boolean`  | no       | —       | Disables the editor. Passed through to the native textarea.                                                                                           |
| `error`             | `string`   | no       | —       | External validation error. Takes precedence over JSON parse feedback.                                                                                 |
| `id`                | `string`   | yes      | —       | Unique identifier used for the label and feedback relationships.                                                                                      |
| `label`             | `string`   | yes      | —       | Visible label associated with the native textarea.                                                                                                    |
| `required`          | `boolean`  | no       | —       | Marks the editor as required. Passed through to the native textarea.                                                                                  |
| `rows`              | `number`   | no       | —       | Number of visible text rows. Defaults to 8.                                                                                                           |
| `showValidFeedback` | `boolean`  | no       | —       | Whether valid JSON should render an announced success message. Defaults to true.                                                                      |
| `value`             | `string`   | yes      | —       | Controlled JSON source text.                                                                                                                          |
| `onValueChange`     | `(opaque)` | no       | —       | Called with the proposed JSON source whenever the user edits the textarea. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
