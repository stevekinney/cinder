# @lostgradient/chat

`@lostgradient/chat` is Cinder's Svelte 5 conversation surface, packaged separately so applications that do not render Chat do not install or bundle its conversation-model dependencies.

## Install

Install the package and its peer dependencies together:

```bash
bun add @lostgradient/chat @lostgradient/cinder svelte
```

The supported Svelte peer range is `>=5.56.0 <6`; this package is developed against Svelte `5.56.0`. `@lostgradient/cinder` and `svelte` are peer dependencies — your application supplies a single copy of each. Cinder bundles its own pinned `lucide-svelte` as a regular dependency rather than a peer, so you no longer need to install it just to satisfy Cinder or Chat's former peer requirement — if your app also renders Lucide icons directly, keep your own `lucide-svelte` dependency for that. Chat's conversation model is built on `conversationalist`, which Chat declares as its own regular dependency: it is installed automatically with `@lostgradient/chat` and you never need to `bun add` it (or `zod`, one of its dependencies) yourself. Import the conversation types, builders, and `CURRENT_SCHEMA_VERSION` from `@lostgradient/chat` rather than from `conversationalist` directly.

Import Cinder's global styles once in your application, then import Chat from the package root:

```ts
import '@lostgradient/cinder/styles';
import Chat, { appendAssistantMessage, createConversation } from '@lostgradient/chat';

const conversation = appendAssistantMessage(
  createConversation({ id: 'support' }),
  'How can I help?',
);
```

```svelte
<div style="height: 32rem">
  <Chat id="support-chat" {conversation} />
</div>
```

Chat's component stylesheet is included by the component entry. Applications that need the stylesheet as a standalone asset can import `@lostgradient/chat/styles`.

## Components

- `@lostgradient/chat` — the Chat surface, conversation builders, model types, adapter types, message primitives, and export utilities.
- `@lostgradient/chat/composer-popover` — slash-command and mention suggestions anchored to `ChatInput`.
- `@lostgradient/chat/conversation-header` — active-conversation title, metadata, and export controls.
- `@lostgradient/chat/conversation-list` — conversation navigation, summaries, unread counts, and selection.

Each component entry also publishes `/schema`, `/variables`, `/styles`, and `/examples` artifacts. The package-wide machine-readable index is available from `@lostgradient/chat/manifest`.
