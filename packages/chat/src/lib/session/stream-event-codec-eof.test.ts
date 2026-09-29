import { describe, test } from 'bun:test';
import { createConversationHistory } from 'conversationalist';
import { expectRejected } from './stream-event-codec-test-helpers.ts';
import { decodeChatStreamEvents } from './stream-event-codec.ts';

describe('decoder byte handling at EOF', () => {
  test('rejects a stream truncated mid-multibyte after a terminal frame', async () => {
    // The terminal frame and its newline are complete, so the guard is
    // satisfied — but the stream then ends partway through a multibyte
    // character. Those bytes sit inside TextDecoder, not in the line buffer,
    // so without a final flush the truncation is invisible and the stream is
    // accepted as a clean, complete response.
    const terminal = `${JSON.stringify({
      type: 'run.completed',
      conversation: createConversationHistory({ id: 'c1' }),
      content: 'done',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop',
      wireVersion: 1,
      sequence: 1,
    })}\n`;

    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield new TextEncoder().encode(terminal);
      // First two bytes of a three-byte UTF-8 sequence (U+20AC EURO SIGN).
      yield new Uint8Array([0xe2, 0x82]);
    }

    const collect = async (): Promise<void> => {
      for await (const event of decodeChatStreamEvents(chunks())) {
        void event;
        // Drain; the failure is expected at EOF, after the terminal frame.
      }
    };

    // The retained bytes surface as a replacement character, which is not
    // valid JSON — the point is that EOF is rejected rather than silently
    // accepted as a clean, complete stream.
    await expectRejected(collect());
  });
});
