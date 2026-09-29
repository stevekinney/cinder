import { describe, expect, test } from 'bun:test';
import { expectRejected } from './stream-event-codec-test-helpers.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { decodeChatStreamEvents } from './stream-event-codec.ts';

const text = (sequence: number): string =>
  JSON.stringify({ wireVersion: 1, sequence, type: 'text', text: 'late' });
const terminal = JSON.stringify({ wireVersion: 1, sequence: 1, type: 'run.aborted' });

// A consumer that stops on the terminal frame calls the generator's
// `return()`, so anything decoded lazily after it is never seen.
const consumeUntilTerminal = async (
  stream: AsyncIterable<ChatStreamEvent>,
): Promise<ChatStreamEvent[]> => {
  const seen: ChatStreamEvent[] = [];
  for await (const event of stream) {
    seen.push(event);
    if (event.type === 'run.aborted') break;
  }
  return seen;
};

describe('frames buffered after a terminal frame are rejected before it is yielded', () => {
  test('a string source rejects a complete line following the terminal frame', async () => {
    await expectRejected(
      consumeUntilTerminal(decodeChatStreamEvents(`${terminal}\n${text(2)}\n`)),
      'Invalid chat stream event: frame arrived after the terminal frame',
    );
  });

  test('a string source rejects a partial fragment following the terminal frame', async () => {
    await expectRejected(
      consumeUntilTerminal(decodeChatStreamEvents(`${terminal}\n${text(2)}`)),
      /ended mid-frame without a newline/,
    );
  });

  test('a chunked source rejects a complete line following the terminal frame in the same chunk', async () => {
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield new TextEncoder().encode(`${terminal}\n${text(2)}\n`);
    }
    await expectRejected(
      consumeUntilTerminal(decodeChatStreamEvents(chunks())),
      'Invalid chat stream event: frame arrived after the terminal frame',
    );
  });

  test('a chunked source rejects partial bytes following the terminal frame in the same chunk', async () => {
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield new TextEncoder().encode(`${terminal}\n${text(2)}`);
    }
    await expectRejected(
      consumeUntilTerminal(decodeChatStreamEvents(chunks())),
      'Invalid chat stream event: frame arrived after the terminal frame',
    );
  });

  test('a chunked source rejects retained multibyte bytes following the terminal frame', async () => {
    // The trailing bytes are the start of a multibyte sequence, so TextDecoder
    // retains them instead of surfacing them in the line buffer. A consumer
    // stopping on the terminal frame never reaches EOF, so the residue has
    // to be checked before the terminal is yielded.
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield new Uint8Array([...new TextEncoder().encode(`${terminal}\n`), 0xe2, 0x82]);
    }
    await expectRejected(
      consumeUntilTerminal(decodeChatStreamEvents(chunks())),
      /Invalid chat stream event/,
    );
  });

  test('a string chunk arriving while bytes are pending rejects rather than reordering text', async () => {
    // The byte chunk ends inside '€' (0xe2 0x82 0xac). Appending the string
    // first and completing the character afterwards would move the 0xac
    // tail behind the string, so the pending bytes are flushed (and fail the
    // fatal decode) before the string is accepted.
    const encoded = new TextEncoder().encode(
      `${JSON.stringify({ wireVersion: 1, sequence: 0, type: 'text', text: '€' })}\n`,
    );
    const split = encoded.indexOf(0xe2) + 1;
    async function* chunks(): AsyncGenerator<string | Uint8Array> {
      yield encoded.slice(0, split);
      yield new TextDecoder().decode(encoded.slice(split + 2));
      yield encoded.slice(split, split + 2);
      yield `${terminal}\n`;
    }
    await expectRejected(
      consumeUntilTerminal(decodeChatStreamEvents(chunks())),
      'Invalid chat stream event: response bytes are not valid UTF-8',
    );
  });

  test('a multibyte character split across chunks before the terminal still decodes', async () => {
    const encoded = new TextEncoder().encode(
      `${JSON.stringify({ wireVersion: 1, sequence: 0, type: 'text', text: '€' })}\n${terminal}\n`,
    );
    const split = encoded.indexOf(0xe2) + 1;
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield encoded.slice(0, split);
      yield encoded.slice(split);
    }
    const seen = await consumeUntilTerminal(decodeChatStreamEvents(chunks()));
    expect(seen.map((event) => event.type)).toEqual(['text', 'run.aborted']);
  });

  test('a clean terminal frame is still yielded to a consumer that stops on it', async () => {
    const seen = await consumeUntilTerminal(decodeChatStreamEvents(`${text(0)}\n${terminal}\n`));
    expect(seen.map((event) => event.type)).toEqual(['text', 'run.aborted']);
  });
});
