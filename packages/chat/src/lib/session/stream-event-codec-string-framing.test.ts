import { describe, expect, test } from 'bun:test';
import { expectRejected } from './stream-event-codec-test-helpers.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { decodeChatStreamEvents } from './stream-event-codec.ts';

async function* unterminatedChunks(): AsyncGenerator<string> {
  yield `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'a' })}\n`;
  yield JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' });
}

describe('framing is enforced identically for string and streamed sources', () => {
  const terminal = JSON.stringify({
    wireVersion: 1,
    sequence: 1,
    type: 'run.aborted',
    reason: 'stopped',
  });

  test('a string source missing its final newline is rejected', async () => {
    const collect = async (): Promise<void> => {
      for await (const event of decodeChatStreamEvents(terminal)) {
        void event;
        // Drain.
      }
    };
    await expectRejected(collect(), /ended mid-frame without a newline/);
  });

  test('the same string source is accepted when newline-framed', async () => {
    const seen: ChatStreamEvent[] = [];
    for await (const event of decodeChatStreamEvents(`${terminal}\n`)) seen.push(event);
    expect(seen).toHaveLength(1);
  });

  test('an unterminated leftover is never yielded before framing is judged', async () => {
    const seen: ChatStreamEvent[] = [];
    await expectRejected(
      (async () => {
        for await (const event of decodeChatStreamEvents(unterminatedChunks())) seen.push(event);
      })(),
      /ended mid-frame without a newline/,
    );

    // The complete first frame is delivered; the truncated second is not.
    expect(seen).toHaveLength(1);
  });
});
