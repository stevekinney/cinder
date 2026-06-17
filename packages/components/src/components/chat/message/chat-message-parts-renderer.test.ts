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

const { render, cleanup, fireEvent } = await import('@testing-library/svelte');
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

  function stepPart(index: number): ChatMessagePart {
    return {
      type: 'step',
      key: `m:step:${index}`,
      index,
      title: `Step ${index}`,
      content: '',
      status: 'pending',
    };
  }

  function suggestionPart(index: number): ChatMessagePart {
    return { type: 'suggestion', key: `m:suggestion:${index}`, index, label: `S${index}` };
  }

  test('groups a contiguous run of step parts into one steps unit', () => {
    const units = toRenderUnits([stepPart(0), stepPart(1), stepPart(2)]);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ kind: 'steps' });
    expect(units[0]).toHaveProperty(['steps', 'length'], 3);
  });

  test('groups a contiguous run of suggestion parts into one suggestions unit', () => {
    const units = toRenderUnits([suggestionPart(0), suggestionPart(1)]);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ kind: 'suggestions' });
    expect(units[0]).toHaveProperty(['suggestions', 'length'], 2);
  });

  test('flushes a step run before a following non-step part', () => {
    const body: ChatMessagePart = {
      type: 'markdown',
      key: 'm:body',
      content: 'answer',
      streaming: false,
      expanded: true,
    };
    const units = toRenderUnits([stepPart(0), stepPart(1), body]);
    expect(units.map((unit) => unit.kind)).toEqual(['steps', 'part']);
  });

  test('keeps interleaved runs in order (steps → markdown → suggestions)', () => {
    const body: ChatMessagePart = {
      type: 'markdown',
      key: 'm:body',
      content: 'answer',
      streaming: false,
      expanded: true,
    };
    const units = toRenderUnits([stepPart(0), body, suggestionPart(0), suggestionPart(1)]);
    expect(units.map((unit) => unit.kind)).toEqual(['steps', 'part', 'suggestions']);
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

  test('renders a tool-approval part with group role (not alertdialog) and action buttons', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: {
        parts: [
          {
            type: 'tool-approval',
            key: 'm:tool-approval:c1',
            toolCallId: 'c1',
            toolName: 'deploy_to_production',
            action: { type: 'approval', message: 'Deploy to production?' },
            approved: undefined,
          },
        ],
        onapprove: () => {},
        ondeny: () => {},
      },
    });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('role')).toBe('group');
    expect(container.textContent).toContain('deploy_to_production');
    expect(container.textContent).toContain('Deploy to production?');
    // Approve and Reject buttons appear for pending state
    const buttons = container.querySelectorAll('button');
    const labels = Array.from(buttons).map((button) => button.textContent?.trim());
    expect(labels).toContain('Approve');
    expect(labels).toContain('Reject');
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

describe('renderer — suggestion toolbar roving tabindex (APG)', () => {
  function suggestionParts(labels: string[]): ChatMessagePart[] {
    return labels.map((label, index) => ({
      type: 'suggestion' as const,
      key: `m:suggestion:${index}`,
      index,
      label,
    }));
  }

  function chips(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('[data-cinder-suggestion]'));
  }

  test('first chip is the tab entry point (tabindex=0), rest are -1', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: suggestionParts(['A', 'B', 'C']) },
    });
    const els = chips(container);
    expect(els.map((c) => c.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  test('ArrowRight moves the roving tabindex (and focus) to the next chip, wrapping', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: suggestionParts(['A', 'B', 'C']) },
    });
    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!;
    const els = chips(container);
    els[0]!.focus();

    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    flushSync();
    expect(chips(container).map((c) => c.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(document.activeElement).toBe(chips(container)[1]!);

    // Wrap past the end back to the first chip.
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    flushSync();
    expect(chips(container).map((c) => c.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  test('ArrowLeft wraps backwards from the first chip to the last', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: suggestionParts(['A', 'B', 'C']) },
    });
    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!;
    fireEvent.keyDown(toolbar, { key: 'ArrowLeft' });
    flushSync();
    expect(chips(container).map((c) => c.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
  });

  test('Home and End jump to the first and last chip', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: suggestionParts(['A', 'B', 'C']) },
    });
    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!;
    fireEvent.keyDown(toolbar, { key: 'End' });
    flushSync();
    expect(chips(container).map((c) => c.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
    fireEvent.keyDown(toolbar, { key: 'Home' });
    flushSync();
    expect(chips(container).map((c) => c.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  test('a stale active index is clamped so a shorter chip set still has a tabindex=0 entry', () => {
    // Move the active index to the last of three chips, then re-render with only
    // one chip. Without clamping NO chip would hold tabindex=0 and the toolbar
    // would be unreachable by Tab. The applied index is clamped into range.
    const { container, rerender } = render(ChatMessagePartsRenderer, {
      props: { parts: suggestionParts(['A', 'B', 'C']) },
    });
    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!;
    fireEvent.keyDown(toolbar, { key: 'End' });
    flushSync();
    expect(chips(container).map((c) => c.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);

    rerender({ parts: suggestionParts(['Only']) });
    flushSync();
    const els = chips(container);
    expect(els).toHaveLength(1);
    expect(els[0]!.getAttribute('tabindex')).toBe('0');
  });

  test('non-navigation keys (Tab) pass through without preventing default', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: suggestionParts(['A', 'B']) },
    });
    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!;
    const defaultPrevented = !fireEvent.keyDown(toolbar, { key: 'Tab' });
    expect(defaultPrevented).toBe(false);
  });
});

describe('renderer — C3 compatibility (plain tool results render no approval UI)', () => {
  test('a success tool-result renders the tool-result view, not a tool-approval group', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: {
        parts: [
          {
            type: 'tool-result',
            key: 'm:tool-result:c1',
            result: { callId: 'c1', outcome: 'success', content: 'done' },
          },
        ],
      },
    });
    expect(container.querySelector('[data-cinder-tool-approval]')).toBeNull();
    expect(container.querySelector('[role="group"]')).toBeNull();
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
