# Chat

Opinionated conversation surface bundling message list, composer, attachments, and scroll affordances for AI or support transcripts.

## Usage

```svelte
<script lang="ts">
  import {
    Chat,
    appendAssistantMessage,
    appendUserMessage,
    createConversation,
  } from '@lostgradient/cinder/chat';

  const conversation = appendAssistantMessage(
    appendUserMessage(createConversation({ id: 'demo' }), 'Can you summarize this plan?'),
    'The plan is ready to implement.',
  );
</script>

<!-- Chat fills its parent; give the ancestor a definite height. -->
<div style="height: 34rem;">
  <Chat id="demo-chat" {conversation} />
</div>
```

> [!IMPORTANT] Chat needs a definite-height ancestor
> Chat's root element fills its parent (`height: 100%`). Place it inside an
> ancestor with a resolved height—a fixed height, a flex or grid cell, or
> `height: 100dvh`—or the message viewport collapses and Chat renders as a
> small card instead of filling its space. See [Layout and sizing](#layout-and-sizing).

## Layout and sizing

Chat's root (`.chat-container`) is `height: 100%`. When no ancestor on the
chain resolves to a definite height, that `100%` resolves against `auto` and
Chat collapses to the intrinsic height of its empty state plus composer. There
is no browser error: it just silently shrinks to a small card. Give Chat a
sized ancestor with one of the three patterns below.

**Fixed-height container.** The simplest option—wrap Chat in an element with
an explicit height. This is what every example in this component uses.

```svelte
<div style="height: 34rem;">
  <Chat id="support-chat" {conversation} />
</div>
```

**Full-viewport flex column.** For an app shell where Chat should fill the
remaining space, give the column a definite height and let the Chat cell
`flex: 1` with `min-height: 0` (so it can shrink below its content and scroll
internally rather than overflowing the page).

```svelte
<div class="chat-page">
  <header>…</header>
  <Chat id="app-chat" class="chat-page-surface" {conversation} />
</div>

<style>
  .chat-page {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }

  /* `:global` because the class lands on Chat's own root element. */
  .chat-page :global(.chat-page-surface) {
    flex: 1;
    min-height: 0;
  }
</style>
```

**Grid cell.** The same shape works in a grid: give the container a resolved
track (`grid-template-rows: auto 1fr`), place Chat in the `1fr` row, and keep
`min-height: 0` on the Chat cell so it can shrink and scroll internally instead
of overflowing the page.

```svelte
<div class="chat-grid">
  <header>…</header>
  <Chat id="grid-chat" class="chat-grid-surface" {conversation} />
</div>

<style>
  .chat-grid {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100dvh;
  }

  .chat-grid :global(.chat-grid-surface) {
    min-height: 0;
  }
</style>
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

| Prop                               | Type                           | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowAttachments`                 | `boolean`                      | no       | —       | Whether file attachments are enabled in the composer. When `false`, the attachment button is hidden and drag-and-drop onto the chat surface is suppressed. Default `true`.                                                                                                                                                                                                                                 |
| `allowCopy`                        | `boolean`                      | no       | —       | Whether per-message copy buttons are shown in the message action bar. Default `true`.                                                                                                                                                                                                                                                                                                                      |
| `allowEditing`                     | `boolean`                      | no       | —       | Whether user messages can be edited inline. Default `true`.                                                                                                                                                                                                                                                                                                                                                |
| `allowRetry`                       | `boolean`                      | no       | —       | Whether failed assistant messages show a retry button. Default `true`.                                                                                                                                                                                                                                                                                                                                     |
| `allowSearch`                      | `boolean`                      | no       | —       | Whether in-conversation search is enabled. When `true`, pressing Ctrl+F / Cmd+F opens a search bar that highlights matching messages. Default `true`.                                                                                                                                                                                                                                                      |
| `bottomThreshold`                  | `number`                       | no       | —       | Distance in pixels from the bottom of the scroll viewport within which the chat is considered "at bottom" and will auto-scroll on new messages. Default `150`.                                                                                                                                                                                                                                             |
| `class`                            | `string`                       | no       | —       | Additional class name merged onto the `.chat-container` root element.                                                                                                                                                                                                                                                                                                                                      |
| `emptyPrompts`                     | `string`[]                     | no       | —       | List of suggested starter prompt strings shown as clickable buttons in the default empty state. Clicking a prompt submits it immediately as a user message. Has no effect when a custom `empty` snippet is provided.                                                                                                                                                                                       |
| `hasMoreHistory`                   | `boolean`                      | no       | —       | Whether the explicit "Load earlier messages" trigger is shown when a load handler exists. Default `true`.                                                                                                                                                                                                                                                                                                  |
| `hasNewMessageIndicator`           | `boolean`                      | no       | —       | Whether the "new messages" indicator is currently visible above the composer. Bindable; cleared automatically when the viewport reaches the bottom. Default `false`.                                                                                                                                                                                                                                       |
| `id`                               | `string`                       | yes      | —       | Unique identifier used to scope accessibility attributes across the chat surface.                                                                                                                                                                                                                                                                                                                          |
| `isAtBottom`                       | `boolean`                      | no       | —       | Whether the message viewport is scrolled to the bottom. Bindable; updated automatically as the user scrolls. Default `true`.                                                                                                                                                                                                                                                                               |
| `isStreaming`                      | `boolean`                      | no       | —       | Whether a streaming response is currently in progress. When `true`, the composer is disabled and a stop-generating button is shown. Default `false`.                                                                                                                                                                                                                                                       |
| `jumpThreshold`                    | `number`                       | no       | —       | Distance in pixels scrolled up from the bottom required before the jump-to-latest button appears. Must be greater than `bottomThreshold` to prevent button flickering. Default `200`.                                                                                                                                                                                                                      |
| `loadEarlierLabel`                 | `string`                       | no       | —       | Label for the history pagination trigger. Default `"Load earlier messages"`.                                                                                                                                                                                                                                                                                                                               |
| `loadingEarlierLabel`              | `string`                       | no       | —       | Status text while older messages are loading. Default `"Loading earlier messages"`.                                                                                                                                                                                                                                                                                                                        |
| `streamingStatus`                  | `string`                       | no       | —       | Optional status label displayed in the typing indicator while `isStreaming` is `true` and no streaming content has arrived yet (e.g. `"Thinking…"` or `"Analyzing file…"`). When omitted, three animated dots are shown.                                                                                                                                                                                   |
| `surfaceMode`                      | `"default"` \| `"transparent"` | no       | —       | Controls the background of the chat surface. Use `'transparent'` to inherit the host element's background when embedding chat inside a card or panel. Default `'default'`.                                                                                                                                                                                                                                 |
| `unreadCount`                      | `number`                       | no       | —       | Number of messages received while the viewport was scrolled away from the bottom. Bindable; resets to `0` when the user scrolls to the bottom. Default `0`.                                                                                                                                                                                                                                                |
| `virtualizationEstimatedRowHeight` | `number`                       | no       | —       | Estimated row height in pixels for virtualized message rows. Default `88`.                                                                                                                                                                                                                                                                                                                                 |
| `virtualizationInitialHeight`      | `number`                       | no       | —       | Initial virtualized viewport height used before measurement. Default `640`.                                                                                                                                                                                                                                                                                                                                |
| `virtualizationOverscan`           | `number`                       | no       | —       | Number of extra virtual rows rendered before and after the viewport. Default `3`.                                                                                                                                                                                                                                                                                                                          |
| `virtualized`                      | `boolean`                      | no       | —       | Use the virtualized message render path for long transcripts. The complete `ConversationHistory` remains unchanged; only the DOM window is reduced. Default `false`.                                                                                                                                                                                                                                       |
| `adapter`                          | `(opaque)`                     | no       | —       | Optional command/transport boundary around `conversation`. Its methods take precedence over the matching callback props (e.g. `sendMessage` over `onsubmit`); omit it and Chat behaves exactly as with plain callbacks. Not expressible in JSON Schema; see the component types for the signature.                                                                                                         |
| `conversation`                     | `(opaque)`                     | yes      | —       | The conversation transcript to render. Pass a {@link ConversationHistory} snapshot; consumers holding a stateful conversation object pass its current snapshot (e.g. `conversation.current`). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                   |
| `empty`                            | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `header`                           | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `messageActions`                   | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `messagePart`                      | `(opaque)`                     | no       | —       | Per-message-part override. Replaces the rendering of an individual body part (markdown, tool call, tool result) while delegating the rest to the built-ins via the `renderDefault` snippet it receives. Image parts are excluded — they render through the grouped attachment grid, not this override. Not expressible in JSON Schema; see the component types for the signature.                          |
| `messageReasoning`                 | `(opaque)`                     | no       | —       | Override or supplement the reasoning text for a message. Called per-message; return a non-empty string to show a reasoning block, `undefined` to fall back to `message.metadata['cinder:reasoning']`, empty string to suppress reasoning. Not expressible in JSON Schema; see the component types for the signature.                                                                                       |
| `messageStatus`                    | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `messageSteps`                     | `(opaque)`                     | no       | —       | Override or supplement the step list for a message. Called per-message; return an array to show step indicators, `undefined` to fall back to `message.metadata['cinder:steps']`. An empty array suppresses steps. Not expressible in JSON Schema; see the component types for the signature.                                                                                                               |
| `messageSuggestions`               | `(opaque)`                     | no       | —       | Override or supplement the suggestion list for a message. Called per-message; return an array of label strings to show suggestion chips, `undefined` to fall back to `message.metadata['cinder:suggestions']`. An empty array suppresses suggestions. Not expressible in JSON Schema; see the component types for the signature.                                                                           |
| `onadaptererror`                   | `(opaque)`                     | no       | —       | Called when an adapter command fails — either a rejected promise or a synchronous throw from the method. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                        |
| `onapprove`                        | `(opaque)`                     | no       | —       | Called when the user approves an action-required tool call. The consumer is responsible for updating its transcript (e.g. calling conversationalist to unblock the pending tool) and triggering a new generation. When an adapter is also wired, Chat calls `adapter.approveToolCall(toolCallId)` first and then this callback. Not expressible in JSON Schema; see the component types for the signature. |
| `onattachmentadd`                  | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `onattachmentfailure`              | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `onattachmentremove`               | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `ondeny`                           | `(opaque)`                     | no       | —       | Called when the user denies an action-required tool call. When an adapter is also wired, Chat calls `adapter.denyToolCall(toolCallId)` first and then this callback. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                            |
| `onedit`                           | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `onexpandedchange`                 | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `onjumptolatest`                   | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `onloadhistory`                    | `(opaque)`                     | no       | —       | Called when the explicit history trigger is activated. The consumer prepends compatible messages into `conversation`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                           |
| `onpushmessage`                    | `(opaque)`                     | no       | —       | Forwarded from the adapter's real-time `onMessage` push (consumer owns the transcript). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                         |
| `onreadreceipt`                    | `(opaque)`                     | no       | —       | Forwarded from the adapter's real-time `onReadReceipt` push. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                    |
| `onretry`                          | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `onscrollstatechange`              | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `onstopgenerating`                 | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `onsubmit`                         | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `onsuggestionselect`               | `(opaque)`                     | no       | —       | Called when the user selects a suggestion chip. The label string is passed back. The consumer is responsible for submitting it as a new user message. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                           |
| `ontypingchange`                   | `(opaque)`                     | no       | —       | Forwarded from the adapter's real-time `onTypingChange` push. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                   |
| `onunreadindicatorchange`          | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |
| `row`                              | `(opaque)`                     | no       | —       | Full-row override. Renders an entire message row; receives the message and a `renderDefault` snippet for the built-in row (inversion of control), so a consumer can wrap or fully replace specific rows. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                        |
| `viewportAttachment`               | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                 |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
