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
import { afterAll, afterEach, describe, expect, jest, test } from 'bun:test';
import { createRawSnippet, mount, tick, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { importWithoutDomGlobals } from '../../test/import-without-dom-globals.ts';

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
const originalResizeObserver = globalThis.ResizeObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

class TestIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
const originalIntersectionObserver = globalThis.IntersectionObserver;
globalThis.IntersectionObserver =
  TestIntersectionObserver as unknown as typeof IntersectionObserver;
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  jest.useRealTimers();
  cleanup();
  document.body.replaceChildren();
});

const { default: Chat } = await import('./chat.svelte');

// Local test builders for focused fixtures. The types come from the published
// Conversationalist bridge so the fixtures stay aligned with the package shape.
type TestConversation = import('./conversation-model.ts').ConversationHistory;
type TestMessage = import('./conversation-model.ts').Message;
type TestRole = import('./conversation-model.ts').MessageRole;
type TestToolResult = import('./conversation-model.ts').ToolResult;
type TestChatRowContext = import('./index.ts').ChatRowContext;

let testMessageCounter = 0;

function createConversation(options?: { id?: string }): TestConversation {
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    id: options?.id ?? `test-conversation-${++testMessageCounter}`,
    status: 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt: now,
    updatedAt: now,
  };
}

function appendMessage(
  conversation: TestConversation,
  role: TestRole,
  content: string,
): TestConversation {
  const id = `test-message-${++testMessageCounter}`;
  const now = new Date().toISOString();
  return {
    ...conversation,
    ids: [...conversation.ids, id],
    messages: {
      ...conversation.messages,
      [id]: {
        id,
        role,
        content,
        position: conversation.ids.length,
        createdAt: now,
        metadata: {},
        hidden: false,
      },
    },
    updatedAt: now,
  };
}

const appendUserMessage = (conversation: TestConversation, content: string) =>
  appendMessage(conversation, 'user', content);
const appendAssistantMessage = (conversation: TestConversation, content: string) =>
  appendMessage(conversation, 'assistant', content);

function appendActionRequiredMessage(
  conversation: TestConversation,
  message = 'Deploy to production?',
): TestConversation {
  const id = `test-message-${++testMessageCounter}`;
  const now = new Date().toISOString();
  const toolResult: TestToolResult = {
    callId: `call-${testMessageCounter}`,
    outcome: 'action_required',
    content: null,
    action: { type: 'approval', message },
  };

  return {
    ...conversation,
    ids: [...conversation.ids, id],
    messages: {
      ...conversation.messages,
      [id]: {
        id,
        role: 'tool-result',
        content: '',
        position: conversation.ids.length,
        createdAt: now,
        metadata: {},
        hidden: false,
        toolResult,
      },
    },
    updatedAt: now,
  };
}

/** Build a minimal Svelte snippet that renders a single text node. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

function messageIdSnippet(attributeName: string) {
  return createRawSnippet<[TestChatRowContext]>((context) => ({
    render: () =>
      `<span data-${attributeName}="${context().message.id}">${context().message.id}</span>`,
    setup: () => {},
  }));
}

function replacingRowSnippet() {
  return createRawSnippet<[TestChatRowContext]>((context) => ({
    render: () =>
      `<article data-custom-row="${context().message.id}">Custom ${context().message.role} row</article>`,
    setup: () => {},
  }));
}

function createFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* iterator() {
      for (const file of files) yield file;
    },
  } as FileList & { [index: number]: File };

  files.forEach((file, index) => {
    fileList[index] = file;
  });

  return fileList;
}

function createDragEvent(type: string, files: File[], types: string[] = ['Files']): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: {
      files: createFileList(files),
      types,
      dropEffect: 'none',
    },
  });
  return event;
}

type ChatAnnouncerApi = {
  announce: (message: string, level?: 'polite' | 'assertive') => void;
};

function liveRegion(
  container: HTMLElement,
  level: 'polite' | 'assertive',
): HTMLElement | undefined {
  const regions = Array.from(
    container.querySelectorAll<HTMLElement>(`.cinder-sr-only[aria-live="${level}"]`),
  );
  return regions.find((region) => region.getAttribute('aria-atomic') === 'true');
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

describe('Chat — announcer API', () => {
  test('announce() writes polite messages into the registered Chat live region', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const conversation = createConversation({ id: 'conversation-announce-polite' });
    const mounted = mount(Chat, {
      target,
      props: { id: 'chat-announce-polite', conversation },
    });
    const instance = mounted as unknown as ChatAnnouncerApi;

    await tick();
    const polite = liveRegion(target, 'polite');
    expect(polite).not.toBeUndefined();
    expect(polite?.textContent).toBe('');

    instance.announce('Custom approval is ready for review');
    await tick();

    expect(polite?.textContent).toBe('Custom approval is ready for review');

    unmount(mounted);
    target.remove();
  });

  test('announce() writes assertive messages unless a built-in tool approval is active', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const conversation = createConversation({ id: 'conversation-announce-assertive' });
    const mounted = mount(Chat, {
      target,
      props: { id: 'chat-announce-assertive', conversation },
    });
    const instance = mounted as unknown as ChatAnnouncerApi;

    await tick();
    const assertive = liveRegion(target, 'assertive');
    expect(assertive).not.toBeUndefined();
    expect(assertive?.textContent).toBe('');

    instance.announce('Custom row requires approval', 'assertive');
    await tick();

    expect(assertive?.textContent).toBe('Custom row requires approval');

    unmount(mounted);
    target.remove();
  });

  test('announce() clears consumer messages so built-in live-region messages can resume', async () => {
    jest.useFakeTimers();
    const target = document.createElement('div');
    document.body.append(target);
    const conversation = createConversation({ id: 'conversation-announce-clear' });
    const mounted = mount(Chat, {
      target,
      props: { id: 'chat-announce-clear', conversation },
    });
    const instance = mounted as unknown as ChatAnnouncerApi;

    await tick();
    const polite = liveRegion(target, 'polite');
    const assertive = liveRegion(target, 'assertive');

    instance.announce('Custom status finished');
    instance.announce('Custom action required', 'assertive');
    await tick();

    expect(polite?.textContent).toBe('Custom status finished');
    expect(assertive?.textContent).toBe('Custom action required');

    jest.advanceTimersByTime(999);
    await tick();
    expect(polite?.textContent).toBe('Custom status finished');
    expect(assertive?.textContent).toBe('Custom action required');

    jest.advanceTimersByTime(1);
    await tick();
    expect(polite?.textContent).toBe('');
    expect(assertive?.textContent).toBe('');

    unmount(mounted);
    target.remove();
  });

  test('conversation changes clear consumer announcements', async () => {
    const firstConversation = createConversation({ id: 'conversation-announce-reset-a' });
    const secondConversation = createConversation({ id: 'conversation-announce-reset-b' });
    const { component, container, rerender } = render(Chat, {
      props: { id: 'chat-announce-reset', conversation: firstConversation },
    });
    const instance = component as unknown as ChatAnnouncerApi;

    await tick();
    const polite = liveRegion(container, 'polite');

    instance.announce('Custom status from first conversation');
    await tick();
    expect(polite?.textContent).toBe('Custom status from first conversation');

    await rerender({ id: 'chat-announce-reset', conversation: secondConversation });

    expect(polite?.textContent).toBe('');
  });

  test('built-in tool approval wins over racing consumer assertive announcements', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    let conversation = createConversation({ id: 'conversation-announce-race' });
    conversation = appendActionRequiredMessage(conversation, 'Deploy to production?');
    const mounted = mount(Chat, {
      target,
      props: { id: 'chat-announce-race', conversation },
    });
    const instance = mounted as unknown as ChatAnnouncerApi;

    await tick();
    const assertive = liveRegion(target, 'assertive');
    expect(assertive?.textContent).toBe('Action required: Deploy to production?');

    instance.announce('Custom row also requires approval', 'assertive');
    await tick();

    expect(assertive?.textContent).toBe('Action required: Deploy to production?');
    expect(assertive?.textContent).not.toContain('Custom row also requires approval');

    unmount(mounted);
    target.remove();
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

  test('starter prompts submit through the normal message path', async () => {
    const submitted: string[] = [];
    const conversation = createConversation({ id: 'conversation-prompt-submit' });
    const { container } = render(Chat, {
      props: {
        id: 'chat-prompt-submit',
        conversation,
        emptyPrompts: ['Summarize this'],
        onsubmit: (event: { message: { content: unknown } }) => {
          submitted.push(String(event.message.content));
        },
      },
    });

    await fireEvent.click(container.querySelector<HTMLButtonElement>('.chat-empty-prompt')!);

    expect(submitted).toEqual(['Summarize this']);
  });

  test('renders message action and status snippets inside the default row', () => {
    let conversation = createConversation({ id: 'conversation-message-slots' });
    conversation = appendAssistantMessage(conversation, 'Message with extra controls');
    const messageId = conversation.ids.at(-1)!;

    const { container } = render(Chat, {
      props: {
        id: 'chat-message-slots',
        conversation,
        messageActions: messageIdSnippet('message-action'),
        messageStatus: messageIdSnippet('message-status'),
      },
    });

    expect(container.querySelector(`[data-message-action="${messageId}"]`)).not.toBeNull();
    expect(container.querySelector(`[data-message-status="${messageId}"]`)).not.toBeNull();
    expect(container.textContent).toContain('Message with extra controls');
  });

  test('folds a paired tool result into every visible tool-call row snippet context', () => {
    const now = new Date().toISOString();
    const toolCall: NonNullable<TestMessage['toolCall']> = {
      id: 'call-exports-check',
      name: 'exports_check',
      arguments: { package: '@lostgradient/cinder' },
    };
    const toolResult: TestToolResult = {
      callId: toolCall.id,
      outcome: 'success',
      content: { status: 'ok', drift: false },
    };
    const conversation: TestConversation = {
      ...createConversation({ id: 'conversation-paired-tool-result-context' }),
      ids: ['tool-call-message', 'tool-result-message'],
      messages: {
        'tool-call-message': {
          id: 'tool-call-message',
          role: 'tool-call',
          content: '',
          position: 0,
          createdAt: now,
          metadata: {},
          hidden: false,
          toolCall,
        },
        'tool-result-message': {
          id: 'tool-result-message',
          role: 'tool-result',
          content: '',
          position: 1,
          createdAt: now,
          metadata: {
            'cinder:artifact': {
              type: 'code',
              content: '{ "status": "ok" }',
              language: 'json',
              title: 'Exports report',
            },
          },
          hidden: false,
          toolResult,
        },
      },
      updatedAt: now,
    };

    const contextSnippet = (name: string) =>
      createRawSnippet<[TestChatRowContext]>((getContext) => ({
        render: () => {
          const context = getContext();
          const result = context.toolCallPair?.result;
          const content = result?.content as Record<string, unknown> | undefined;
          const status = content?.['status'];
          return `<span data-row-context="${name}" data-message-id="${context.message?.id ?? ''}" data-result-status="${typeof status === 'string' ? status : ''}" data-artifact-type="${context.artifact?.type ?? ''}" data-artifact-title="${context.artifact?.title ?? ''}"></span>`;
        },
        setup: () => {},
      }));

    const { container } = render(Chat, {
      props: {
        id: 'chat-paired-tool-result-context',
        conversation,
        messageActions: contextSnippet('actions') as never,
        messageStatus: contextSnippet('status') as never,
      },
    });

    expect(container.querySelectorAll('.chat-message-wrapper[data-role="tool-call"]')).toHaveLength(
      1,
    );
    expect(
      container.querySelectorAll('.chat-message-wrapper[data-role="tool-result"]'),
    ).toHaveLength(0);
    for (const name of ['actions', 'status']) {
      const snippet = container.querySelector(`[data-row-context="${name}"]`);
      expect(snippet?.getAttribute('data-message-id')).toBe('tool-call-message');
      expect(snippet?.getAttribute('data-result-status')).toBe('ok');
      expect(snippet?.getAttribute('data-artifact-type')).toBe('code');
      expect(snippet?.getAttribute('data-artifact-title')).toBe('Exports report');
    }

    const row = contextSnippet('row');
    const rowRender = render(Chat, {
      props: {
        id: 'chat-paired-tool-result-row-context',
        conversation,
        row: row as never,
      },
    });
    const rowSnippet = rowRender.container.querySelector('[data-row-context="row"]');
    expect(rowSnippet?.getAttribute('data-message-id')).toBe('tool-call-message');
    expect(rowSnippet?.getAttribute('data-result-status')).toBe('ok');
    expect(rowSnippet?.getAttribute('data-artifact-type')).toBe('code');
    expect(rowSnippet?.getAttribute('data-artifact-title')).toBe('Exports report');
  });

  test('a row override can replace the built-in message row', () => {
    let conversation = createConversation({ id: 'conversation-row-override' });
    conversation = appendUserMessage(conversation, 'Original message text');
    const messageId = conversation.ids.at(-1)!;

    const { container } = render(Chat, {
      props: {
        id: 'chat-row-override',
        conversation,
        row: replacingRowSnippet(),
      },
    });

    expect(container.querySelector(`[data-custom-row="${messageId}"]`)?.textContent).toBe(
      'Custom user row',
    );
    expect(container.querySelector('.chat-message')).toBeNull();
  });
});

describe('Chat — interactions', () => {
  test('Ctrl+F opens in-chat search and refocuses it when already open', async () => {
    let conversation = createConversation({ id: 'conversation-search' });
    conversation = appendUserMessage(conversation, 'alpha one');
    conversation = appendAssistantMessage(conversation, 'beta two');
    const { container } = render(Chat, {
      props: { id: 'chat-search', conversation },
    });
    const root = container.querySelector<HTMLElement>('.chat-container')!;

    await fireEvent.keyDown(root, { key: 'f', ctrlKey: true });
    const input = await waitFor(() => {
      const searchInput = container.querySelector<HTMLInputElement>('.chat-search-input');
      expect(searchInput).not.toBeNull();
      return searchInput!;
    });
    expect(document.activeElement).toBe(input);

    container.querySelector<HTMLElement>('.chat-timeline')?.focus();
    expect(document.activeElement).not.toBe(input);
    await fireEvent.keyDown(root, { key: 'f', ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  test('file drag overlay appears only for allowed file drags and clears on drop', async () => {
    const conversation = createConversation({ id: 'conversation-drag' });
    const { container } = render(Chat, {
      props: { id: 'chat-drag', conversation },
    });
    const root = container.querySelector<HTMLElement>('.chat-container')!;
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });

    await fireEvent(root, createDragEvent('dragover', [], ['text/plain']));
    expect(container.querySelector('.chat-drop-overlay')).toBeNull();

    await fireEvent(root, createDragEvent('dragover', [file]));
    expect(container.querySelector('.chat-drop-overlay')).not.toBeNull();

    await fireEvent(root, createDragEvent('drop', [file]));
    await waitFor(() => expect(container.querySelector('.chat-drop-overlay')).toBeNull());
  });

  test('file drag overlay stays hidden when attachments are disabled', async () => {
    const conversation = createConversation({ id: 'conversation-drag-disabled' });
    const { container } = render(Chat, {
      props: { id: 'chat-drag-disabled', conversation, capabilities: { attachments: false } },
    });
    const root = container.querySelector<HTMLElement>('.chat-container')!;
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });

    await fireEvent(root, createDragEvent('dragover', [file]));

    expect(container.querySelector('.chat-drop-overlay')).toBeNull();
  });

  test('non-file drops are ignored by the container-level file drop handler', async () => {
    const conversation = createConversation({ id: 'conversation-non-file-drop' });
    const { container } = render(Chat, {
      props: { id: 'chat-non-file-drop', conversation },
    });
    const root = container.querySelector<HTMLElement>('.chat-container')!;
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    const dropEvent = createDragEvent('drop', [file], ['text/plain']);

    await fireEvent(root, dropEvent);

    expect(container.querySelector('.chat-drop-overlay')).toBeNull();
    expect(dropEvent.defaultPrevented).toBe(false);
  });

  test('renders streaming status text while waiting for a streaming message id', () => {
    let conversation = createConversation({ id: 'conversation-streaming-status' });
    conversation = appendUserMessage(conversation, 'Can you help?');
    const { container } = render(Chat, {
      props: {
        id: 'chat-streaming-status',
        conversation,
        streaming: true,
        streamingStatus: 'Thinking through the answer',
      },
    });

    const indicator = container.querySelector('.chat-typing-indicator');
    expect(indicator?.getAttribute('aria-label')).toBe('Thinking through the answer');
    expect(indicator?.textContent).toContain('Thinking through the answer');
  });

  test('stop generating targets the latest assistant message', async () => {
    let conversation = createConversation({ id: 'conversation-stop' });
    conversation = appendAssistantMessage(conversation, 'Earlier assistant message');
    conversation = appendUserMessage(conversation, 'Follow up');
    conversation = appendAssistantMessage(conversation, 'Latest assistant message');
    const latestAssistantId = conversation.ids.at(-1)!;
    const stopped: string[] = [];

    const { getByLabelText } = render(Chat, {
      props: {
        id: 'chat-stop',
        conversation,
        streaming: true,
        onstopgenerating: (event: { messageId: string }) => stopped.push(event.messageId),
      },
    });

    await fireEvent.click(getByLabelText('Stop generating'));

    expect(stopped).toEqual([latestAssistantId]);
  });
});

describe('Chat — atBottom bindable after send', () => {
  test('handleSubmit fires onsubmit and does not throw (atBottom write regression guard)', async () => {
    // Regression: handleSubmit called scrollState.setIsAtBottom(true) but never
    // wrote to the `atBottom` bindable prop. The parent binding went stale:
    // a consumer with `bind:atBottom` would see false even though Chat had set
    // the internal state to true. The fix adds `atBottom = true` immediately
    // after `scrollState.setIsAtBottom(true)` in handleSubmit.
    //
    // Directly observing a bindable prop update from outside a Svelte parent
    // requires a wrapper component. As a behavioral regression guard, we verify
    // the send path completes correctly and that the component renders in a
    // consistent state after sending (no stale atBottom causing an unexpected
    // jump button to appear or auto-scroll to fail silently).
    const submitted: string[] = [];

    const { container } = render(Chat, {
      props: {
        id: 'chat-atbottom-send',
        conversation: createConversation({ id: 'conversation-atbottom-send' }),
        atBottom: false,
        emptyPrompts: ['Tell me a joke'],
        onsubmit: (event: { message: { content: unknown } }) => {
          submitted.push(String(event.message.content));
        },
      },
    });

    const promptButton = container.querySelector<HTMLButtonElement>('.chat-empty-prompt');
    expect(promptButton).not.toBeNull();
    await fireEvent.click(promptButton!);

    // The send completed — handleSubmit ran without throwing.
    expect(submitted).toEqual(['Tell me a joke']);

    // After send, the jump button must NOT appear: handleSubmit set
    // scrollState.setAtBottom(true) so showJumpButton remains false.
    // (showJumpButton is derived from scrollState, not from the atBottom binding.)
    const jumpButton = container.querySelector('.chat-jump-button');
    expect(jumpButton).toBeNull();
  });
});

describe('Chat — public wrapper forwards bind:atBottom/unreadCount/newMessageIndicatorVisible', () => {
  // Regression for #772/#786: chat.svelte (the public wrapper exported from
  // the package) spread atBottom/unreadCount/newMessageIndicatorVisible into
  // `...rest` instead of declaring them with `$bindable()` and forwarding
  // `bind:` to the internal implementation. That made the *wrapper's* emitted
  // .d.ts report an empty Bindings type parameter (`Component<ChatProps, {...},
  // "">`) even though ChatProps documents them as bindable and the internal
  // implementation implements them correctly — svelte-check correctly rejected
  // `bind:atBottom` on a consuming .svelte file as a result. See
  // chat.svelte's `$props()` destructure and function bindings on
  // <ChatImplementation> for the fix. Function bindings matter for SSR: shorthand
  // component bindings force a settle re-render, which runs child lifecycle
  // registration after Svelte has cleared the active server component context.
  //
  // A runtime render-based check (a host wrapper component that binds and
  // reads the value back) reliably crashes bun:test + happy-dom + the
  // testing-library/svelte mount path for *any* nested `bind:` + template
  // read of a bindable prop, independent of Chat entirely (reproduced with a
  // two-line throwaway parent/child pair). That is a pre-existing harness
  // limitation, not something this fix introduces, so the runtime contract is
  // instead covered by `bun run --filter=@lostgradient/chat validate:consumer`,
  // which runs `svelte-check` against the *packed, installed* artifact with a
  // real `bind:atBottom` / `bind:unreadCount` / `bind:newMessageIndicatorVisible`
  // consumer file — the exact failure mode from the issue. The compiler-output
  // check below guards the wrapper's server behavior at the unit-test layer.
  test('chat.svelte declares bindable state and avoids an SSR settle re-render', async () => {
    const { resolve } = await import('node:path');
    const { compile } = await import('svelte/compiler');
    const source = await Bun.file(resolve(import.meta.dir, 'chat.svelte')).text();

    // Whitespace-tolerant: prettier runs over this file via lint-staged, so an
    // exact-substring assertion would eventually fail on a reformat even though
    // the wrapper still declares and forwards the bindings correctly.
    expect(source).toMatch(/atBottom\s*=\s*\$bindable\(\s*true\s*\)/);
    expect(source).toMatch(/unreadCount\s*=\s*\$bindable\(\s*0\s*\)/);
    expect(source).toMatch(/newMessageIndicatorVisible\s*=\s*\$bindable\(\s*false\s*\)/);

    const serverCode = compile(source, {
      filename: resolve(import.meta.dir, 'chat.svelte'),
      generate: 'server',
      runes: true,
    }).js.code;
    expect(serverCode).not.toContain('$$settled = false');
  });
});

describe('Chat — imperative API forwarding', () => {
  // The forwarded surface, as a flat interface so dot-access on the mounted
  // instance is real-property access (avoids the index-signature access rule on
  // the raw mount() return type).
  type ChatImperative = {
    beginStreaming: (messageId: string) => void;
    pushToken: (token: string) => void;
    endStreaming: () => void;
    scrollToBottom: () => void;
    scrollToTop: () => void;
    focusInput: () => void;
  };

  const IMPERATIVE_METHODS = [
    'beginStreaming',
    'pushToken',
    'endStreaming',
    'scrollToBottom',
    'scrollToTop',
    'focusInput',
  ] as const;

  // mount()/unmount() (rather than @testing-library's render) gives direct
  // access to the component instance, which is where the wrapper's forwarded
  // `export function`s live.

  test('the public Chat instance exposes the forwarded imperative methods', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const conversation = createConversation({ id: 'conversation-imperative' });
    const instance = mount(Chat, { target, props: { id: 'chat-imperative', conversation } });
    const asRecord = instance as unknown as Record<string, unknown>;
    try {
      for (const method of IMPERATIVE_METHODS) {
        expect(typeof asRecord[method]).toBe('function');
      }
    } finally {
      unmount(instance);
      target.remove();
    }
  });

  test('forwarded methods are callable after mount and a no-op after unmount', () => {
    const target = document.createElement('div');
    document.body.append(target);
    let conversation = createConversation({ id: 'conversation-imperative-stream' });
    conversation = appendAssistantMessage(conversation, '');
    const assistantId = conversation.ids[conversation.ids.length - 1]!;
    const instance = mount(Chat, {
      target,
      props: { id: 'chat-imperative-stream', conversation },
    });
    const api = instance as unknown as ChatImperative;

    // Callable after mount — drives the streaming buffer without throwing.
    expect(() => {
      api.beginStreaming(assistantId);
      api.pushToken('Hel');
      api.pushToken('lo');
      api.endStreaming();
      api.scrollToBottom();
      api.scrollToTop();
      api.focusInput();
    }).not.toThrow();

    // After unmount, the inner `impl` ref is gone; calls via the retained
    // reference must be safe no-ops (the `if (!impl) return;` guard), not throws.
    unmount(instance);
    target.remove();
    expect(() => {
      api.beginStreaming(assistantId);
      api.pushToken('late');
      api.endStreaming();
      api.scrollToBottom();
      api.scrollToTop();
      api.focusInput();
    }).not.toThrow();
  });

  test('forwarded scroll methods use the virtualized scroll path when enabled', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    let conversation = createConversation({ id: 'conversation-imperative-virtualized' });
    for (let index = 0; index < 40; index += 1) {
      conversation = appendAssistantMessage(conversation, `Virtualized message ${index}`);
    }
    const instance = mount(Chat, {
      target,
      props: {
        id: 'chat-imperative-virtualized',
        conversation,
        virtualized: true,
        virtualizationInitialHeight: 160,
        virtualizationEstimatedRowHeight: 40,
      },
    });
    const api = instance as unknown as ChatImperative;

    try {
      await waitFor(() =>
        expect(
          target.querySelector('.chat-timeline')?.hasAttribute('data-cinder-virtualized'),
        ).toBe(true),
      );
      expect(() => {
        api.scrollToBottom();
        api.scrollToTop();
      }).not.toThrow();
    } finally {
      unmount(instance);
      target.remove();
    }
  });
});

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
    const { resolve } = await import('node:path');
    // Absolute paths so the shared helper's dynamic import resolves them from
    // here, not relative to the helper's own module location.
    const threwMessage = await importWithoutDomGlobals([
      resolve(import.meta.dir, 'container', 'chat.svelte'),
      resolve(import.meta.dir, 'container', 'chat-history-trigger.svelte'),
      resolve(import.meta.dir, 'container', 'use-chat-keyboard-nav.svelte.ts'),
      resolve(import.meta.dir, 'container', 'use-chat-message-groups.svelte.ts'),
      resolve(import.meta.dir, 'container', 'use-chat-scroll-state.svelte.ts'),
      resolve(import.meta.dir, 'container', 'use-chat-virtualizer.svelte.ts'),
      resolve(import.meta.dir, 'container', 'use-chat-typing-indicator.svelte.ts'),
      resolve(import.meta.dir, 'container', 'use-chat-read-receipts.svelte.ts'),
    ]);
    expect(threwMessage).toBeUndefined();
  });

  test('virtualization is gated behind mount state for SSR/client parity', async () => {
    const { resolve } = await import('node:path');
    const source = await Bun.file(resolve(import.meta.dir, 'container', 'chat.svelte')).text();

    expect(source).toContain('let hasMounted = $state(false);');
    expect(source).not.toContain('onMount(() => {');
    expect(source).toContain('hasMounted = true;');
    expect(source).toContain(
      'const isVirtualized = $derived(virtualized && hasMounted && messages.length > 0);',
    );
  });
});

describe('Chat — bindable prop sync without write-back $effect', () => {
  test('chat.svelte does not use $effect to sync scrollState.atBottom to bindable atBottom', async () => {
    // Regression: the old code had three separate $effects that copied
    // scrollState.atBottom, unreadState.unreadCount, and
    // unreadState.newMessageIndicatorVisible into their corresponding bindable
    // props. These are replaced by explicit setters in the relevant callbacks.
    const { resolve } = await import('node:path');
    const source = await Bun.file(resolve(import.meta.dir, 'container', 'chat.svelte')).text();

    // The removed pattern: a standalone $effect block that assigns the bindable prop.
    expect(source).not.toContain('atBottom = scrollState.atBottom');
    expect(source).not.toContain('unreadCount = unreadState.unreadCount');
    expect(source).not.toContain(
      'newMessageIndicatorVisible = unreadState.newMessageIndicatorVisible',
    );

    // The replacement for the scroll event path: atBottom is set inside
    // handleScrollStateChange (at the mutation site).
    expect(source).toContain('atBottom = event.atBottom');

    // The replacement for the IntersectionObserver sentinel path: when the
    // sentinel fires onReachBottom (without emitting onScrollStateChange),
    // the bindable atBottom must be set to true explicitly.
    // This guards against regression from handleSentinelEntry bypassing
    // handleScrollStateChange.
    expect(source).toContain('atBottom = true');

    // The replacement: unreadCount and newMessageIndicatorVisible are set inside
    // the onUnreadIndicatorChange callback.
    expect(source).toContain('unreadCount = event.unreadCount');
    expect(source).toContain('newMessageIndicatorVisible = event.newMessageIndicatorVisible');
  });
});
