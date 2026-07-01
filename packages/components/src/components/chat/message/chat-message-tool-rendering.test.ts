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

  test('tool-call card is collapsed by default (arguments hidden)', () => {
    const message = toolCallMessage();
    const { container } = render(ChatMessage, {
      props: {
        message,
        toolCallPairs: [
          {
            call: message.toolCall!,
            result: { callId: 'call-1', outcome: 'success', content: { ok: true } },
          },
        ],
      },
    });
    // The card and its header render, but the disclosed details region does not
    // until the card is expanded — so a large payload never dominates the
    // transcript on first render.
    expect(container.querySelector('.tool-call-group')).not.toBeNull();
    expect(container.querySelector('.tool-call-details')).toBeNull();
    expect(container.textContent).not.toContain('Arguments');
    const header = container.querySelector('.tool-call-header');
    expect(header?.getAttribute('aria-expanded')).toBe('false');
  });

  test('tool-call disclosure is decoupled from markdown truncation (long text stays full)', () => {
    // A long assistant message keeps its full markdown body by default even
    // though tool-call cards default to collapsed — the two disclosures are
    // independent. `expanded` (markdown "Show more/less") still defaults true.
    const longText = 'x'.repeat(2000);
    const message: Message = {
      id: 'assistant-1',
      role: 'assistant',
      content: longText,
      position: 0,
      createdAt: '2026-06-02T00:00:00.000Z',
      metadata: {},
      hidden: false,
    };
    const { container } = render(ChatMessage, { props: { message } });
    expect(container.textContent).toContain(longText);
    // The collapse control offers "Show less" (i.e. currently expanded), not
    // "Show more" — markdown truncation was untouched by the tool-call change.
    const control = container.querySelector('.chat-message-expand');
    expect(control?.textContent?.trim()).toBe('Show less');
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
