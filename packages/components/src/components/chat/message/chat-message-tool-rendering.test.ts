/**
 * Regression guards for how `ChatMessage` renders tool-call messages through
 * the parts spine. The contract that matters: a tool-call message renders a
 * `ToolCallGroup` card ONLY when a resolved pair is supplied (mirroring the
 * original `isToolCall && toolPair` guard). A standalone `<ChatMessage>` given
 * an empty `toolCallPairs` must fall through to the plain text body — NOT a
 * pending card — exactly as before the parts refactor.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import type { Message } from '../conversation-model.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: ChatMessage } = await import('./chat-message.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function toolCallMessage(): Message {
  return {
    id: 'tc-1',
    role: 'tool-call',
    content: 'raw tool-call text body',
    position: 0,
    createdAt: '2026-06-02T00:00:00.000Z',
    metadata: {},
    hidden: false,
    toolCall: { id: 'call-1', name: 'lookup', arguments: {} },
  };
}

describe('ChatMessage — tool-call rendering', () => {
  test('renders the ToolCallGroup card when a resolved pair is supplied', () => {
    const message = toolCallMessage();
    const { container } = render(ChatMessage, {
      props: {
        message,
        toolCallPairs: [{ call: message.toolCall! }],
      },
    });
    expect(container.querySelector('.tool-call-group')).not.toBeNull();
    expect(container.textContent).toContain('lookup');
  });

  test('falls through to the text body when no pair is supplied (regression guard)', () => {
    const message = toolCallMessage();
    const { container } = render(ChatMessage, {
      props: { message, toolCallPairs: [] },
    });
    // No card — the original behavior for an unpaired tool-call message was the
    // plain text body, not a pending ToolCallGroup.
    expect(container.querySelector('.tool-call-group')).toBeNull();
    expect(container.querySelector('.message-content')).not.toBeNull();
    expect(container.textContent).toContain('raw tool-call text body');
  });
});
