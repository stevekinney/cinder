# SpeedDial

SpeedDial composes a `FloatingActionButton` trigger with a directional cluster of
quick actions. Use it when one primary floating action needs a small set of
related secondary actions.

## Usage

```svelte
<script lang="ts">
  import { SpeedDial } from '@lostgradient/cinder/speed-dial';
</script>

<SpeedDial aria-label="Quick actions">
  {#snippet trigger()}+{/snippet}

  <SpeedDial.Action label="Create" onclick={() => create()}>
    {#snippet icon()}C{/snippet}
  </SpeedDial.Action>
</SpeedDial>
```

## Props

<!-- generated:props:start -->

| Prop         | Type                                        | Required | Default | Description                                                                                                                                  |
| ------------ | ------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `aria-label` | `string`                                    | no       | —       | Accessible label for the root group and trigger button.                                                                                      |
| `class`      | `string`                                    | no       | —       | Custom class merged with `.cinder-speed-dial`.                                                                                               |
| `direction`  | `"up"` \| `"down"` \| `"left"` \| `"right"` | no       | `"up"`  | Direction the actions fan out.                                                                                                               |
| `hidden`     | `boolean`                                   | no       | `false` | Applies the native hidden attribute and makes the whole control inert.                                                                       |
| `open`       | `boolean`                                   | no       | `false` | Bindable open state. Trigger, Escape, outside click, and action activation update it.                                                        |
| `children`   | `(opaque)`                                  | yes      | —       | `SpeedDial.Action` children. Not expressible in JSON Schema; see the component types for the signature.                                      |
| `trigger`    | `(opaque)`                                  | yes      | —       | Trigger icon or content rendered inside the FloatingActionButton. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `SpeedDial.Action` - a quick-action button with a visible label; see
  [`speed-dial-action`](../speed-dial-action/README.md).

<!-- generated:subcomponents:end -->
