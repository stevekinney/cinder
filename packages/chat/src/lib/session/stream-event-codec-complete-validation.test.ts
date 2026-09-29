import { describe, expect, test } from 'bun:test';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { encodeChatStreamEvent } from './stream-event-codec.ts';

const stateEvent = (overrides: Record<string, unknown>): ChatStreamEvent =>
  hostileEvent({
    type: 'stream:complete',
    state: { blocks: [], textContent: 'hi', toolCalls: [], complete: true, ...overrides },
    wireVersion: 1,
    sequence: 0,
  });

describe('encoder validates stream:complete scalar fields', () => {
  test('rejects an undefined textContent', () => {
    expect(() => encodeChatStreamEvent(stateEvent({ textContent: undefined }))).toThrow(
      'Invalid chat stream event: state.textContent must be a string',
    );
  });

  test('rejects a non-boolean complete', () => {
    expect(() => encodeChatStreamEvent(stateEvent({ complete: 'yes' }))).toThrow(
      'Invalid chat stream event: state.complete must be a boolean',
    );
  });
});
