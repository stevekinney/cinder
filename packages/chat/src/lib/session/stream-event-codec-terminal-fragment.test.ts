import { describe, expect, test } from 'bun:test';
import { expectRejected } from './stream-event-codec-test-helpers.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { decodeChatStreamEvents } from './stream-event-codec.ts';

describe('string sources validate the final fragment before yielding it', () => {
  test('an unterminated terminal frame is never yielded, even if the consumer stops early', async () => {
    const source = `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'a' })}\n${JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' })}`;

    const seen: ChatStreamEvent[] = [];
    await expectRejected(
      (async () => {
        for await (const event of decodeChatStreamEvents(source)) {
          seen.push(event);
          // A consumer that stops on the first terminal frame it sees.
          if (event.type === 'run.aborted') break;
        }
      })(),
      /ended mid-frame without a newline/,
    );

    expect(seen).toHaveLength(1);
  });
});
