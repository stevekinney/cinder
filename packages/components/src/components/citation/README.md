# Citation

<!-- generated:a11y-record:required -->

`Citation` pairs an inline source marker with a paginated Popover for interactive source details.

## Usage

```svelte
<script lang="ts">
  import Citation from '@lostgradient/cinder/citation';
</script>

<Citation sources={[{ label: 'Component metadata guide', url: '/docs/components' }]} />
```

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                |
| ---------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Custom class merged with `.cinder-citation`.                                                                               |
| `label`    | `string`   | no       | —       |                                                                                                                            |
| `children` | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `sources`  | `(opaque)` | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

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
