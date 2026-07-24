# @lostgradient/chat

`@lostgradient/chat` is Cinder's Svelte 5 conversation surface, packaged separately so applications that do not render Chat do not install or bundle its conversation-model dependencies.

## Install

Install the package and its peer dependencies together:

```bash
bun add @lostgradient/chat @lostgradient/cinder @lostgradient/markdown svelte
```

The supported Svelte peer range is `>=5.56.0 <6`; this package is developed against Svelte `5.56.0`. `@lostgradient/cinder`, `@lostgradient/markdown`, and `svelte` are peer dependencies — your application supplies a single copy of each. `@lostgradient/markdown` renders chat message bodies (Chat's `markdown-preview` component dynamically imports `@lostgradient/markdown/rendering`); it replaced Cinder's now-removed `@lostgradient/cinder/markdown/rendering` re-export shim. Cinder bundles its own pinned `lucide-svelte` as a regular dependency rather than a peer, so you no longer need to install it just to satisfy Cinder or Chat's former peer requirement — if your app also renders Lucide icons directly, keep your own `lucide-svelte` dependency for that. Chat's conversation model is built on `conversationalist`, which Chat declares as its own regular dependency: it is installed automatically with `@lostgradient/chat` and you never need to `bun add` it (or `zod`, one of its dependencies) yourself. Import the conversation types, builders, and `CURRENT_SCHEMA_VERSION` from `@lostgradient/chat` rather than from `conversationalist` directly.

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

## Connecting artifacts to messages

Store artifact data in `message.metadata['cinder:artifact']` using the exported `ChatArtifact` shape:

```ts
import type { MessageInput } from '@lostgradient/chat';

const result: MessageInput = {
  role: 'tool-result',
  content: '',
  metadata: {
    'cinder:artifact': {
      type: 'code',
      content: '{ "status": "ok" }',
      language: 'json',
      title: 'Tool report',
    },
  },
  toolResult: {
    callId: 'call-report',
    outcome: 'success',
    content: { status: 'ok' },
  },
};
```

`ChatArtifact` contains `type`, `content`, and optional `language` and `title` fields, matching the serializable `ArtifactViewer` props. `resolveMessageArtifact(message)` validates direct metadata access. Every `ChatRowContext` also exposes `artifact`; when a paired tool-result row is folded into its tool-call row, Chat resolves artifact metadata from the hidden result message automatically. Metadata on the visible message takes precedence when both messages define an artifact.

Use `messageActions` to open application-owned panel state, then render the selected descriptor with `ChatArtifactLayout` and `ArtifactViewer`. Chat does not open panels automatically because selection and close behavior belong to the containing application.

## Rendering Mermaid artifacts

`ArtifactViewer` renders HTML and SVG in sandboxed iframes and renders code as escaped source. Mermaid stays consumer-owned so applications can choose their Mermaid version, configuration, and security policy. Without a renderer, Mermaid artifacts show their source and an explicit fallback note.

Pass a `mermaidRenderer` snippet to delegate only the Mermaid branch to an application component:

```svelte
<script lang="ts">
  import { ArtifactViewer } from '@lostgradient/chat';
  import MermaidDiagram from './mermaid-diagram.svelte';

  const content = 'graph TD; Request-->Response;';
</script>

{#snippet mermaidRenderer(source, contentType)}
  <MermaidDiagram {source} ariaLabel={`${contentType} diagram`} />
{/snippet}

<ArtifactViewer type="mermaid" {content} {mermaidRenderer} />
```

The snippet has type `Snippet<[content: string, type: 'mermaid']>`. `ArtifactViewer` invokes it only when `type` is `mermaid`; HTML, SVG, and code continue through the built-in renderers. The application-owned component is responsible for loading Mermaid, handling asynchronous rendering and errors, and applying its required content-safety policy.
