# Chat

Opinionated conversation surface bundling message list, composer, attachments, and scroll affordances for AI or support transcripts.

## Usage

```svelte
<script lang="ts">
  import { Chat } from '@lostgradient/cinder/chat';
</script>
```

## Guidance

### Use When

- Shipping a full chat surface with composer, scroll-anchor, unread indicator, and attachments bundled as one heavyweight drop-in.
- Building an AI assistant or support thread where conversation state is modeled as a transcript of role-tagged messages.

### Avoid When

- Rendering a one-off message list — compose lighter primitives directly instead of pulling the full suite.
- The transcript is read-only and needs no composer — a simple list of message bubbles is a better fit.

## Props

<!-- generated:props:start -->

| Prop                      | Type                           | Required | Default | Description                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------ | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowAttachments`        | `boolean`                      | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `allowCopy`               | `boolean`                      | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `allowEditing`            | `boolean`                      | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `allowRetry`              | `boolean`                      | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `allowSearch`             | `boolean`                      | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `bottomThreshold`         | `number`                       | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `class`                   | `string`                       | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `emptyPrompts`            | `string`[]                     | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `hasNewMessageIndicator`  | `boolean`                      | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `id`                      | `string`                       | yes      | —       |                                                                                                                                                                                                                                                                                                       |
| `isAtBottom`              | `boolean`                      | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `isStreaming`             | `boolean`                      | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `jumpThreshold`           | `number`                       | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `streamingStatus`         | `string`                       | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `surfaceMode`             | `"default"` \| `"transparent"` | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `unreadCount`             | `number`                       | no       | —       |                                                                                                                                                                                                                                                                                                       |
| `conversation`            | `(opaque)`                     | yes      | —       | The conversation transcript to render. Pass a {@link ConversationHistory} snapshot; consumers holding a stateful conversation object pass its current snapshot (e.g. `conversation.current`). A prop whose shape is not captured by the JSON schema; see the component types for the exact signature. |
| `empty`                   | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `header`                  | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `messageActions`          | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `messageStatus`           | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onattachmentadd`         | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onattachmentfailure`     | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onattachmentremove`      | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onedit`                  | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onexpandedchange`        | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onjumptolatest`          | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onretry`                 | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onscrollstatechange`     | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onstopgenerating`        | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onsubmit`                | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `onunreadindicatorchange` | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |
| `viewportAttachment`      | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
