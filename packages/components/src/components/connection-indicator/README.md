# ConnectionIndicator

Live-status pill pairing a semantic dot with a label to communicate real-time WebSocket, SSE, or polling connection state.

## Usage

```svelte
<script lang="ts">
  import ConnectionIndicator from 'cinder/connection-indicator';
</script>

<ConnectionIndicator state="connected" />
```

## Props

<!-- generated:props:start -->

| Prop    | Type                                                             | Required | Default | Description                                                             |
| ------- | ---------------------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------- |
| `class` | `string`                                                         | no       | —       | Additional class names merged with `.cinder-connection-indicator`.      |
| `label` | `string`                                                         | no       | —       | Optional override for the visible label. Defaults derived from `state`. |
| `state` | `"connected"` \| `"connecting"` \| `"disconnected"` \| `"error"` | yes      | —       | Current connection state.                                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
