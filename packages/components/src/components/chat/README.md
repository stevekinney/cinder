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

| Prop                      | Type                           | Required | Default | Description                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allowAttachments`        | `boolean`                      | no       | —       | Whether file attachments are enabled in the composer. When `false`, the attachment button is hidden and drag-and-drop onto the chat surface is suppressed. Default `true`.                                                                                               |
| `allowCopy`               | `boolean`                      | no       | —       | Whether per-message copy buttons are shown in the message action bar. Default `true`.                                                                                                                                                                                    |
| `allowEditing`            | `boolean`                      | no       | —       | Whether user messages can be edited inline. Default `true`.                                                                                                                                                                                                              |
| `allowRetry`              | `boolean`                      | no       | —       | Whether failed assistant messages show a retry button. Default `true`.                                                                                                                                                                                                   |
| `allowSearch`             | `boolean`                      | no       | —       | Whether in-conversation search is enabled. When `true`, pressing Ctrl+F / Cmd+F opens a search bar that highlights matching messages. Default `true`.                                                                                                                    |
| `bottomThreshold`         | `number`                       | no       | —       | Distance in pixels from the bottom of the scroll viewport within which the chat is considered "at bottom" and will auto-scroll on new messages. Default `150`.                                                                                                           |
| `class`                   | `string`                       | no       | —       | Additional class name merged onto the `.chat-container` root element.                                                                                                                                                                                                    |
| `emptyPrompts`            | `string`[]                     | no       | —       | List of suggested starter prompt strings shown as clickable buttons in the default empty state. Clicking a prompt submits it immediately as a user message. Has no effect when a custom `empty` snippet is provided.                                                     |
| `hasNewMessageIndicator`  | `boolean`                      | no       | —       | Whether the "new messages" indicator is currently visible above the composer. Bindable; cleared automatically when the viewport reaches the bottom. Default `false`.                                                                                                     |
| `id`                      | `string`                       | yes      | —       | Unique identifier used to scope accessibility attributes across the chat surface.                                                                                                                                                                                        |
| `isAtBottom`              | `boolean`                      | no       | —       | Whether the message viewport is scrolled to the bottom. Bindable; updated automatically as the user scrolls. Default `true`.                                                                                                                                             |
| `isStreaming`             | `boolean`                      | no       | —       | Whether a streaming response is currently in progress. When `true`, the composer is disabled and a stop-generating button is shown. Default `false`.                                                                                                                     |
| `jumpThreshold`           | `number`                       | no       | —       | Distance in pixels scrolled up from the bottom required before the jump-to-latest button appears. Must be greater than `bottomThreshold` to prevent button flickering. Default `200`.                                                                                    |
| `streamingStatus`         | `string`                       | no       | —       | Optional status label displayed in the typing indicator while `isStreaming` is `true` and no streaming content has arrived yet (e.g. `"Thinking…"` or `"Analyzing file…"`). When omitted, three animated dots are shown.                                                 |
| `surfaceMode`             | `"default"` \| `"transparent"` | no       | —       | Controls the background of the chat surface. Use `'transparent'` to inherit the host element's background when embedding chat inside a card or panel. Default `'default'`.                                                                                               |
| `unreadCount`             | `number`                       | no       | —       | Number of messages received while the viewport was scrolled away from the bottom. Bindable; resets to `0` when the user scrolls to the bottom. Default `0`.                                                                                                              |
| `conversation`            | `(opaque)`                     | yes      | —       | The conversation transcript to render. Pass a {@link ConversationHistory} snapshot; consumers holding a stateful conversation object pass its current snapshot (e.g. `conversation.current`). Not expressible in JSON Schema; see the component types for the signature. |
| `empty`                   | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `header`                  | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `messageActions`          | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `messageStatus`           | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onattachmentadd`         | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onattachmentfailure`     | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onattachmentremove`      | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onedit`                  | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onexpandedchange`        | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onjumptolatest`          | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onretry`                 | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onscrollstatechange`     | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onstopgenerating`        | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onsubmit`                | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `onunreadindicatorchange` | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |
| `viewportAttachment`      | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
