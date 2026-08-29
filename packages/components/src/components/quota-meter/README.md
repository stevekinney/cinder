# QuotaMeter

<!-- generated:a11y-record:required -->

`QuotaMeter` presents quota usage, limits, reset dates, and unlimited states through `Meter`.

## Usage

```svelte
<script lang="ts">
  import QuotaMeter from '@lostgradient/cinder/quota-meter';
</script>

<QuotaMeter>Content</QuotaMeter>
```

## Props

<!-- generated:props:start -->

| Prop        | Type       | Required | Default | Description                                                                                                                |
| ----------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`     | `string`   | no       | —       | Custom class merged with `.cinder-quota-meter`.                                                                            |
| `label`     | `string`   | no       | —       |                                                                                                                            |
| `limit`     | `number`   | no       | —       |                                                                                                                            |
| `unlimited` | `boolean`  | no       | —       |                                                                                                                            |
| `used`      | `number`   | yes      | —       |                                                                                                                            |
| `children`  | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `resetsAt`  | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

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
