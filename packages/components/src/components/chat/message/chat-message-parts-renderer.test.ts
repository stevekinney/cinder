/**
 * Tests for the message parts renderer.
 *
 * Covers:
 *   1. `toRenderUnits` — the pure image-run grouping that keeps the attachment
 *      grid laying out by total count while non-image parts stay individual.
 *   2. Per-part rendering — each part type renders its sub-component's markup.
 *   3. The `messagePart` override — inversion of control: the override receives
 *      the part and a `renderDefault` snippet and can delegate back to it.
 *   4. Stable DOM identity — a markdown body updating its content (same key)
 *      does NOT remount its sub-component, so focus/scroll/transitions survive.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import type { ChatMessagePart, ImageMessagePart } from '../utilities/types.ts';
import { toRenderUnits } from './chat-message-parts.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import.
setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: ChatMessagePartsRenderer } = await import('./chat-message-parts-renderer.svelte');
const { default: PartsRendererFixture } =
  await import('./chat-message-parts-renderer-fixture.svelte');

/** The fixture's imperative surface — drives a reactive parts update. */
type FixtureInstance = { setParts: (next: ChatMessagePart[]) => void };

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function imagePart(index: number, url: string): ImageMessagePart {
  return { type: 'image', key: `m:image:${index}`, image: { type: 'image', url } };
}

describe('toRenderUnits', () => {
  test('keeps a single non-image part as one unit', () => {
    const part: ChatMessagePart = {
      type: 'markdown',
      key: 'm:body',
      content: 'hi',
      streaming: false,
      expanded: true,
    };
    expect(toRenderUnits([part])).toEqual([{ kind: 'part', part, key: 'm:body' }]);
  });

  test('groups a contiguous run of image parts into one unit', () => {
    const a = imagePart(0, 'https://example.test/a.png');
    const b = imagePart(1, 'https://example.test/b.png');
    const units = toRenderUnits([a, b]);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ kind: 'images', images: [a, b] });
  });

  test('separates image runs split by a non-image part', () => {
    const a = imagePart(0, 'https://example.test/a.png');
    const body: ChatMessagePart = {
      type: 'markdown',
      key: 'm:body',
      content: 'between',
      streaming: false,
      expanded: true,
    };
    const b = imagePart(2, 'https://example.test/b.png');
    const units = toRenderUnits([a, body, b]);
    expect(units.map((unit) => unit.kind)).toEqual(['images', 'part', 'images']);
  });
});

describe('renderer — per-part rendering', () => {
  test('renders a markdown part through the message-content view', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: {
        parts: [
          {
            type: 'markdown',
            key: 'm:body',
            content: 'hello body',
            streaming: false,
            expanded: true,
          },
        ],
      },
    });
    expect(container.querySelector('.message-content')).not.toBeNull();
    expect(container.textContent).toContain('hello body');
  });

  test('renders the exhaustiveness sentinel for an unhandled part type', () => {
    // Future-proofing: if ChatMessagePart is widened without adding a renderer
    // branch, the `{:else}` sentinel makes the omission visible (and `part.type`
    // narrows to `never` there, failing the typecheck). Simulate that future
    // state with an unknown part type cast through `any`.
    const unknownPart = { type: 'future-variant', key: 'm:future' } as unknown as ChatMessagePart;
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: [unknownPart] },
    });
    expect(container.querySelector('[data-cinder-unhandled-part]')).not.toBeNull();
  });

  test('renders a tool-call part through the tool-call group', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: {
        parts: [
          {
            type: 'tool-call',
            key: 'm:tool-call:c1',
            pair: { call: { id: 'c1', name: 'lookup', arguments: {} } },
          },
        ],
      },
    });
    expect(container.querySelector('.tool-call-group')).not.toBeNull();
    expect(container.textContent).toContain('lookup');
  });

  test('renders a tool-result error part with an alert role', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: {
        parts: [
          {
            type: 'tool-result',
            key: 'm:tool-result:c1',
            result: {
              callId: 'c1',
              outcome: 'error',
              content: null,
              error: { code: 'E', category: 'internal', retryable: false, message: 'it failed' },
            },
          },
        ],
      },
    });
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('it failed');
  });

  test('renders an image group through the attachments grid with the right count', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: {
        parts: [
          imagePart(0, 'https://example.test/a.png'),
          imagePart(1, 'https://example.test/b.png'),
        ],
      },
    });
    const grid = container.querySelector('.message-attachments');
    expect(grid).not.toBeNull();
    // The grid lays out by total count — proving images render as ONE group,
    // not two count-1 grids.
    expect(grid?.getAttribute('data-count')).toBe('2');
  });
});

describe('renderer — messagePart override (inversion of control)', () => {
  test('the override replaces the built-in for the part it handles', () => {
    const messagePart = createRawSnippet((getPart: () => ChatMessagePart) => ({
      render: () => {
        const part = getPart();
        return `<div class="custom-override">overridden: ${part.type}</div>`;
      },
      setup: () => {},
    }));
    const { container } = render(ChatMessagePartsRenderer, {
      props: {
        parts: [
          {
            type: 'markdown',
            key: 'm:body',
            content: 'original',
            streaming: false,
            expanded: true,
          },
        ],
        messagePart: messagePart as never,
      },
    });
    expect(container.querySelector('.custom-override')).not.toBeNull();
    expect(container.textContent).toContain('overridden: markdown');
    // The built-in markdown view is gone — the override fully replaced it.
    expect(container.querySelector('.message-content')).toBeNull();
  });
});

describe('renderer — stable DOM identity', () => {
  // These drive a real reactive parts update through a $state-backed fixture
  // (mirroring how the container re-derives parts during streaming), rather than
  // a props-replacement rerender — the keyed-each identity contract only holds
  // under genuine reactive updates.
  test('a markdown body updating its content does NOT remount the sub-component', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(PartsRendererFixture, {
      target,
      props: {
        initialParts: [
          { type: 'markdown', key: 'm:body', content: 'first', streaming: false, expanded: true },
        ],
      },
    }) as FixtureInstance;

    const before = target.querySelector('.message-content')!;
    expect(before).not.toBeNull();
    // Mark the live node. If the each-block remounts on update, this marked node
    // is discarded and a fresh (unmarked) one replaces it.
    before.setAttribute('data-identity-probe', 'kept');

    // Update content, same key.
    instance.setParts([
      {
        type: 'markdown',
        key: 'm:body',
        content: 'second longer body',
        streaming: false,
        expanded: true,
      },
    ]);
    flushSync();

    const after = target.querySelector('.message-content');
    expect(after).not.toBeNull();
    expect(after?.getAttribute('data-identity-probe')).toBe('kept');
    expect(after).toBe(before);

    unmount(instance);
    target.remove();
  });

  test('streaming a markdown body across many updates keeps a single stable node', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(PartsRendererFixture, {
      target,
      props: {
        initialParts: [
          { type: 'markdown', key: 'm:body', content: '', streaming: true, expanded: true },
        ],
      },
    }) as FixtureInstance;

    const before = target.querySelector('.message-content')!;
    expect(before).not.toBeNull();
    before.setAttribute('data-identity-probe', 'kept');

    // Simulate token-by-token streaming: the body key is constant, only the
    // content grows. The markdown node must persist across every update (so a
    // mid-render rAF / focus / selection is never torn down).
    for (const content of ['He', 'Hello', 'Hello wor', 'Hello world']) {
      instance.setParts([
        { type: 'markdown', key: 'm:body', content, streaming: true, expanded: true },
      ]);
      flushSync();
    }

    const nodes = target.querySelectorAll('.message-content');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.getAttribute('data-identity-probe')).toBe('kept');
    expect(nodes[0]).toBe(before);

    unmount(instance);
    target.remove();
  });

  test('a result arriving for a tool-call part (same key) does NOT remount the card', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const pair = { call: { id: 'c1', name: 'lookup', arguments: {} } };
    const instance = mount(PartsRendererFixture, {
      target,
      props: { initialParts: [{ type: 'tool-call', key: 'm:tool-call:c1', pair }] },
    }) as FixtureInstance;

    const before = target.querySelector('.tool-call-group')!;
    expect(before).not.toBeNull();
    before.setAttribute('data-identity-probe', 'kept');

    // A result arriving for the same call id keeps the part key stable.
    instance.setParts([
      {
        type: 'tool-call',
        key: 'm:tool-call:c1',
        pair: { call: pair.call, result: { callId: 'c1', outcome: 'success', content: 'done' } },
      },
    ]);
    flushSync();

    const after = target.querySelector('.tool-call-group');
    expect(after?.getAttribute('data-identity-probe')).toBe('kept');
    expect(after).toBe(before);

    unmount(instance);
    target.remove();
  });
});
