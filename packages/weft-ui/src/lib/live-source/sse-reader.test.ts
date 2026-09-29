import { describe, expect, test } from 'bun:test';

import { parseServerSentEventChunk, readServerSentEventStream } from './sse-reader.ts';

describe('parseServerSentEventChunk', () => {
  test('parses a single complete frame with id/event/data', () => {
    const { frames, remainder } = parseServerSentEventChunk(
      'id: 5\nevent: workflow:completed\ndata: {"ok":true}\n\n',
    );
    expect(frames).toEqual([{ id: '5', event: 'workflow:completed', data: '{"ok":true}' }]);
    expect(remainder).toBe('');
  });

  test('joins multi-line data fields with \\n', () => {
    const { frames } = parseServerSentEventChunk('data: line one\ndata: line two\n\n');
    expect(frames).toEqual([{ data: 'line one\nline two' }]);
  });

  test('carries an incomplete trailing block forward as the remainder', () => {
    const first = parseServerSentEventChunk('event: ping\ndata: {"a":1');
    expect(first.frames).toEqual([]);
    expect(first.remainder).toBe('event: ping\ndata: {"a":1');

    const second = parseServerSentEventChunk('}\n\n', first.remainder);
    expect(second.frames).toEqual([{ event: 'ping', data: '{"a":1}' }]);
    expect(second.remainder).toBe('');
  });

  test('ignores comment lines and normalizes CRLF', () => {
    const { frames } = parseServerSentEventChunk(':heartbeat\r\ndata: hi\r\n\r\n');
    expect(frames).toEqual([{ data: 'hi' }]);
  });

  test('parses multiple frames in one chunk', () => {
    const { frames } = parseServerSentEventChunk('data: one\n\ndata: two\n\n');
    expect(frames).toEqual([{ data: 'one' }, { data: 'two' }]);
  });

  test('skips an empty block (no id/event/data)', () => {
    const { frames } = parseServerSentEventChunk('\n\ndata: real\n\n');
    expect(frames).toEqual([{ data: 'real' }]);
  });
});

function streamResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body);
}

describe('readServerSentEventStream', () => {
  test('yields frames split arbitrarily across chunk boundaries', async () => {
    const response = streamResponse(['event: a\ndata: 1\n\nev', 'ent: b\ndata: 2\n\n']);
    const frames = [];
    for await (const frame of readServerSentEventStream(response)) frames.push(frame);
    expect(frames).toEqual([
      { event: 'a', data: '1' },
      { event: 'b', data: '2' },
    ]);
  });

  test('stops immediately when the body is null', async () => {
    const response = new Response(null);
    const frames = [];
    for await (const frame of readServerSentEventStream(response)) frames.push(frame);
    expect(frames).toEqual([]);
  });

  test('stops when the signal is already aborted', async () => {
    const response = streamResponse(['data: never-seen\n\n']);
    const controller = new AbortController();
    controller.abort();
    const frames = [];
    for await (const frame of readServerSentEventStream(response, controller.signal)) {
      frames.push(frame);
    }
    expect(frames).toEqual([]);
  });

  test('stops mid-stream once the signal aborts, without reading further frames', async () => {
    const response = streamResponse(['data: one\n\ndata: two\n\ndata: three\n\n']);
    const controller = new AbortController();
    const frames = [];
    for await (const frame of readServerSentEventStream(response, controller.signal)) {
      frames.push(frame);
      if (frame.data === 'one') controller.abort();
    }
    expect(frames).toEqual([{ data: 'one' }]);
  });
});
