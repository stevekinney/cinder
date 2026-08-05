/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { TableOfContentsActiveHeadingTracker, pickActiveId } =
  await import('./table-of-contents-active-heading.svelte.ts');

function headingAt(id: string, top: number): HTMLElement {
  const element = document.createElement('h2');
  element.id = id;
  element.getBoundingClientRect = () =>
    ({
      top,
      bottom: top,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: top,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  return element;
}

describe('pickActiveId', () => {
  test('picks the last heading that has scrolled past the activation offset', () => {
    const headings = [headingAt('intro', -400), headingAt('usage', -50), headingAt('api', 300)];

    expect(pickActiveId(headings, 0)).toBe('usage');
  });

  test('falls back to the first upcoming heading when none has passed the offset', () => {
    const headings = [headingAt('intro', 200), headingAt('usage', 500)];

    expect(pickActiveId(headings, 0)).toBe('intro');
  });

  test('returns null for an empty set of elements', () => {
    expect(pickActiveId([], 0)).toBeNull();
  });
});

describe('TableOfContentsActiveHeadingTracker', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test('setActiveId writes activeId synchronously', () => {
    const tracker = new TableOfContentsActiveHeadingTracker();
    expect(tracker.activeId).toBeNull();

    tracker.setActiveId('usage');

    expect(tracker.activeId).toBe('usage');
  });

  test('sync() reports no active id when the item list is empty', () => {
    const tracker = new TableOfContentsActiveHeadingTracker();
    const cleanup = tracker.sync([], '0% 0% -70% 0%');

    expect(tracker.activeId).toBeNull();

    cleanup();
  });

  test('sync() picks the active id among the mounted, observed headings', () => {
    const intro = headingAt('intro', -400);
    const usage = headingAt('usage', -50);
    document.body.append(intro, usage);

    const tracker = new TableOfContentsActiveHeadingTracker();
    const cleanup = tracker.sync(
      [
        { id: 'intro', label: 'Intro', children: [] },
        { id: 'usage', label: 'Usage', children: [] },
      ],
      '0% 0% 0% 0%',
    );

    expect(tracker.activeId).toBe('usage');

    cleanup();
  });
});
