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

## Conversation data contract

Chat uses [`conversationalist`](https://www.npmjs.com/package/conversationalist)
as its transcript model. Install `conversationalist@^0.2.1` and `zod@4.4.1` in
the host application alongside `@lostgradient/cinder`; Cinder declares both as
required peer dependencies so application code, server-side model-context
builders, and Chat all share one package instance and one
`CURRENT_SCHEMA_VERSION`.

Cinder re-exports the conversationalist types and delegates conversation
builders/utilities to the installed peer. The schema-version rendering policy is
therefore tied to that peer:

- Histories produced by any supported `conversationalist@^0.2.1` version render
  as-is.
- Older histories render when the installed conversationalist version can still
  read that schema shape.
- Newer histories are not guaranteed to render on an older installed
  conversationalist version. Upgrade `conversationalist` within Cinder's peer
  range first; when Cinder widens the peer range for a new
  `CURRENT_SCHEMA_VERSION`, the changeset and release notes will call out the
  rendering contract change.

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

## Attachment serialization

When `capabilities.attachments` is enabled, `onsubmit` receives ready
`ChatAttachment[]` values. Use `serializeChatAttachment()` or
`serializeChatAttachments()` from `@lostgradient/cinder/chat` to convert those
files into transportable base64 payloads without spreading the full byte array
onto the JavaScript stack.

```ts
import { serializeChatAttachments } from '@lostgradient/cinder/chat';

const attachments = await serializeChatAttachments(chatAttachments);
```

Each serialized attachment has this shape:

```ts
type SerializedChatAttachment = {
  name: string;
  mimeType: string;
  kind: ChatAttachment['kind'];
  content: string;
};
```

The output is intentionally the base64 source payload for conversationalist's
proposed `DocumentContent` bridge in `stevekinney/agent-bureau#153`. A consumer
can wrap it as `{ type: 'document', name, mimeType, source: { kind: 'base64',
data: content } }` when adding composer attachments to conversation state.

## Props

<!-- generated:props:start -->

| Prop                               | Type                           | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------ | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atBottom`                         | `boolean`                      | no       | —       | Whether the message viewport is scrolled to the bottom. Bindable; updated automatically as the user scrolls. Default `true`.                                                                                                                                                                                                                                                                                                           |
| `bottomThreshold`                  | `number`                       | no       | —       | Distance in pixels from the bottom of the scroll viewport within which the chat is considered "at bottom" and will auto-scroll on new messages. Default `150`.                                                                                                                                                                                                                                                                         |
| `class`                            | `string`                       | no       | —       | Additional class name merged onto the `.chat-container` root element.                                                                                                                                                                                                                                                                                                                                                                  |
| `density`                          | `"comfortable"` \| `"compact"` | no       | —       | Controls spacing density of the message timeline. - `'comfortable'` (default): standard padding and gap. - `'compact'`: tighter spacing for data-dense contexts (e.g., embedded panels). Action buttons keep `min-height: var(--cinder-touch-target-min)` regardless.                                                                                                                                                                  |
| `emptyPrompts`                     | `string`[]                     | no       | —       | List of suggested starter prompt strings shown as clickable buttons in the default empty state. Clicking a prompt submits it immediately as a user message. Has no effect when a custom `empty` snippet is provided.                                                                                                                                                                                                                   |
| `id`                               | `string`                       | yes      | —       | Unique identifier used to scope accessibility attributes across the chat surface.                                                                                                                                                                                                                                                                                                                                                      |
| `jumpThreshold`                    | `number`                       | no       | —       | Distance in pixels scrolled up from the bottom required before the jump-to-latest button appears. Must be greater than `bottomThreshold` to prevent button flickering. Default `200`.                                                                                                                                                                                                                                                  |
| `loadEarlierLabel`                 | `string`                       | no       | —       | Label for the history pagination trigger. Default `"Load earlier messages"`.                                                                                                                                                                                                                                                                                                                                                           |
| `loadingEarlierLabel`              | `string`                       | no       | —       | Status text while older messages are loading. Default `"Loading earlier messages"`.                                                                                                                                                                                                                                                                                                                                                    |
| `moreHistoryAvailable`             | `boolean`                      | no       | —       | Whether the explicit "Load earlier messages" trigger is shown when a load handler exists. Default `true`.                                                                                                                                                                                                                                                                                                                              |
| `newMessageIndicatorVisible`       | `boolean`                      | no       | —       | Whether the "new messages" indicator is currently visible above the composer. Bindable; cleared automatically when the viewport reaches the bottom. Default `false`.                                                                                                                                                                                                                                                                   |
| `streaming`                        | `boolean`                      | no       | —       | Whether a streaming response is currently in progress. When `true`, the composer is disabled and a stop-generating button is shown. Default `false`.                                                                                                                                                                                                                                                                                   |
| `streamingStatus`                  | `string`                       | no       | —       | Optional status label displayed in the typing indicator while `streaming` is `true` and no streaming content has arrived yet (e.g. `"Thinking…"` or `"Analyzing file…"`). When omitted, three animated dots are shown.                                                                                                                                                                                                                 |
| `surfaceMode`                      | `"default"` \| `"transparent"` | no       | —       | Controls the background of the chat surface. Use `'transparent'` to inherit the host element's background when embedding chat inside a card or panel. Default `'default'`.                                                                                                                                                                                                                                                             |
| `unreadCount`                      | `number`                       | no       | —       | Number of messages received while the viewport was scrolled away from the bottom. Bindable; resets to `0` when the user scrolls to the bottom. Default `0`.                                                                                                                                                                                                                                                                            |
| `variant`                          | `"bubble"` \| `"flat"`         | no       | —       | Visual treatment for message bubbles. - `'bubble'` (default): colored backgrounds differentiate user from assistant. - `'flat'`: no bubble backgrounds; role is communicated via alignment and role label. Text-on-surface contrast meets WCAG AA via `--cinder-text` on `--cinder-surface-inset`.                                                                                                                                     |
| `virtualizationEstimatedRowHeight` | `number`                       | no       | —       | Estimated row height in pixels for virtualized message rows. Default `88`.                                                                                                                                                                                                                                                                                                                                                             |
| `virtualizationInitialHeight`      | `number`                       | no       | —       | Initial virtualized viewport height used before measurement. Default `640`.                                                                                                                                                                                                                                                                                                                                                            |
| `virtualizationOverscan`           | `number`                       | no       | —       | Number of extra virtual rows rendered before and after the viewport. Default `3`.                                                                                                                                                                                                                                                                                                                                                      |
| `virtualized`                      | `boolean`                      | no       | —       | Use the virtualized message render path for long transcripts. The complete `ConversationHistory` remains unchanged; only the DOM window is reduced. Default `false`.                                                                                                                                                                                                                                                                   |
| `adapter`                          | `(opaque)`                     | no       | —       | Optional command/transport boundary around `conversation`. Its methods take precedence over the matching callback props (e.g. `sendMessage` over `onsubmit`); omit it and Chat behaves exactly as with plain callbacks. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                     |
| `capabilities`                     | `(opaque)`                     | no       | —       | Feature-capability flags. Pass a `ChatCapabilities` object to enable or disable individual Chat features (attachments, search, copy, editing, retry) as a group rather than as five separate boolean props. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                 |
| `conversation`                     | `(opaque)`                     | yes      | —       | The conversation transcript to render. Pass a {@link ConversationHistory} snapshot; consumers holding a stateful conversation object pass its current snapshot (e.g. `conversation.current`). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                               |
| `empty`                            | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `header`                           | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `messageActions`                   | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `messagePart`                      | `(opaque)`                     | no       | —       | Per-message-part override. Replaces the rendering of an individual body part (markdown, tool call, tool result) while delegating the rest to the built-ins via the `renderDefault` snippet it receives. Image parts are excluded — they render through the grouped attachment grid, not this override. Not expressible in JSON Schema; see the component types for the signature.                                                      |
| `messageReasoning`                 | `(opaque)`                     | no       | —       | Override or supplement the reasoning text for a message. Called per-message; return a non-empty string to show a reasoning block, `undefined` to fall back to `message.metadata['cinder:reasoning']`, empty string to suppress reasoning. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                   |
| `messageStatus`                    | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `messageSteps`                     | `(opaque)`                     | no       | —       | Override or supplement the step list for a message. Called per-message; return an array to show step indicators, `undefined` to fall back to `message.metadata['cinder:steps']`. An empty array suppresses steps. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                           |
| `messageSuggestions`               | `(opaque)`                     | no       | —       | Override or supplement the suggestion list for a message. Called per-message; return an array of label strings to show suggestion chips, `undefined` to fall back to `message.metadata['cinder:suggestions']`. An empty array suppresses suggestions. Not expressible in JSON Schema; see the component types for the signature.                                                                                                       |
| `onadaptererror`                   | `(opaque)`                     | no       | —       | Called when an adapter command fails — either a rejected promise or a synchronous throw from the method. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                    |
| `onapprove`                        | `(opaque)`                     | no       | —       | Called when the user approves an action-required tool call. The consumer is responsible for updating its transcript (e.g. calling conversationalist to unblock the pending tool) and triggering a new generation. When an adapter is also wired, Chat calls `adapter.approveToolCall(toolCallId)` first and then this callback. Not expressible in JSON Schema; see the component types for the signature.                             |
| `onattachmentadd`                  | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onattachmentfailure`              | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onattachmentremove`               | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `oncomposerinput`                  | `(opaque)`                     | no       | —       | Called with the composer's current plain-text value on every composer input event. Lets a consumer build slash-command, mention, or autocomplete UX without reaching into `.chat-input-editor` DOM directly. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                |
| `ondeny`                           | `(opaque)`                     | no       | —       | Called when the user denies an action-required tool call. When an adapter is also wired, Chat calls `adapter.denyToolCall(toolCallId)` first and then this callback. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                        |
| `onedit`                           | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onexpandedchange`                 | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onjumptolatest`                   | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onloadhistory`                    | `(opaque)`                     | no       | —       | Called when the explicit history trigger is activated. The consumer prepends compatible messages into `conversation`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                       |
| `onpushmessage`                    | `(opaque)`                     | no       | —       | Forwarded from the adapter's real-time `onMessage` push (consumer owns the transcript). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                     |
| `onreadreceipt`                    | `(opaque)`                     | no       | —       | Forwarded from the adapter's real-time `onReadReceipt` push. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                |
| `onretry`                          | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onscrollstatechange`              | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onstopgenerating`                 | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onsubmit`                         | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onsuggestionselect`               | `(opaque)`                     | no       | —       | Called when the user selects a suggestion chip. The label string is passed back. The consumer is responsible for submitting it as a new user message. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                       |
| `ontypingchange`                   | `(opaque)`                     | no       | —       | Forwarded from the adapter's real-time `onTypingChange` push. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                               |
| `onunreadindicatorchange`          | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `readReceipts`                     | `(opaque)`                     | no       | —       | Per-message read receipt state. Out-of-band UI state — NOT stored on `Message`. Pass a `Map` keyed by message id with a {@link ReadReceipt} value; the component renders a receipt badge on USER messages only. The adapter's `onReadReceipt` push handler populates the same state when an adapter is wired. Default `undefined` (no receipts shown). Not expressible in JSON Schema; see the component types for the signature.      |
| `row`                              | `(opaque)`                     | no       | —       | Full-row override. Renders an entire message row; receives the message and a `renderDefault` snippet for the built-in row (inversion of control), so a consumer can wrap or fully replace specific rows. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                    |
| `typingParticipants`               | `(opaque)`                     | no       | —       | Participants who are currently typing. Out-of-band UI state — NOT stored on `Message`. Pass an array of {@link TypingParticipant} objects; the component renders a per-participant typing indicator above the input. The adapter's `onTypingChange` push handler feeds the same indicator when an adapter is wired. Default `undefined` (indicator hidden). Not expressible in JSON Schema; see the component types for the signature. |
| `viewportAttachment`               | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
