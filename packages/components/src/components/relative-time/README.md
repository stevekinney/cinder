# RelativeTime

<!-- generated:a11y-record:required -->

`RelativeTime` renders a localized relative timestamp and can keep it current as time passes.

## Usage

```svelte
<script lang="ts">
  import RelativeTime from '@lostgradient/cinder/relative-time';
</script>

<RelativeTime>Content</RelativeTime>
```

## Props

<!-- generated:props:start -->

| Prop       | Type                   | Required | Default | Description                                                                                                                |
| ---------- | ---------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`               | no       | —       | Custom class merged with `.cinder-relative-time`.                                                                          |
| `locale`   | `string` \| `string`[] | no       | —       |                                                                                                                            |
| `tick`     | `boolean`              | no       | —       | Recalculate the label on an interval. Set false to disable ticking.                                                        |
| `children` | `(opaque)`             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `date`     | `(opaque)`             | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

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
