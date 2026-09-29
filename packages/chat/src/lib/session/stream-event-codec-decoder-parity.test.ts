import { describe, expect, test } from 'bun:test';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import { encodeChatStreamEvent } from './stream-event-codec.ts';

describe('encoder mirrors every decoder guard', () => {
  const envelope = { wireVersion: 1 as const, sequence: 1 };
  const block = { id: 'b1', type: 'text', index: 0, content: 'hi', complete: false };

  test('rejects a tool result the decoder would refuse', () => {
    const event = hostileEvent({
      type: 'tool_result',
      callId: 42,
      outcome: 'success',
      content: null,
    });

    expect(() => encodeChatStreamEvent(event)).toThrow(/not a valid ChatToolResult/);
  });

  test('reports the specific nested failure rather than a generic shape error', () => {
    // The structural guard runs last precisely so this message survives.
    const event = hostileEvent({
      type: 'tool_result',
      callId: 'c1',
      outcome: 'success',
      content: { value: Number.POSITIVE_INFINITY },
    });

    expect(() => encodeChatStreamEvent(event)).toThrow(/tool result content/);
  });

  test('rejects block fields the decoder would refuse', () => {
    const badType = hostileEvent({
      type: 'stream:block-start',
      block: { ...block, type: 'hologram' },
      ...envelope,
    });
    const badComplete = hostileEvent({
      type: 'stream:block-start',
      block: { ...block, complete: 'yes' },
      ...envelope,
    });

    expect(() => encodeChatStreamEvent(badType)).toThrow(/unsupported block type hologram/);
    expect(() => encodeChatStreamEvent(badComplete)).toThrow(/block.complete must be a boolean/);
  });

  test('rejects sparse block arrays instead of serializing their holes as null', () => {
    // A sparse array is assignable to a block array but has no element
    // for `.map` to visit; `JSON.stringify` would turn the hole into `null`
    // and the decoder would then refuse the frame the encoder just produced.
    // Built by assigning `length` and by skipping an index, because the
    // literal forms (`new Array(n)`, `[a, , b]`) are lint errors — which is
    // the point: production code cannot write one on purpose, so this guards
    // runtime casts, not authored literals.
    const holes: Array<typeof block> = [];
    holes.length = 1;
    const middleHole: Array<typeof block> = [];
    middleHole[0] = block;
    middleHole[2] = block;
    const sparseBlocks = hostileEvent({
      type: 'stream:complete',
      state: { blocks: holes, textContent: '', toolCalls: [], complete: true },
      ...envelope,
    });
    const sparseToolCalls = hostileEvent({
      type: 'stream:complete',
      state: { blocks: [], textContent: '', toolCalls: middleHole, complete: true },
      ...envelope,
    });

    expect(() => encodeChatStreamEvent(sparseBlocks)).toThrow(/state.blocks\[0\] is missing/);
    expect(() => encodeChatStreamEvent(sparseToolCalls)).toThrow(/state.toolCalls\[1\] is missing/);
  });

  test('rejects a non-array block collection instead of projecting it to []', () => {
    // `{}` has no `length`, so a plain index loop runs zero times and would
    // emit `blocks: []` — a well-formed frame that says something the caller
    // never sent. The decoder already requires a real array; the encoder
    // has to as well.
    const objectBlocks = hostileEvent({
      type: 'stream:complete',
      state: { blocks: {}, textContent: '', toolCalls: [], complete: true },
      ...envelope,
    });
    const stringToolCalls = hostileEvent({
      type: 'stream:complete',
      state: { blocks: [], textContent: '', toolCalls: 'none', complete: true },
      ...envelope,
    });
    const arrayLikeBlocks = hostileEvent({
      type: 'stream:complete',
      state: { blocks: { length: 0 }, textContent: '', toolCalls: [], complete: true },
      ...envelope,
    });

    expect(() => encodeChatStreamEvent(objectBlocks)).toThrow(/state.blocks is not an array/);
    expect(() => encodeChatStreamEvent(stringToolCalls)).toThrow(/state.toolCalls is not an array/);
    expect(() => encodeChatStreamEvent(arrayLikeBlocks)).toThrow(/state.blocks is not an array/);
  });
});
