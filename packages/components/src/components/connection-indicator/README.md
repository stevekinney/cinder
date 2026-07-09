# ConnectionIndicator

Small standalone status pill for a live connection. Renders one of six states — `connecting`, `live`, `reconnecting`, `polling`, `stale`, `closed` — as an icon plus a text label, so status is never conveyed by color alone.

`live` shows a small pulsing dot (a static dot under `prefers-reduced-motion: reduce`). `polling` is deliberately quieter than `live`: no motion, a lighter label weight, and its own icon, so it can't be mistaken for push. `reconnecting` accepts an optional `attempt` snippet for showing a retry count like "attempt 3 of 5".

Use `ConnectionIndicator` for a compact, self-contained pill that reports transport health. Use `StatusDot` for annotating a static entity's state (a row, a user, a deployment) instead of a live transport. Use `EventStreamViewer` for a full event log rather than a single status pill.

## Usage

```svelte
<script lang="ts">
  import { ConnectionIndicator } from '@lostgradient/cinder/connection-indicator';
</script>

<ConnectionIndicator status="live" />
<ConnectionIndicator status="polling" />
<ConnectionIndicator status="closed" />
```

### With an attempt count

```svelte
<script lang="ts">
  import { ConnectionIndicator } from '@lostgradient/cinder/connection-indicator';
</script>

<ConnectionIndicator status="reconnecting">
  {#snippet attempt()}
    attempt 3 of 5
  {/snippet}
</ConnectionIndicator>
```

### With a label override

```svelte
<ConnectionIndicator status="stale" label="Data may be out of date" />
```

## Props

<!-- generated:props:start -->

| Prop      | Type                                                                                     | Required | Default | Description                                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`   | `string`                                                                                 | no       | —       | Extra classes appended to the root element.                                                                                                                                                                     |
| `label`   | `string`                                                                                 | no       | —       | Optional human label override. Replaces the default text for `status` (and the "Connection: …" accessible name).                                                                                                |
| `status`  | `"connecting"` \| `"live"` \| `"reconnecting"` \| `"polling"` \| `"stale"` \| `"closed"` | yes      | —       | Current connection lifecycle state. Drives icon, text, and color via `data-cinder-status`.                                                                                                                      |
| `attempt` | `(opaque)`                                                                               | no       | —       | Attempt-count content rendered next to the label when `status` is `'reconnecting'`, e.g. "attempt 3 of 5". Ignored for other states. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
