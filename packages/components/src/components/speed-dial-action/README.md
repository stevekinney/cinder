# SpeedDialAction

SpeedDialAction is the `SpeedDial.Action` leaf. It must be rendered inside a
`SpeedDial` parent so it can participate in roving keyboard navigation and close
the owning dial after activation.

## Usage

```svelte
<script lang="ts">
  import { SpeedDial } from '@lostgradient/cinder/speed-dial';
</script>

<SpeedDial aria-label="Quick actions">
  {#snippet trigger()}+{/snippet}
  <SpeedDial.Action label="Create">
    {#snippet icon()}C{/snippet}
  </SpeedDial.Action>
</SpeedDial>
```

## Props

<!-- generated:props:start -->

| Prop             | Type                                         | Required | Default  | Description                                                                                                                                     |
| ---------------- | -------------------------------------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`          | `string`                                     | no       | —        | Custom class merged with `.cinder-speed-dial-action`.                                                                                           |
| `disabled`       | `boolean`                                    | no       | `false`  | Disables the action and removes it from roving keyboard navigation.                                                                             |
| `label`          | `string`                                     | yes      | —        | Visible and accessible label for the action.                                                                                                    |
| `labelPlacement` | `"auto"` \| `"start"` \| `"end"` \| `"none"` | no       | `"auto"` | Placement of the visible label relative to the action button.                                                                                   |
| `icon`           | `(opaque)`                                   | yes      | —        | Icon or compact content rendered inside the action button. Not expressible in JSON Schema; see the component types for the signature.           |
| `onclick`        | `(opaque)`                                   | no       | —        | Called when the action is activated. The SpeedDial closes afterward. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
