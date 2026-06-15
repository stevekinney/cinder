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
| `class`        | `string`                                                                                                                                                                                   | no       | —       | Additional class names merged with the component's root class.                                                             |
| `closeDelay`   | `number`                                                                                                                                                                                   | no       | —       | Delay in milliseconds before the card closes after the pointer leaves and focus departs. Default `150`.                    |
| `description`  | `string`                                                                                                                                                                                   | no       | —       | Visually hidden text wired to the trigger via aria-describedby for assistive technology context.                           |
| `offset`       | `number`                                                                                                                                                                                   | no       | —       | Distance in pixels between the trigger and the card. Default `8`.                                                          |
| `open`         | `boolean`                                                                                                                                                                                  | no       | —       | Controls the open state of the card; bindable for controlled usage.                                                        |
| `openDelay`    | `number`                                                                                                                                                                                   | no       | —       | Delay in milliseconds before the card opens after the pointer enters or focus lands on the trigger. Default `300`.         |
| `placement`    | `"top"` \| `"top-start"` \| `"top-end"` \| `"right"` \| `"right-start"` \| `"right-end"` \| `"bottom"` \| `"bottom-start"` \| `"bottom-end"` \| `"left"` \| `"left-start"` \| `"left-end"` | no       | —       | Preferred placement of the card relative to the trigger. Default `bottom-start`.                                           |
| `showArrow`    | `boolean`                                                                                                                                                                                  | no       | —       | When true, renders a directional arrow pointing from the card toward the trigger. Default `false`.                         |
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
