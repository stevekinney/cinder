# HoverCard

Hover-and-focus triggered rich preview card for non-interactive contextual content.

## Usage

```svelte
<script lang="ts">
  import { HoverCard } from '@lostgradient/cinder/hover-card';
</script>
```

## Guidance

### Use When

- Showing a profile, issue, or metadata preview that is richer than a tooltip but still read-only.
- Revealing supplementary preview content on pointer hover or keyboard focus without moving focus.

### Avoid When

- The floating content contains focusable controls — use popover.
- The trigger needs a short accessible description — use tooltip.

## Props

<!-- generated:props:start -->

| Prop           | Type                                                                                                                                                                                       | Required | Default | Description                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`                                                                                                                                                                                   | no       | —       |                                                                                                                            |
| `closeDelay`   | `number`                                                                                                                                                                                   | no       | —       |                                                                                                                            |
| `description`  | `string`                                                                                                                                                                                   | no       | —       |                                                                                                                            |
| `offset`       | `number`                                                                                                                                                                                   | no       | —       |                                                                                                                            |
| `open`         | `boolean`                                                                                                                                                                                  | no       | —       |                                                                                                                            |
| `openDelay`    | `number`                                                                                                                                                                                   | no       | —       |                                                                                                                            |
| `placement`    | `"top"` \| `"top-start"` \| `"top-end"` \| `"right"` \| `"right-start"` \| `"right-end"` \| `"bottom"` \| `"bottom-start"` \| `"bottom-end"` \| `"left"` \| `"left-start"` \| `"left-end"` | no       | —       |                                                                                                                            |
| `showArrow`    | `boolean`                                                                                                                                                                                  | no       | —       |                                                                                                                            |
| `children`     | `(opaque)`                                                                                                                                                                                 | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onopenchange` | `(opaque)`                                                                                                                                                                                 | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `trigger`      | `(opaque)`                                                                                                                                                                                 | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `triggerRef`   | `(opaque)`                                                                                                                                                                                 | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
