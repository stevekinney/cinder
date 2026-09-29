import { describe, expect, test } from 'bun:test';
import { expectRejected } from './stream-event-codec-test-helpers.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { decodeChatStreamEvents } from './stream-event-codec.ts';

async function* bareChunks(): AsyncGenerator<string> {
  yield JSON.stringify({ type: 'text', text: 'hi' });
}

const frame = (sequence: number, extra: Record<string, unknown>): string =>
  JSON.stringify({ wireVersion: 1, sequence, ...extra });

describe('versioned streams must be newline-framed', () => {
  test('rejects a versioned stream cut immediately after a terminal frame', async () => {
    // The leftover parses cleanly and the terminal-frame guard is satisfied,
    // so only the missing newline distinguishes a complete response from a
    // severed one.
    const terminal = frame(1, {
      type: 'run.aborted',
      reason: 'stopped',
    });

    async function* chunks(): AsyncGenerator<string> {
      yield terminal; // deliberately no trailing newline
    }

    const collect = async (): Promise<void> => {
      for await (const event of decodeChatStreamEvents(chunks())) {
        void event;
        // Drain.
      }
    };

    await expectRejected(collect(), /ended mid-frame without a newline/);
  });

  test('accepts the same stream when the terminal frame is newline-framed', async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield `${frame(1, { type: 'run.aborted', reason: 'stopped' })}\n`;
    }

    const seen: ChatStreamEvent[] = [];
    for await (const event of decodeChatStreamEvents(chunks())) seen.push(event);
    expect(seen).toHaveLength(1);
  });

  test('still accepts a bare legacy frame without a trailing newline', async () => {
    const seen: ChatStreamEvent[] = [];
    for await (const event of decodeChatStreamEvents(bareChunks())) seen.push(event);
    expect(seen).toEqual([{ type: 'text', text: 'hi' }]);
  });
});
