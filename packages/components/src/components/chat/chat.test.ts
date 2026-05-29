/**
 * Smoke tests for the top-level Chat domain-suite component.
 *
 * Chat is a heavyweight drop-in that composes the container, message list,
 * composer, scroll affordances, and status announcer. Before this file the
 * outer `chat.svelte` had no test of its own — only a handful of leaf
 * sub-components were covered. These tests assert the contracts that matter
 * for the public surface:
 *
 *   1. Basic render — the component mounts and exposes its accessible region.
 *   2. Message rendering — user and assistant messages from a `Conversation`
 *      appear with the correct roles and content.
 *   3. Slot composition — the `header` and `empty` snippets compose into the
 *      rendered tree (and the `empty` snippet replaces the default state).
 *   4. SSR safety — the component's server compilation imports and evaluates
 *      after the DOM globals are removed from this realm, proving nothing in
 *      the chat tree reaches for `document`/`window` at module-evaluation time.
 *
 * Chat's composer embeds MarkdownEditor (Milkdown / ProseMirror), which does
 * not fully initialize under happy-dom. It does not crash the mount, so the
 * render-based tests below are reliable; we assert against the chat surface's
 * own structure rather than the composer's internals.
 */

/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import.
// testing-library reads `globalThis.document` / `window` at module-init, so we
// register happy-dom's globals first, then dynamic-import everything DOM-bound.
setupHappyDom();

// Chat wires an IntersectionObserver (bottom sentinel) and helpers that touch a
// ResizeObserver. happy-dom ships neither, so stub them before the component
// loads — a missing observer would throw during mount.
class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

class TestIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
globalThis.IntersectionObserver =
  TestIntersectionObserver as unknown as typeof IntersectionObserver;

const { render } = await import('@testing-library/svelte');
const { default: Chat } = await import('./chat.svelte');
const { createConversation, appendUserMessage, appendAssistantMessage } =
  await import('conversationalist');

/** Build a minimal Svelte snippet that renders a single text node. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

describe('Chat — basic render', () => {
  test('mounts the chat container with its accessible region', () => {
    const conversation = createConversation({ id: 'conversation-basic' });
    const { container } = render(Chat, {
      props: { id: 'chat-basic', conversation },
    });

    const region = container.querySelector('.chat-container');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('region');
    expect(region?.getAttribute('aria-label')).toBe('Chat conversation');
    // The root id is forwarded from the `id` prop.
    expect(region?.id).toBe('chat-basic');
  });

  test('derives the timeline id from the component id', () => {
    const conversation = createConversation({ id: 'conversation-timeline' });
    const { container } = render(Chat, {
      props: { id: 'chat-timeline', conversation },
    });

    const timeline = container.querySelector('.chat-timeline');
    expect(timeline?.id).toBe('chat-timeline-timeline');
    expect(timeline?.getAttribute('role')).toBe('log');
  });

  test('forwards a custom class onto the container', () => {
    const conversation = createConversation({ id: 'conversation-class' });
    const { container } = render(Chat, {
      props: { id: 'chat-class', conversation, class: 'my-custom-chat' },
    });

    const region = container.querySelector('.chat-container');
    expect(region?.classList.contains('my-custom-chat')).toBe(true);
  });

  test('renders the default empty state when the conversation has no messages', () => {
    const conversation = createConversation({ id: 'conversation-empty' });
    const { container } = render(Chat, {
      props: { id: 'chat-empty', conversation },
    });

    const empty = container.querySelector('.chat-empty');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain('No messages yet');
  });
});

describe('Chat — message rendering', () => {
  test('renders user and assistant messages with their content and roles', () => {
    let conversation = createConversation({ id: 'conversation-messages' });
    conversation = appendUserMessage(conversation, 'What is the capital of France?');
    conversation = appendAssistantMessage(conversation, 'The capital of France is Paris.');

    const { container } = render(Chat, {
      props: { id: 'chat-messages', conversation },
    });

    const messages = container.querySelectorAll('.chat-message');
    expect(messages).toHaveLength(2);

    const roles = Array.from(container.querySelectorAll('[data-role]')).map((element) =>
      element.getAttribute('data-role'),
    );
    expect(roles).toEqual(['user', 'assistant']);

    expect(container.textContent).toContain('What is the capital of France?');
    expect(container.textContent).toContain('The capital of France is Paris.');
  });

  test('renders messages in conversation order', () => {
    let conversation = createConversation({ id: 'conversation-order' });
    conversation = appendUserMessage(conversation, 'First message');
    conversation = appendAssistantMessage(conversation, 'Second message');
    conversation = appendUserMessage(conversation, 'Third message');

    const { container } = render(Chat, {
      props: { id: 'chat-order', conversation },
    });

    const messages = container.querySelectorAll('.chat-message');
    expect(messages).toHaveLength(3);
    // The empty state is gone once messages exist.
    expect(container.querySelector('.chat-empty')).toBeNull();

    // Order is the contract under test: the three messages must render in the
    // same sequence they were appended. Mapping each `.chat-message` to its
    // trimmed text content catches a reversed or shuffled list, which a bare
    // length check would miss.
    const renderedText = Array.from(messages).map((message) => message.textContent?.trim());
    expect(renderedText).toEqual([
      expect.stringContaining('First message'),
      expect.stringContaining('Second message'),
      expect.stringContaining('Third message'),
    ]);

    // Roles alternate user → assistant → user in append order; assert that too
    // so a regression that grouped or reordered by role is caught.
    const roles = Array.from(container.querySelectorAll('[data-role]')).map((element) =>
      element.getAttribute('data-role'),
    );
    expect(roles).toEqual(['user', 'assistant', 'user']);
  });
});

describe('Chat — slot composition', () => {
  test('renders the header snippet above the messages', () => {
    const conversation = createConversation({ id: 'conversation-header' });
    const { container } = render(Chat, {
      props: { id: 'chat-header', conversation, header: textSnippet('Conversation Title') },
    });

    const header = container.querySelector('.chat-header');
    expect(header).not.toBeNull();
    expect(header?.textContent).toContain('Conversation Title');
  });

  test('the empty snippet replaces the default empty state', () => {
    const conversation = createConversation({ id: 'conversation-custom-empty' });
    const { container } = render(Chat, {
      props: {
        id: 'chat-custom-empty',
        conversation,
        empty: textSnippet('Start the conversation'),
      },
    });

    // The default `.chat-empty` markup is not rendered when a custom snippet wins.
    expect(container.querySelector('.chat-empty')).toBeNull();
    expect(container.querySelector('.chat-timeline')?.textContent).toContain(
      'Start the conversation',
    );
  });

  test('renders the empty-state starter prompts', () => {
    const conversation = createConversation({ id: 'conversation-prompts' });
    const { container } = render(Chat, {
      props: {
        id: 'chat-prompts',
        conversation,
        emptyPrompts: ['Summarize this', 'Explain like I am five'],
      },
    });

    const promptButtons = container.querySelectorAll('.chat-empty-prompt');
    expect(promptButtons).toHaveLength(2);
    expect(Array.from(promptButtons).map((button) => button.textContent?.trim())).toEqual([
      'Summarize this',
      'Explain like I am five',
    ]);
  });
});

/**
 * Import a list of module specifiers with the realm's DOM globals removed, then
 * restore them. Returns whichever import (if any) threw a "not defined" error so
 * the caller can assert no module touched `document`/`window` at evaluation.
 *
 * The globals MUST be removed for this to mean anything. `setupHappyDom()` (run
 * at the top of this file, and again in `scripts/preload.ts`) installs live
 * `document`/`window` on `globalThis` for the whole test realm, so a module-level
 * `document.title` would otherwise resolve silently and the check would pass for
 * any compilable module. Removing them mirrors `test/hydrate.ts` (which nulls
 * `globalThis.document`/`window` around its server render for the same reason)
 * and `packages/editor/src/ssr-import.test.ts` (which deletes `document` before
 * importing the package entry).
 *
 * Each specifier is given a unique query string so Bun re-evaluates the module
 * body instead of serving the instance this file already cached when it imported
 * `Chat` at the top (with globals live). Without the cache-bust, a module-level
 * DOM access in an already-loaded sub-module would never re-run under the nulled
 * globals and the check would silently pass.
 */
async function importWithoutDomGlobals(specifiers: string[]): Promise<string | undefined> {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'document');
  Reflect.deleteProperty(globalThis, 'window');

  try {
    for (const specifier of specifiers) {
      const cacheBusted = `${specifier}${specifier.includes('?') ? '&' : '?'}ssr-eval=${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        await import(cacheBusted);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    }
    return undefined;
  } finally {
    if (documentDescriptor) {
      Object.defineProperty(globalThis, 'document', documentDescriptor);
    }
    if (windowDescriptor) {
      Object.defineProperty(globalThis, 'window', windowDescriptor);
    }
  }
}

describe('Chat — SSR safety', () => {
  /**
   * The chat tree must never reach for `document`/`window` at module
   * evaluation. We guard the OUTER shell by recompiling `chat.svelte` with
   * `generate: 'server'` and importing the result with the DOM globals removed
   * from the realm — a top-level DOM access in the shell's module body would
   * throw `document is not defined` the moment the module is evaluated.
   *
   * We import for module evaluation rather than calling `svelte/server`'s
   * `render()`. The server output imports `./container/chat.svelte` as raw
   * source, which the preload plugin (`scripts/preload.ts`) compiles in *client*
   * mode on dynamic import; feeding a client-compiled sub-tree to `render()`
   * trips `effect_orphan` when a helper's `$effect` runs outside an effect tree.
   * That is a harness limitation of recompiling only the outer shell, not an
   * SSR-safety property of the component.
   *
   * NOTE: this test alone is thin — the outer `chat.svelte` module body holds
   * only type re-exports and a `classNames` call, no DOM-touching code. The
   * substantive sub-tree coverage lives in the next test, which imports the
   * DOM-touching helper modules directly under nulled globals.
   */
  test('server compilation of the outer shell imports with no DOM globals at module level', async () => {
    const { compile } = await import('svelte/compiler');
    const { dirname, join, resolve } = await import('node:path');
    const { writeFile, rm } = await import('node:fs/promises');

    const sourcePath = resolve(import.meta.dir, 'chat.svelte');
    const source = await Bun.file(sourcePath).text();
    const compiled = compile(source, {
      filename: sourcePath,
      generate: 'server',
      css: 'external',
      dev: false,
    });

    // Write the SSR module next to the source so its relative imports resolve
    // identically (the `.mjs` extension keeps the preload plugin from
    // recompiling our already-compiled output). Mirrors `test/hydrate.ts`.
    const ssrFileName = `.cinder-ssr-chat-${process.pid}-${Date.now()}.mjs`;
    const ssrFile = join(dirname(sourcePath), ssrFileName);
    await writeFile(ssrFile, compiled.js.code, 'utf-8');

    try {
      const threwMessage = await importWithoutDomGlobals([ssrFile]);
      // A clean import is the SSR-safety proof: with the globals removed, a
      // module-level `document`/`window` access in the shell would have surfaced
      // here as a "not defined" message instead of `undefined`.
      expect(threwMessage).toBeUndefined();
    } finally {
      await rm(ssrFile, { force: true });
    }
  });

  /**
   * The DOM-touching modules in the chat sub-tree — the keyboard-nav helper
   * (reads `document.activeElement`) and the scroll-state helper (reads
   * `window.matchMedia` and constructs an `IntersectionObserver`) — keep all of
   * that access inside functions/methods, never at module evaluation. We prove
   * that by importing each module with the DOM globals removed: a top-level
   * `document`/`window` access anywhere in these modules would throw on import.
   *
   * This is the test that would actually catch a regression. Planting a
   * module-level `const x = document.title;` in either helper makes this test
   * fail with `document is not defined` (verified empirically); reverting the
   * plant makes it pass again.
   */
  test('DOM-touching chat helpers evaluate with no DOM globals at module level', async () => {
    const threwMessage = await importWithoutDomGlobals([
      './container/use-chat-keyboard-nav.svelte.ts',
      './container/use-chat-scroll-state.svelte.ts',
    ]);
    expect(threwMessage).toBeUndefined();
  });
});
