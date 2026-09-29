import { describe, expect, test } from 'bun:test';
import { expectRejected } from './stream-event-codec-test-helpers.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { decodeChatStreamEvents } from './stream-event-codec.ts';

describe('framing on the ReadableStream path', () => {
  // The byte-stream branch has its own EOF handling, so the same guarantee
  // needs its own coverage — an async iterable exercises different code.
  const encoder = new TextEncoder();
  const readableOf = (parts: string[]): ReadableStream<Uint8Array> =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      },
    });

  test('rejects an unterminated leftover and does not yield it', async () => {
    const complete = `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'a' })}\n`;
    const truncated = JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' });

    const seen: ChatStreamEvent[] = [];
    await expectRejected(
      (async () => {
        for await (const event of decodeChatStreamEvents(readableOf([complete, truncated])))
          seen.push(event);
      })(),
      /ended mid-frame without a newline/,
    );

    expect(seen).toHaveLength(1);
  });

  test('accepts the same stream when the final frame is newline-framed', async () => {
    const complete = `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'a' })}\n`;
    const terminal = `${JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' })}\n`;

    const seen: ChatStreamEvent[] = [];
    for await (const event of decodeChatStreamEvents(readableOf([complete, terminal])))
      seen.push(event);
    expect(seen).toHaveLength(2);
  });
});
