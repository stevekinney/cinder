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
  } from '@lostgradient/chat';

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

## Adapter-driven streaming

`ChatAdapter.sendMessage` deliberately stays a `Promise<void>` command. The
adapter owns the conversation snapshot, while `Chat` owns the transient visual
stream buffer. Pair the public streaming builders with the imperative instance
methods so both surfaces advance together:

```svelte
<script lang="ts">
  import {
    Chat,
    appendStreamingMessage,
    appendUserMessage,
    cancelStreamingMessage,
    createConversation,
    finalizeStreamingMessage,
    updateStreamingMessage,
    type ChatAdapter,
    type ConversationHistory,
  } from '@lostgradient/chat';

  let chat: ReturnType<typeof Chat> | undefined;
  let conversation = $state<ConversationHistory>(createConversation({ id: 'streaming' }));
  let streaming = $state(false);

  const adapter: ChatAdapter = {
    async sendMessage(message, _attachments) {
      conversation = appendUserMessage(conversation, message.content);
      const { conversation: started, messageId } = appendStreamingMessage(
        conversation,
        'assistant',
      );
      conversation = started;
      streaming = true;
      chat?.beginStreaming(messageId);

      let content = '';
      try {
        for await (const chunk of streamFromYourBackend(message)) {
          content += chunk;
          conversation = updateStreamingMessage(conversation, messageId, content);
          chat?.pushToken(chunk);
        }
        conversation = finalizeStreamingMessage(conversation, messageId);
      } catch (error) {
        conversation = cancelStreamingMessage(conversation, messageId);
        throw error;
      } finally {
        chat?.endStreaming();
        streaming = false;
      }
    },
  };
</script>

<Chat
  bind:this={chat}
  id="adapter-streaming-chat"
  {conversation}
  {adapter}
  {streaming}
  capabilities={{ attachments: false }}
/>
```

The assistant placeholder must exist before `beginStreaming`; update the same
snapshot for each token, finalize it before `endStreaming`, and cancel it when
the backend fails. The package's Adapter-driven streaming example uses a
complete finite stream without assuming a particular model provider.

> [!WARNING] `ChatAdapter.subscribe` runs inside Chat's own effect
> Chat opens `subscribe` from inside its internal mount `$effect`, so a
> synchronous `$state` write inside `subscribe` can throw
> `effect_update_depth_exceeded`. Defer it with `queueMicrotask` or `tick()`.
> The same applies if `subscribe` replays a buffered event by calling a handler
> (`onMessage`, `onTypingChange`, etc.) synchronously before returning — defer
> the CALL to the handler itself, not just any write of your own, since
> `onTypingChange`/`onReadReceipt` write Chat's own internal state before your
> code runs at all. See the `ChatAdapter.subscribe` and `ChatPushHandlers`
> JSDoc for the full explanation and working examples.

## Conversation data contract

Chat declares `@lostgradient/cinder` and `svelte` as peer dependencies — host
applications install those alongside `@lostgradient/chat`. `conversationalist`
(and its own `zod` dependency) is an implementation detail Chat owns: it
ships as a regular dependency of `@lostgradient/chat` and installs
automatically, so using Chat never requires a host application to add or
version-pick it. Import the conversation types, builders,
`CURRENT_SCHEMA_VERSION`, and `isJSONValue` from `@lostgradient/chat` rather
than importing `conversationalist` yourself. An application that uses
`conversationalist` APIs beyond what Chat re-exports may still depend on it
directly — that is supported, it just is not something Chat requires.

The exported schema version comes from the `conversationalist` version Chat
depends on. Histories produced by an older compatible schema can render
as-is; a newer schema requires upgrading `@lostgradient/chat`.

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

## Building composer overlays

Slash-command, mention, and autocomplete overlays should use Chat's composer
API instead of querying `.chat-input-editor` directly.

Use `bind:this` to read or control the composer:

```svelte
<script lang="ts">
  import { Chat } from '@lostgradient/chat';

  let chat: ReturnType<typeof Chat> | undefined;
</script>

<Chat
  bind:this={chat}
  id="assistant-chat"
  {conversation}
  oncomposerinput={(value) => updateOverlayQuery(value)}
  oncomposerkeydown={(event) => {
    if (!overlayOpen) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
      event.preventDefault();
      handleOverlayKey(event);
    }
  }}
/>
```

`getComposerValue()` returns the current plain-text value, `clearInput()`
clears it, and `getEditorElement()` returns the textarea element (or `null`
before mount and after teardown) for overlay anchoring and focus management.

`oncomposerkeydown` runs before Chat's internal Enter-to-send handling for
normal composer keydowns. If the callback calls `event.preventDefault()`, Chat
skips its internal key handling for that event. Chat does not call the hook
during IME composition, so Enter can still confirm the active candidate instead
of sending or being consumed by an overlay.

For ARIA combobox patterns, pass textarea-specific attributes through the
composer-prefixed props:

```svelte
<Chat
  id="assistant-chat"
  {conversation}
  composerRole="combobox"
  composerAriaExpanded={overlayOpen ? 'true' : 'false'}
  composerAriaControls="slash-command-listbox"
  composerAriaActiveDescendant={activeOptionId}
  composerAriaAutocomplete="list"
/>
```

## Announcing custom action-required rows

Chat owns always-rendered polite and assertive live regions outside the
`role="log"` timeline. If you render action-required UI through a custom `row`
or `messagePart` snippet, announce it through Chat instead of mounting another
`aria-live` region inside the log:

```svelte
<script lang="ts">
  import { Chat } from '@lostgradient/chat';

  let chat: ReturnType<typeof Chat> | undefined;

  function showCustomApproval() {
    chat?.announce('Action required: Review the deployment approval.', 'assertive');
  }
</script>

<Chat bind:this={chat} id="assistant-chat" {conversation} row={customRow} />
```

Use the default polite channel for non-urgent status updates:

```ts
chat?.announce('Attachment scan finished.');
```

Consumer announcements clear after a short interval so Chat's own history,
unread, typing, and tool-approval announcements can continue to flow.
Built-in tool-approval rows keep precedence on the assertive channel. If a
consumer assertive announcement races with Chat's derived
`Action required: ...` tool-approval announcement, Chat announces the built-in
tool approval and drops the consumer assertive text to avoid double output.

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
`serializeChatAttachments()` from `@lostgradient/chat` to convert those
files into transportable base64 payloads without spreading the full byte array
onto the JavaScript stack.

```ts
import { serializeChatAttachments } from '@lostgradient/chat';

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

| Prop                               | Type                                           | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ---------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atBottom`                         | `boolean`                                      | no       | —       | Whether the message viewport is scrolled to the bottom. Bindable; updated automatically as the user scrolls. Default `true`.                                                                                                                                                                                                                                                                                                           |
| `bottomThreshold`                  | `number`                                       | no       | —       | Distance in pixels from the bottom of the scroll viewport within which the chat is considered "at bottom" and will auto-scroll on new messages. Default `150`.                                                                                                                                                                                                                                                                         |
| `class`                            | `string`                                       | no       | —       | Additional class name merged onto the `.chat-container` root element.                                                                                                                                                                                                                                                                                                                                                                  |
| `composerAriaActiveDescendant`     | `string`                                       | no       | —       | `aria-activedescendant` passed to the composer textarea for overlays such as slash-command menus.                                                                                                                                                                                                                                                                                                                                      |
| `composerAriaAutocomplete`         | `"none"` \| `"inline"` \| `"list"` \| `"both"` | no       | —       | `aria-autocomplete` passed to the composer textarea for overlays such as slash-command menus.                                                                                                                                                                                                                                                                                                                                          |
| `composerAriaControls`             | `string`                                       | no       | —       | `aria-controls` passed to the composer textarea for overlays such as slash-command menus.                                                                                                                                                                                                                                                                                                                                              |
| `composerAriaExpanded`             | `false` \| `true` \| `"true"` \| `"false"`     | no       | —       | `aria-expanded` passed to the composer textarea for overlays such as slash-command menus.                                                                                                                                                                                                                                                                                                                                              |
| `composerRole`                     | `string`                                       | no       | —       | Explicit role for the composer textarea, for overlay patterns such as ARIA comboboxes.                                                                                                                                                                                                                                                                                                                                                 |
| `density`                          | `"comfortable"` \| `"compact"`                 | no       | —       | Controls spacing density of the message timeline. - `'comfortable'` (default): standard padding and gap. - `'compact'`: tighter spacing for data-dense contexts (e.g., embedded panels). Action buttons keep `min-height: var(--cinder-touch-target-min)` regardless.                                                                                                                                                                  |
| `emptyPrompts`                     | `string`[]                                     | no       | —       | List of suggested starter prompt strings shown as clickable buttons in the default empty state. Clicking a prompt submits it immediately as a user message. Has no effect when a custom `empty` snippet is provided.                                                                                                                                                                                                                   |
| `id`                               | `string`                                       | yes      | —       | Unique identifier used to scope accessibility attributes across the chat surface.                                                                                                                                                                                                                                                                                                                                                      |
| `jumpThreshold`                    | `number`                                       | no       | —       | Distance in pixels scrolled up from the bottom required before the jump-to-latest button appears. Must be greater than `bottomThreshold` to prevent button flickering. Default `200`.                                                                                                                                                                                                                                                  |
| `loadEarlierLabel`                 | `string`                                       | no       | —       | Label for the history pagination trigger. Default `"Load earlier messages"`.                                                                                                                                                                                                                                                                                                                                                           |
| `loadingEarlierLabel`              | `string`                                       | no       | —       | Status text while older messages are loading. Default `"Loading earlier messages"`.                                                                                                                                                                                                                                                                                                                                                    |
| `moreHistoryAvailable`             | `boolean`                                      | no       | —       | Whether the explicit "Load earlier messages" trigger is shown when a load handler exists. Default `true`.                                                                                                                                                                                                                                                                                                                              |
| `newMessageIndicatorVisible`       | `boolean`                                      | no       | —       | Whether the "new messages" indicator is currently visible above the composer. Bindable; cleared automatically when the viewport reaches the bottom. Default `false`.                                                                                                                                                                                                                                                                   |
| `streaming`                        | `boolean`                                      | no       | —       | Whether a streaming response is currently in progress. When `true`, the composer is disabled and a stop-generating button is shown. Default `false`.                                                                                                                                                                                                                                                                                   |
| `streamingStatus`                  | `string`                                       | no       | —       | Optional status label displayed in the typing indicator while `streaming` is `true` and no streaming content has arrived yet (e.g. `"Thinking…"` or `"Analyzing file…"`). When omitted, three animated dots are shown.                                                                                                                                                                                                                 |
| `surfaceMode`                      | `"default"` \| `"transparent"`                 | no       | —       | Controls the background of the chat surface. Use `'transparent'` to inherit the host element's background when embedding chat inside a card or panel. Default `'default'`.                                                                                                                                                                                                                                                             |
| `unreadCount`                      | `number`                                       | no       | —       | Number of messages received while the viewport was scrolled away from the bottom. Bindable; resets to `0` when the user scrolls to the bottom. Default `0`.                                                                                                                                                                                                                                                                            |
| `variant`                          | `"bubble"` \| `"flat"`                         | no       | —       | Visual treatment for message bubbles. - `'bubble'` (default): colored backgrounds differentiate user from assistant. - `'flat'`: no bubble backgrounds; role is communicated via alignment and role label. Text-on-surface contrast meets WCAG AA via `--cinder-text` on `--cinder-surface-inset`.                                                                                                                                     |
| `virtualizationEstimatedRowHeight` | `number`                                       | no       | —       | Estimated row height in pixels for virtualized message rows. Default `88`.                                                                                                                                                                                                                                                                                                                                                             |
| `virtualizationInitialHeight`      | `number`                                       | no       | —       | Initial virtualized viewport height used before measurement. Default `640`.                                                                                                                                                                                                                                                                                                                                                            |
| `virtualizationOverscan`           | `number`                                       | no       | —       | Number of extra virtual rows rendered before and after the viewport. Default `3`.                                                                                                                                                                                                                                                                                                                                                      |
| `virtualized`                      | `boolean`                                      | no       | —       | Use the virtualized message render path for long transcripts. The complete `ConversationHistory` remains unchanged; only the DOM window is reduced. Default `false`.                                                                                                                                                                                                                                                                   |
| `adapter`                          | `(opaque)`                                     | no       | —       | Optional command/transport boundary around `conversation`. Its methods take precedence over the matching callback props (e.g. `sendMessage` over `onsubmit`); omit it and Chat behaves exactly as with plain callbacks. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                     |
| `capabilities`                     | `(opaque)`                                     | no       | —       | Feature-capability flags. Pass a `ChatCapabilities` object to enable or disable individual Chat features (attachments, search, copy, editing, retry) as a group rather than as five separate boolean props. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                 |
| `conversation`                     | `(opaque)`                                     | yes      | —       | The conversation transcript to render. Pass a {@link ConversationHistory} snapshot; consumers holding a stateful conversation object pass its current snapshot (e.g. `conversation.current`). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                               |
| `empty`                            | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `header`                           | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `messageActions`                   | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `messagePart`                      | `(opaque)`                                     | no       | —       | Per-message-part override. Replaces the rendering of an individual body part (markdown, tool call, tool result) while delegating the rest to the built-ins via the `renderDefault` snippet it receives. Image parts are excluded — they render through the grouped attachment grid, not this override. Not expressible in JSON Schema; see the component types for the signature.                                                      |
| `messageReasoning`                 | `(opaque)`                                     | no       | —       | Override or supplement the reasoning text for a message. Called per-message; return a non-empty string to show a reasoning block, `undefined` to fall back to `message.metadata['cinder:reasoning']`, empty string to suppress reasoning. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                   |
| `messageStatus`                    | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `messageSteps`                     | `(opaque)`                                     | no       | —       | Override or supplement the step list for a message. Called per-message; return an array to show step indicators, `undefined` to fall back to `message.metadata['cinder:steps']`. An empty array suppresses steps. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                           |
| `messageSuggestions`               | `(opaque)`                                     | no       | —       | Override or supplement the suggestion list for a message. Called per-message; return an array of label strings to show suggestion chips, `undefined` to fall back to `message.metadata['cinder:suggestions']`. An empty array suppresses suggestions. Not expressible in JSON Schema; see the component types for the signature.                                                                                                       |
| `onadaptererror`                   | `(opaque)`                                     | no       | —       | Called when an adapter command fails — either a rejected promise or a synchronous throw from the method. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                    |
| `onapprove`                        | `(opaque)`                                     | no       | —       | Called when the user approves an action-required tool call. The consumer is responsible for updating its transcript (e.g. calling conversationalist to unblock the pending tool) and triggering a new generation. When an adapter is also wired, Chat calls `adapter.approveToolCall(toolCallId)` first and then this callback. Not expressible in JSON Schema; see the component types for the signature.                             |
| `onattachmentadd`                  | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onattachmentfailure`              | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onattachmentremove`               | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `oncomposerblur`                   | `(opaque)`                                     | no       | —       | Called when focus leaves the composer textarea. Overlay primitives can use this to dismiss without preventing native focus movement. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                        |
| `oncomposerinput`                  | `(opaque)`                                     | no       | —       | Called with the composer's current plain-text value on every composer input event. The optional event exposes the textarea for composer-bound overlays without reaching into `.chat-input-editor` DOM directly. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                             |
| `oncomposerkeydown`                | `(opaque)`                                     | no       | —       | Called before Chat's internal composer key handling when a keydown originates from the composer textarea. Call `event.preventDefault()` to let an overlay consume Arrow keys, Enter, or Escape before Enter-to-send. Chat does not call this hook during IME composition, so Enter can still confirm the active candidate instead of sending. Not expressible in JSON Schema; see the component types for the signature.               |
| `oncomposerselectionchange`        | `(opaque)`                                     | no       | —       | Called after pointer or selection activity may have moved the composer caret without changing text. Overlay primitives can resync their active token from the textarea selection. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                           |
| `ondeny`                           | `(opaque)`                                     | no       | —       | Called when the user denies an action-required tool call. When an adapter is also wired, Chat calls `adapter.denyToolCall(toolCallId)` first and then this callback. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                        |
| `onedit`                           | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onexpandedchange`                 | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onjumptolatest`                   | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onloadhistory`                    | `(opaque)`                                     | no       | —       | Called when the explicit history trigger is activated. The consumer prepends compatible messages into `conversation`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                       |
| `onpushmessage`                    | `(opaque)`                                     | no       | —       | Forwarded from the adapter's real-time `onMessage` push (consumer owns the transcript). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                     |
| `onreadreceipt`                    | `(opaque)`                                     | no       | —       | Forwarded from the adapter's real-time `onReadReceipt` push. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                |
| `onretry`                          | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onscrollstatechange`              | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onstopgenerating`                 | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onsubmit`                         | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `onsuggestionselect`               | `(opaque)`                                     | no       | —       | Called when the user selects a suggestion chip. The label string is passed back. The consumer is responsible for submitting it as a new user message. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                       |
| `ontypingchange`                   | `(opaque)`                                     | no       | —       | Forwarded from the adapter's real-time `onTypingChange` push. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                               |
| `onunreadindicatorchange`          | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |
| `readReceipts`                     | `(opaque)`                                     | no       | —       | Per-message read receipt state. Out-of-band UI state — NOT stored on `Message`. Pass a `Map` keyed by message id with a {@link ReadReceipt} value; the component renders a receipt badge on USER messages only. The adapter's `onReadReceipt` push handler populates the same state when an adapter is wired. Default `undefined` (no receipts shown). Not expressible in JSON Schema; see the component types for the signature.      |
| `row`                              | `(opaque)`                                     | no       | —       | Full-row override. Renders an entire message row; receives the message and a `renderDefault` snippet for the built-in row (inversion of control), so a consumer can wrap or fully replace specific rows. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                    |
| `typingParticipants`               | `(opaque)`                                     | no       | —       | Participants who are currently typing. Out-of-band UI state — NOT stored on `Message`. Pass an array of {@link TypingParticipant} objects; the component renders a per-participant typing indicator above the input. The adapter's `onTypingChange` push handler feeds the same indicator when an adapter is wired. Default `undefined` (indicator hidden). Not expressible in JSON Schema; see the component types for the signature. |
| `viewportAttachment`               | `(opaque)`                                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
