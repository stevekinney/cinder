# JsonViewer

> **EXPERIMENTAL** — this component's API may change between minor versions until promoted to stable.

A JsonViewer component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import JsonViewer from 'cinder/experimental/json-viewer';
</script>

<JsonViewer />
```

## Props

<!-- generated:props:start -->

| Prop           | Type       | Required | Default | Description                                                                     |
| -------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------- |
| `class`        | `string`   | no       | —       | Additional class names merged with `.cinder-json-viewer`.                       |
| `initialDepth` | `number`   | no       | —       | Initial collapse depth. Nodes deeper than this start collapsed. Default 1.      |
| `maxBytes`     | `number`   | no       | —       | Hard byte cap on the serialized payload. Default 1_048_576 (1 MB).              |
| `maxDepth`     | `number`   | no       | —       | Hard depth cap. Nodes deeper than this never render their children. Default 50. |
| `value`        | `(opaque)` | —        | —       | unknown-shape                                                                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
