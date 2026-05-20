# ConnectionIndicator

> **EXPERIMENTAL** — this component's API may change between minor versions until promoted to stable.

A ConnectionIndicator component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import ConnectionIndicator from 'cinder/experimental/connection-indicator';
</script>

<ConnectionIndicator />
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
