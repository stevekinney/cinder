# ChatNavigationRail

Navigate directly between user-authored turns in a long Chat transcript with keyboard controls or continuous pointer scrubbing.

## Usage

```svelte
<script lang="ts">
  import ChatNavigationRail from '@lostgradient/chat/navigation-rail';
</script>

<ChatNavigationRail {messages} {viewport} scrollToMessage={chat.scrollToMessage} />
```

## Props

<!-- generated:props:start -->

| Prop              | Type       | Required | Default | Description                                                                                                                                                   |
| ----------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`           | `string`   | no       | —       |                                                                                                                                                               |
| `messages`        | `(opaque)` | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                       |
| `onNavigate`      | `(opaque)` | no       | —       | Scroll a message index; callers should delegate to ChatVirtualizer when present. Not expressible in JSON Schema; see the component types for the signature.   |
| `preview`         | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                    |
| `scrollToIndex`   | `(opaque)` | no       | —       | Optional virtualizer bridge; implementations should use center alignment. Not expressible in JSON Schema; see the component types for the signature.          |
| `scrollToMessage` | `(opaque)` | no       | —       | Message-aware Chat bridge; resolves virtualized and grouped rows before centering. Not expressible in JSON Schema; see the component types for the signature. |
| `viewport`        | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
