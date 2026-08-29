# CodeLocation

<!-- generated:a11y-record:required -->

`CodeLocation` formats a file path and optional line and column as a compact source-location chip.

## Usage

```svelte
<script lang="ts">
  import CodeLocation from '@lostgradient/cinder/code-location';
</script>

<CodeLocation>Content</CodeLocation>
```

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                |
| ---------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Custom class merged with `.cinder-code-location`.                                                                          |
| `column`   | `number`   | no       | —       | Rendered only when `line` is also provided.                                                                                |
| `file`     | `string`   | yes      | —       |                                                                                                                            |
| `line`     | `number`   | no       | —       |                                                                                                                            |
| `children` | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## Authoring checklist

<!-- generated:authoring:start -->

Before publishing this component, complete the live
[component authoring pre-flight](../../../AGENTS.md#component-authoring-pre-flight).

<!-- generated:authoring:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
