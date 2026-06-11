# ToastRegion

ToastRegion provides live toast notifications and a `useToast()` controller for descendants.

## Usage

```svelte
<script lang="ts">
  import ToastRegion from '@lostgradient/cinder/toast-region';
</script>

<ToastRegion />
```

## Props

<!-- generated:props:start -->

| Prop              | Type                                                                                                        | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`                                                                                                    | no       | —       | Additional class names merged with `.cinder-toast-region`.                                                                                                                                                                                                                                                                                                                                               |
| `defaultDuration` | `number`                                                                                                    | no       | —       | Default auto-dismiss duration in ms. Default 5000. Set to 0 for sticky.                                                                                                                                                                                                                                                                                                                                  |
| `maxStack`        | `number`                                                                                                    | no       | —       | Maximum simultaneous toasts in each region. Default 5.                                                                                                                                                                                                                                                                                                                                                   |
| `position`        | `"top-left"` \| `"top-center"` \| `"top-right"` \| `"bottom-left"` \| `"bottom-center"` \| `"bottom-right"` | no       | —       | Viewport anchor for both live-region channels. Default `bottom-right`.                                                                                                                                                                                                                                                                                                                                   |
| `children`        | `(opaque)`                                                                                                  | no       | —       | Optional children. When provided, the region wraps them so descendants can call `useToast()` and read the region's context. Most apps mount `<ToastRegion>` as a self-closing tag at the root of their layout and leave this empty — but some patterns (modal-scoped regions, tests) benefit from explicit child composition. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
