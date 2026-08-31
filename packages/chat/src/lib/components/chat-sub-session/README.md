# ChatSubSession

Render a reduced, bounded child-session transcript inline without adding another composer or full Chat layout.

## Usage

```svelte
<script lang="ts">
  import ChatSubSession from '@lostgradient/chat/sub-session';
</script>

<ChatSubSession conversation={childConversation} live={childSessionRunning} />
```

## Props

<!-- generated:props:start -->

| Prop           | Type       | Required | Default | Description                                                                                                                                |
| -------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `label`        | `string`   | no       | —       | Optional label for the nested transcript landmark.                                                                                         |
| `live`         | `boolean`  | no       | —       | Keeps the child transcript visually active while its owner is running.                                                                     |
| `conversation` | `(opaque)` | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                    |
| `row`          | `(opaque)` | no       | —       | Render a custom row while retaining the child transcript shell. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-chat-font-size`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
