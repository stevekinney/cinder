import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import { useChatStreamingState } from './use-chat-streaming-state.svelte.ts';

type FrameCallback = FrameRequestCallback;

let originalRequestAnimationFrame: typeof requestAnimationFrame;
let originalCancelAnimationFrame: typeof cancelAnimationFrame;
let nextFrame = 1;
let frames = new Map<number, FrameCallback>();

beforeEach(() => {
  originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  nextFrame = 1;
  frames = new Map();
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: (id: number) => frames.delete(id),
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: originalRequestAnimationFrame,
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: originalCancelAnimationFrame,
  });
});

function createFixture() {
  const viewport = document.createElement('div');
  const alternateViewport = document.createElement('div');
  const currentViewports = [viewport, alternateViewport];
  const viewportScrolls = new Map<HTMLElement, number[]>();
  for (const currentViewport of currentViewports) {
    viewportScrolls.set(currentViewport, []);
    Object.defineProperty(currentViewport, 'scrollHeight', { configurable: true, value: 640 });
    Object.defineProperty(currentViewport, 'scrollTo', {
      configurable: true,
      value: (optionsOrTop: ScrollToOptions | number) => {
        const top = typeof optionsOrTop === 'number' ? optionsOrTop : (optionsOrTop.top ?? 0);
        viewportScrolls.get(currentViewport)?.push(top);
      },
    });
  }
  let activeViewport = viewport;
  let virtualized = false;
  let editing = false;
  let atBottom = true;
  const measured: (HTMLElement | null)[] = [];
  const scrolled: number[] = [];
  let recomputes = 0;
  const virtualizer = {
    measureElementNode: (node: HTMLElement | null) => measured.push(node),
    scrollToOffset: (offset: number) => scrolled.push(offset),
    scrollSize: 240,
  };
  const state = useChatStreamingState({
    getIsVirtualized: () => virtualized,
    getViewport: () => activeViewport,
    getEditing: () => editing,
    getScrollState: () => ({
      get atBottom() {
        return atBottom;
      },
      recomputeFromViewport: () => {
        recomputes += 1;
      },
    }),
    getVirtualizer: () => virtualizer,
  });
  return {
    state,
    viewport,
    alternateViewport,
    viewportScrolls,
    measured,
    scrolled,
    get recomputes() {
      return recomputes;
    },
    setEditing(value: boolean) {
      editing = value;
    },
    setAtBottom(value: boolean) {
      atBottom = value;
    },
    setVirtualized(value: boolean) {
      virtualized = value;
    },
    setViewport(value: HTMLDivElement) {
      activeViewport = value;
    },
  };
}

async function runNextFrame(): Promise<void> {
  const next = frames.keys().next().value;
  if (typeof next === 'number') {
    frames.get(next)?.(0);
    frames.delete(next);
  }
  await tick();
  await tick();
}

describe('imperative streaming state', () => {
  test('retains the attached row across end and begin before the next frame', async () => {
    const fixture = createFixture();
    const row = document.createElement('div');

    fixture.state.beginStreaming('first');
    fixture.state.setStreamingRowElement(row);
    fixture.state.endStreaming();
    fixture.state.beginStreaming('second');
    fixture.state.pushToken('fresh');
    await runNextFrame();

    expect(fixture.measured).toEqual([row]);
    expect(fixture.state.messageId).toBe('second');
    expect(fixture.state.content).toBe('fresh');
  });

  test('cancels stale frames when a stream restarts or ends', async () => {
    const fixture = createFixture();

    fixture.state.beginStreaming('first');
    fixture.state.pushToken('stale');
    fixture.state.beginStreaming('second');
    fixture.state.pushToken('fresh');
    await runNextFrame();
    expect(fixture.state.content).toBe('fresh');

    fixture.state.pushToken('cancelled');
    fixture.state.endStreaming();
    await runNextFrame();
    expect(fixture.state.messageId).toBeNull();
    expect(fixture.state.content).toBe('');
  });

  test('batches multiple tokens into one frame and protects newer row identity', async () => {
    const fixture = createFixture();
    const oldRow = document.createElement('div');
    const newRow = document.createElement('div');

    fixture.state.beginStreaming('message');
    fixture.state.setStreamingRowElement(oldRow);
    fixture.state.setStreamingRowElement(newRow);
    fixture.state.clearStreamingRowElement(oldRow);
    fixture.state.pushToken('first');
    fixture.state.pushToken(' second');
    await runNextFrame();

    expect(fixture.state.content).toBe('first second');
    expect(fixture.measured).toEqual([newRow]);
  });

  test('reads editing, viewport, and virtualization state when the frame runs', async () => {
    const fixture = createFixture();
    fixture.setEditing(true);
    fixture.setAtBottom(false);
    fixture.setVirtualized(true);
    fixture.state.beginStreaming('message');
    fixture.state.pushToken('token');
    fixture.setViewport(fixture.alternateViewport);
    fixture.setVirtualized(false);
    fixture.setEditing(false);
    fixture.setAtBottom(true);
    await runNextFrame();

    expect(fixture.recomputes).toBe(0);
    expect(fixture.scrolled).toEqual([]);
    expect(fixture.viewportScrolls.get(fixture.alternateViewport)).toEqual([640]);
  });
});
