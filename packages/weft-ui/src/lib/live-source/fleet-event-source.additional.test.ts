import { waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { RECONNECT_BASE_DELAY_MS } from './backoff.ts';
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

describe('additional coverage', () => {
  test('reconnects with Last-Event-ID after the stream ends, and the fake feed replays only newer envelopes from fromCursor', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueue(
      finiteSseResponse([
        pingChunk(true),
        envelopeChunk({
          kind: 'workflow:completed',
          workflowId: 'wf_1',
          sequence: 1,
          cursor: '1',
          emittedAtMs: 100,
          payload: {},
        }),
      ]),
    );
    scripted.enqueue(
      // Left open: the point of this test is the reconnect from response #1
      // ending to response #2's `Last-Event-ID`, not a second reconnect.
      openSseResponse([
        pingChunk(true),
        envelopeChunk({
          kind: 'workflow:completed',
          workflowId: 'wf_2',
          sequence: 2,
          cursor: '2',
          emittedAtMs: 200,
          payload: {},
        }),
      ]),
    );

    const source = new FleetEventSource({ baseUrl: '', computeReconnectDelayMs: () => 1 });
    const received: FleetEventFrame[] = [];
    source.subscribe((frame) => received.push(frame));

    await waitFor(() => {
      expect(scripted.calls).toHaveLength(2);
    });
    expect(received.map((f) => f.workflowId)).toEqual(['wf_1', 'wf_2']);
    expect(scripted.calls[0]?.headers['last-event-id']).toBeUndefined();
    expect(scripted.calls[1]?.headers['last-event-id']).toBe('1');
    source.close();
  });

  test('reconnects (with backoff) when the response is not ok', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueue(() => new Response('nope', { status: 500 }));
    scripted.enqueue(openSseResponse([pingChunk(true)]));

    const source = new FleetEventSource({ baseUrl: '', computeReconnectDelayMs: () => 1 });
    source.subscribe(() => {});

    await waitFor(() => {
      expect(scripted.calls).toHaveLength(2);
    });
    await source.whenConnected();
    expect(source.status).toBe('live');
    source.close();
  });

  test('without an override, reconnect uses the real capped-exponential backoff (does not retry within RECONNECT_BASE_DELAY_MS)', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueue(() => new Response('nope', { status: 500 }));

    const source = new FleetEventSource({ baseUrl: '' });
    source.subscribe(() => {});
    expect(scripted.calls).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, RECONNECT_BASE_DELAY_MS - 200));
    expect(scripted.calls).toHaveLength(1); // still waiting out the real backoff
    source.close();
  });

  test('constructor-level filter is sent as query params', () => {
    scripted = new ScriptedFetch();
    scripted.enqueue(finiteSseResponse([pingChunk(true)]));
    const source = new FleetEventSource({
      baseUrl: 'http://example.test',
      filter: { workflowId: 'wf_9', kind: 'workflow:failed' },
    });
    source.subscribe(() => {});
    const url = new URL(scripted.calls[0]!.url);
    expect(url.pathname).toBe('/v1/events/sse');
    expect(url.searchParams.get('workflowId')).toBe('wf_9');
    expect(url.searchParams.get('kind')).toBe('workflow:failed');
    source.close();
  });

  test('close() is idempotent and settles whenConnected', async () => {
    scripted = new ScriptedFetch();
    const source = new FleetEventSource({ baseUrl: '' });
    source.close();
    expect(() => source.close()).not.toThrow();
    expect(source.status).toBe('closed');
    await source.whenConnected();
  });

  test('unsubscribe is idempotent', () => {
    scripted = new ScriptedFetch();
    scripted.enqueue(finiteSseResponse([pingChunk(true)]));
    const source = new FleetEventSource({ baseUrl: '' });
    const unsubscribe = source.subscribe(() => {});
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
    source.close();
  });

  test('caughtUp is false until the replayComplete ping arrives, even though status goes live on the first frame', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueue(
      // No leading `pingChunk(true)` — this envelope frame is delivered
      // before catch-up completes, mirroring a real replay backlog frame.
      openSseResponse([
        envelopeChunk({
          kind: 'workflow:completed',
          workflowId: 'wf_1',
          sequence: 1,
          cursor: '1',
          emittedAtMs: 100,
          payload: {},
        }),
      ]),
    );

    const source = new FleetEventSource({ baseUrl: '' });
    const received: FleetEventFrame[] = [];
    source.subscribe((frame) => received.push(frame));

    await waitFor(() => {
      expect(received).toHaveLength(1);
    });
    expect(source.status).toBe('live');
    expect(source.caughtUp).toBe(false);
    source.close();
  });

  test('caughtUp becomes true once the replayComplete ping arrives, and resets to false on reconnect', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueue(finiteSseResponse([pingChunk(true)]));
    scripted.enqueue(openSseResponse([]));

    // A delay wide enough that the `caughtUp === true` window below is
    // reliably observable before the reconnect (triggered by
    // `finiteSseResponse` ending the stream right after the ping) resets it.
    const RECONNECT_DELAY_MS = 300;
    const source = new FleetEventSource({
      baseUrl: '',
      computeReconnectDelayMs: () => RECONNECT_DELAY_MS,
    });
    source.subscribe(() => {});

    await waitFor(() => {
      expect(source.caughtUp).toBe(true);
    });

    // Once the reconnect attempt actually starts (a second fetch call),
    // `caughtUp` must not keep reporting stale catch-up state from the prior
    // connection — `#connect()` resets it before issuing that fetch.
    await waitFor(
      () => {
        expect(scripted.calls).toHaveLength(2);
      },
      { timeout: RECONNECT_DELAY_MS + 1000 },
    );
    expect(source.caughtUp).toBe(false);
    source.close();
  });
});
