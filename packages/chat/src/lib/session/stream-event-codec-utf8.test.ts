import { describe, test } from 'bun:test';
import { expectRejected } from './stream-event-codec-test-helpers.ts';
import { decodeChatStreamEvents } from './stream-event-codec.ts';

describe('decoder rejects invalid UTF-8 instead of replacing bytes', () => {
  const encoder = new TextEncoder();
  const corrupt = (): Uint8Array[] => {
    const frame = encoder.encode(
      `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'ab' })}\n`,
    );
    // Replace the `a` inside the quoted payload with a lone continuation byte.
    const corrupted = new Uint8Array(frame);
    corrupted[frame.indexOf(0x61)] = 0x80;
    const terminal = encoder.encode(
      `${JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' })}\n`,
    );
    return [corrupted, terminal];
  };

  test('on the async-iterable path', async () => {
    async function* chunks(): AsyncGenerator<Uint8Array> {
      for (const chunk of corrupt()) yield chunk;
    }
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(chunks())),
      'Invalid chat stream event: response bytes are not valid UTF-8',
    );
  });

  test('on the ReadableStream path', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of corrupt()) controller.enqueue(chunk);
        controller.close();
      },
    });
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(stream)),
      'Invalid chat stream event: response bytes are not valid UTF-8',
    );
  });

  test('a stream cut mid-multibyte sequence is rejected at EOF', async () => {
    const euro = encoder.encode('€'); // three bytes
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield encoder.encode(
        `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'run.aborted' })}\n`,
      );
      yield euro.slice(0, 2);
    }
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(chunks())),
      'Invalid chat stream event',
    );
  });
});
