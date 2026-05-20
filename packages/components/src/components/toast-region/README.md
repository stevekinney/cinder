# ToastRegion

A ToastRegion component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import ToastRegion from 'cinder/toast-region';
</script>

<ToastRegion />
```

## Props

<!-- generated:props:start -->

| Prop              | Type       | Required | Default | Description                                                             |
| ----------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------- |
| `class`           | `string`   | no       | —       | Additional class names merged with `.cinder-toast-region`.              |
| `defaultDuration` | `number`   | no       | —       | Default auto-dismiss duration in ms. Default 5000. Set to 0 for sticky. |
| `maxStack`        | `number`   | no       | —       | Maximum simultaneous toasts in each region. Default 5.                  |
| `children`        | `(opaque)` | —        | —       | function-or-snippet                                                     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
