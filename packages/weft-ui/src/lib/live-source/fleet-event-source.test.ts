import { waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { installFetchImplementation } from './fetch-test-support.ts';
import { FleetEventSource, type FleetEventFrame } from './fleet-event-source.svelte.ts';

interface FetchCall {
  readonly url: string;
  readonly headers: Record<string, string>;
}

type ResponseFactory = (signal: AbortSignal | undefined) => Response;

/** Scripts `globalThis.fetch` with a queue of responses and records every call's URL/headers, so tests can assert exactly what `FleetEventSource` requested. */
class ScriptedFetch {
  readonly calls: FetchCall[] = [];
  readonly #responses: ResponseFactory[] = [];
  #restoreFetch: () => void;

  constructor() {
    this.#restoreFetch = installFetchImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      this.calls.push({ url, headers });
      const factory = this.#responses.shift();
      if (factory === undefined) throw new Error('ScriptedFetch: no more responses queued');
      return factory(init?.signal ?? undefined);
    });
  }

  enqueue(factory: ResponseFactory): void {
    this.#responses.push(factory);
  }

  restore(): void {
    this.#restoreFetch();
  }
}

/** A live, test-controlled `text/event-stream` response — closes/errors its stream when `signal` aborts, mirroring real `fetch()` abort behavior. */
function controllableSseResponse(signal: AbortSignal | undefined): {
  response: Response;
  push: (chunk: string) => void;
} {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      signal?.addEventListener(
        'abort',
        () => {
          try {
            controller.close();
          } catch {
            // Already closed/errored.
          }
        },
        { once: true },
      );
    },
  });
  return {
    response: new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    push: (chunk: string) => streamController?.enqueue(encoder.encode(chunk)),
  };
}

function finiteSseResponse(chunks: readonly string[]): ResponseFactory {
  return () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  };
}

/**
 * A `controllableSseResponse` pre-loaded with `chunks` and left OPEN (never
 * closes on its own — only on abort). Fleet SSE connections are meant to
 * stay open indefinitely; `FleetEventSource` reconnects unconditionally on
 * ANY stream end, even a clean one (there is no fleet-level "I'm done, stop
 * reconnecting" signal the way a per-workflow tail has terminal events).
 * Tests that just want steady-state delivery — not to specifically exercise
 * the reconnect path — should enqueue this, not `finiteSseResponse`, or the
 * connection will immediately try to reconnect once the response is drained
 * and spin against `ScriptedFetch`'s empty queue.
 */
function openSseResponse(chunks: readonly string[]): ResponseFactory {
  return (signal) => {
    const controllable = controllableSseResponse(signal);
    for (const chunk of chunks) controllable.push(chunk);
    return controllable.response;
  };
}

function envelopeChunk(envelope: Omit<FleetEventFrame, never>): string {
  return `id: ${envelope.cursor}\nevent: ${envelope.kind}\ndata: ${JSON.stringify(envelope)}\n\n`;
}

function pingChunk(replayComplete = false): string {
  return `event: ping\ndata: ${JSON.stringify({ emittedAtMs: 0, replayComplete })}\n\n`;
}

let scripted: ScriptedFetch;

afterEach(() => {
  scripted.restore();
});

describe('FleetEventSource', () => {
  test('opens the connection lazily — no fetch before the first subscribe', () => {
    scripted = new ScriptedFetch();
    const source = new FleetEventSource({ baseUrl: '' });
    expect(scripted.calls).toEqual([]);
    expect(source.status).toBe('closed');
    source.close();
  });

  test('subscribe opens the connection and delivers frames matching the ping/envelope wire format', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueue(
      openSseResponse([
        pingChunk(true),
        envelopeChunk({
          kind: 'workflow:completed',
          workflowId: 'wf_1',
          sequence: 1,
          cursor: '1',
          emittedAtMs: 100,
          payload: { ok: true },
        }),
      ]),
    );

    const source = new FleetEventSource({ baseUrl: '' });
    const received: FleetEventFrame[] = [];
    source.subscribe((frame) => received.push(frame));

    await source.whenConnected();
    await waitFor(() => {
      expect(received).toHaveLength(1);
    });
    expect(received[0]).toEqual({
      kind: 'workflow:completed',
      workflowId: 'wf_1',
      sequence: 1,
      cursor: '1',
      emittedAtMs: 100,
      payload: { ok: true },
    });
    expect(scripted.calls).toHaveLength(1);
    expect(scripted.calls[0]?.url).toBe('/v1/events/sse');
    expect(scripted.calls[0]?.headers['accept']).toBe('text/event-stream');
    source.close();
  });

  test('status is connecting synchronously after subscribe, closed after the last unsubscribe', () => {
    scripted = new ScriptedFetch();
    scripted.enqueue((signal) => controllableSseResponse(signal).response);

    const source = new FleetEventSource({ baseUrl: '' });
    const unsubscribe = source.subscribe(() => {});
    // Read synchronously, before the scripted fetch promise has a chance to settle.
    expect(source.status).toBe('connecting');

    unsubscribe();
    expect(source.status).toBe('closed');
    source.close();
  });

  test('one connection fans out to many subscribers, filtered independently per subscriber', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueue(
      openSseResponse([
        pingChunk(true),
        envelopeChunk({
          kind: 'workflow:completed',
          workflowId: 'wf_1',
          sequence: 1,
          cursor: '1',
          emittedAtMs: 100,
          payload: {},
        }),
        envelopeChunk({
          kind: 'schedule:fired',
          sequence: 2,
          cursor: '2',
          emittedAtMs: 200,
          payload: {},
        }),
      ]),
    );

    const source = new FleetEventSource({ baseUrl: '' });
    const workflowOnly: FleetEventFrame[] = [];
    const scheduleOnly: FleetEventFrame[] = [];
    const everything: FleetEventFrame[] = [];
    source.subscribe((frame) => workflowOnly.push(frame), { kind: 'workflow:completed' });
    source.subscribe((frame) => scheduleOnly.push(frame), { kind: 'schedule:fired' });
    source.subscribe((frame) => everything.push(frame));

    await waitFor(() => {
      expect(everything).toHaveLength(2);
    });
    expect(workflowOnly).toHaveLength(1);
    expect(workflowOnly[0]?.kind).toBe('workflow:completed');
    expect(scheduleOnly).toHaveLength(1);
    expect(scheduleOnly[0]?.kind).toBe('schedule:fired');
    // Exactly one shared connection for three subscribers.
    expect(scripted.calls).toHaveLength(1);
    source.close();
  });

  test('closes the connection when the last subscriber unsubscribes, reopens on the next subscribe', async () => {
    scripted = new ScriptedFetch();
    let firstAbortSignal: AbortSignal | undefined;
    scripted.enqueue((signal) => {
      firstAbortSignal = signal;
      return controllableSseResponse(signal).response;
    });

    const source = new FleetEventSource({ baseUrl: '' });
    const unsubscribeA = source.subscribe(() => {});
    const unsubscribeB = source.subscribe(() => {});
    expect(scripted.calls).toHaveLength(1);

    unsubscribeA();
    expect(source.status).not.toBe('closed'); // subscriber B is still attached
    expect(firstAbortSignal?.aborted).not.toBe(true);

    unsubscribeB();
    expect(source.status).toBe('closed');
    expect(firstAbortSignal?.aborted).toBe(true);

    scripted.enqueue(finiteSseResponse([pingChunk(true)]));
    source.subscribe(() => {});
    expect(scripted.calls).toHaveLength(2);
    source.close();
  });
});
