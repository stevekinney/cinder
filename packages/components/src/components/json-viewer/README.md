# JsonViewer

Collapsible tree visualization of an arbitrary JSON value with hard depth and byte caps and a fallback for oversized payloads.

## Usage

```svelte
<script lang="ts">
  import JsonViewer from 'cinder/json-viewer';
</script>

<JsonViewer value={{ status: 'ok', items: [1, 2, 3] }} />
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
