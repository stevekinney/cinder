/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class TestIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: readonly number[] = [];
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    void _callback;
    void _options;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const originalResizeObserver = globalThis.ResizeObserver;
const originalIntersectionObserver = globalThis.IntersectionObserver;
globalThis.ResizeObserver = TestResizeObserver;
globalThis.IntersectionObserver = TestIntersectionObserver;
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: Chat } = await import('./chat.svelte');

type Conversation = import('./conversation-model.ts').ConversationHistory;
type Message = import('./conversation-model.ts').Message;
type ToolResult = import('./conversation-model.ts').ToolResult;
type ChatInstance = { announce(message: string, level?: 'polite' | 'assertive'): void };

function hasAnnounce(value: unknown): value is ChatInstance {
  return (
    typeof value === 'object' &&
    value !== null &&
    'announce' in value &&
    typeof value.announce === 'function'
  );
}

let sequence = 0;

function conversation(id: string, messages: Message[] = []): Conversation {
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    id,
    status: 'active',
    metadata: {},
    ids: messages.map((message) => message.id),
    messages: Object.fromEntries(messages.map((message) => [message.id, message])),
    createdAt: now,
    updatedAt: now,
  };
}

function toolMessage(
  role: 'tool-call' | 'tool-result',
  callId: string,
  name: string,
  outcome?: ToolResult['outcome'],
  messageId?: string,
): Message {
  const id = messageId ?? `message-${++sequence}`;
  const now = new Date().toISOString();
  const base = {
    id,
    content: '',
    position: sequence,
    createdAt: now,
    metadata: {},
    hidden: false,
  };
  if (role === 'tool-call') {
    return { ...base, role, toolCall: { id: callId, name, arguments: {} } };
  }
  return { ...base, role, toolResult: { callId, outcome: outcome ?? 'success', content: null } };
}

function region(container: HTMLElement, level: 'polite' | 'assertive'): HTMLElement {
  const log = container.querySelector<HTMLElement>('[role="log"][aria-describedby]');
  const statusId = log?.getAttribute('aria-describedby');
  const status = statusId ? container.querySelector<HTMLElement>(`#${CSS.escape(statusId)}`) : null;
  const polite = status?.nextElementSibling;
  const assertive = polite?.nextElementSibling;
  const result = level === 'polite' ? polite : assertive;
  if (!(result instanceof HTMLElement)) {
    throw new Error(`Missing ${level} ChatStatusAnnouncer region`);
  }
  expect(result.getAttribute('aria-live')).toBe(level);
  expect(result.getAttribute('aria-atomic')).toBe('true');
  return result;
}

function renderChat(current: Conversation, onApprovalResolve?: (id: string) => void) {
  return render(Chat, {
    props: {
      id: `chat-${current.id}`,
      conversation: current,
      ...(onApprovalResolve ? { onApprovalResolve } : {}),
    },
  });
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('Chat announcement lifecycle', () => {
  test('suppresses first observation, then announces success and error transitions', async () => {
    const pending = toolMessage('tool-call', 'call-status', 'lookup');
    const initial = conversation('status-transitions', [pending]);
    const view = renderChat(initial);
    await tick();
    const polite = region(view.container, 'polite');
    expect(polite.textContent).toBe('');

    const success = toolMessage('tool-result', 'call-status', 'lookup', 'success');
    view.rerender({ conversation: conversation(initial.id, [pending, success]) });
    await tick();
    expect(polite.textContent).toBe('lookup complete');

    const failure = toolMessage('tool-result', 'call-status', 'lookup', 'error');
    view.rerender({ conversation: conversation(initial.id, [pending, failure]) });
    await tick();
    expect(polite.textContent).toBe('lookup failed');
  });

  test('joins visible transitions and suppresses action_required', async () => {
    const first = toolMessage('tool-call', 'first', 'first');
    const second = toolMessage('tool-call', 'duplicate', 'second');
    const third = toolMessage('tool-call', 'other', 'third');
    const initial = conversation('joined-statuses', [first, second, third]);
    const view = renderChat(initial);
    await tick();
    const polite = region(view.container, 'polite');

    const firstResult = toolMessage('tool-result', 'first', 'first', 'success');
    const secondResult = toolMessage('tool-result', 'duplicate', 'second', 'action_required');
    const thirdResult = toolMessage('tool-result', 'other', 'third', 'error');
    view.rerender({
      conversation: conversation(initial.id, [
        first,
        second,
        third,
        firstResult,
        secondResult,
        thirdResult,
      ]),
    });
    await tick();
    expect(polite.textContent).toBe('first complete. third failed');
  });

  test('attaches a duplicate call result to the latest visible occurrence', async () => {
    const first = toolMessage('tool-call', 'duplicate', 'first');
    const second = toolMessage('tool-call', 'duplicate', 'second');
    const initial = conversation('duplicate-statuses', [first, second]);
    const view = renderChat(initial);
    await tick();
    const polite = region(view.container, 'polite');

    const result = toolMessage('tool-result', 'duplicate', 'second', 'success');
    view.rerender({ conversation: conversation(initial.id, [first, second, result]) });
    await tick();
    expect(polite.textContent).toBe('second complete');
    expect(polite.textContent).not.toContain('first complete');
  });

  test('resets status observation when conversation identity changes', async () => {
    const first = toolMessage('tool-call', 'same-call', 'old', undefined, 'shared-call');
    const firstResult = toolMessage('tool-result', 'same-call', 'old', 'success');
    const view = renderChat(conversation('old-conversation', [first, firstResult]));
    await tick();
    const polite = region(view.container, 'polite');
    const nextCall = toolMessage('tool-call', 'same-call', 'new', undefined, 'shared-call');
    const nextResult = toolMessage('tool-result', 'same-call', 'new', 'error');
    const next = conversation('new-conversation', [nextCall, nextResult]);
    view.rerender({ conversation: next });
    await tick();
    expect(polite.textContent).toBe('');
    view.rerender({
      conversation: conversation(next.id, [nextCall]),
    });
    await tick();
    view.rerender({
      conversation: conversation(next.id, [
        nextCall,
        toolMessage('tool-result', 'same-call', 'new', 'success'),
      ]),
    });
    await tick();
    expect(polite.textContent).toBe('new complete');
  });

  test('updates approval suppression and keeps detached announce callable', async () => {
    const call = toolMessage('tool-call', 'approval', 'deploy');
    const result = toolMessage('tool-result', 'approval', 'deploy', 'action_required');
    result.toolResult = {
      callId: 'approval',
      outcome: 'action_required',
      content: null,
      action: {
        type: 'approval',
        message: 'Deploy now?',
        risk: 'high',
        operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
        policyVersion: 'test-policy',
        idempotencyKey: 'test-approval',
      },
    };
    const approved: string[] = [];
    const view = renderChat(conversation('approval-status', [call, result]), (id) => {
      approved.push(id);
    });
    await tick();
    const assertive = region(view.container, 'assertive');
    expect(assertive.textContent).toContain('Deploy now?');
    await fireEvent.click(view.getByRole('button', { name: 'Approve' }));
    await tick();
    expect(approved).toEqual(['approval']);

    const instance: unknown = view.component;
    if (!hasAnnounce(instance)) throw new Error('Chat instance is missing announce');
    const announce = instance.announce;
    expect(Object.hasOwn(instance, 'announce')).toBe(true);
    announce('Detached status', 'assertive');
    await tick();
    expect(assertive.textContent).toBe('Detached status');
  });
});
