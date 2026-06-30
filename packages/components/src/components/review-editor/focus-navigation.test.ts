/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { createFocusRegionNavigator, type FocusRegion } from './focus-navigation.ts';

setupHappyDom();

const regions: FocusRegion[] = [
  { id: 'editor', selector: '[data-region="editor"]', label: 'Editor' },
  { id: 'comments', selector: '[data-region="comments"]', label: 'Comments' },
  { id: 'thread', selector: '[data-region="thread"]', label: 'Thread' },
];
const editorRegion = regions[0]!;
const commentsRegion = regions[1]!;
const threadRegion = regions[2]!;

function renderContainer(): HTMLElement {
  const container = document.createElement('section');
  container.innerHTML = `
    <div data-region="editor" tabindex="-1">
      <textarea data-testid="editor-field"></textarea>
    </div>
    <aside data-region="comments" tabindex="-1">
      <button type="button" data-testid="comments-button">Comment</button>
    </aside>
    <form data-region="thread" tabindex="-1">
      <input data-testid="thread-input" />
    </form>
  `;
  document.body.append(container);
  return container;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('createFocusRegionNavigator', () => {
  test('returns the region containing the active element', () => {
    const container = renderContainer();
    const navigator = createFocusRegionNavigator(regions);

    container.querySelector<HTMLElement>('[data-testid="comments-button"]')?.focus();

    expect(navigator.getCurrentRegion(container)).toEqual(commentsRegion);
  });

  test('returns null when focus is outside the scoped container or outside a region', () => {
    const container = renderContainer();
    const outside = document.createElement('button');
    document.body.append(outside);
    const navigator = createFocusRegionNavigator(regions);

    outside.focus();
    expect(navigator.getCurrentRegion(container)).toBeNull();

    container.focus();
    expect(navigator.getCurrentRegion(container)).toBeNull();
  });

  test('cycles forward and backward through active regions', () => {
    const navigator = createFocusRegionNavigator(regions);

    expect(navigator.getNextRegion(null)).toEqual(editorRegion);
    expect(navigator.getNextRegion(editorRegion)).toEqual(commentsRegion);
    expect(navigator.getNextRegion(editorRegion, true)).toEqual(threadRegion);
    expect(navigator.getNextRegion(threadRegion)).toEqual(editorRegion);
  });

  test('filters inactive regions and falls back when the current region becomes inactive', () => {
    const navigator = createFocusRegionNavigator(regions, {
      isRegionActive: (region) => region.id !== 'comments',
    });

    expect(navigator.getActiveRegions()).toEqual([editorRegion, threadRegion]);
    expect(navigator.getNextRegion(editorRegion)).toEqual(threadRegion);
    expect(navigator.getNextRegion(commentsRegion)).toEqual(editorRegion);
  });

  test('falls back to the first defined region when every region is inactive', () => {
    const navigator = createFocusRegionNavigator(regions, {
      isRegionActive: () => false,
    });

    expect(navigator.getActiveRegions()).toEqual([]);
    expect(navigator.getNextRegion(commentsRegion)).toEqual(editorRegion);
  });

  test('throws a clear error when no fallback region exists', () => {
    const navigator = createFocusRegionNavigator([], {
      isRegionActive: () => false,
    });

    expect(() => navigator.getNextRegion(null)).toThrow(
      'createFocusRegionNavigator requires at least one focus region.',
    );
  });

  test('focuses the first focusable descendant in the target region', () => {
    const container = renderContainer();
    const navigator = createFocusRegionNavigator(regions);

    navigator.focusRegion(container, threadRegion);

    expect(document.activeElement).toBe(container.querySelector('[data-testid="thread-input"]'));
  });

  test('focuses the region element when it has no focusable descendants', () => {
    const container = document.createElement('section');
    container.innerHTML = '<div data-region="editor" tabindex="-1"></div>';
    document.body.append(container);
    const navigator = createFocusRegionNavigator([editorRegion]);
    const editorElement = container.querySelector('[data-region="editor"]');

    navigator.focusRegion(container, editorRegion);

    expect(document.activeElement).toBe(editorElement);
  });

  test('uses a custom focus handler before default focus behavior', () => {
    const container = renderContainer();
    const handled: string[] = [];
    const navigator = createFocusRegionNavigator(regions, {
      customFocusHandler: (region) => {
        handled.push(region.id);
        return region.id === 'comments';
      },
    });

    navigator.focusRegion(container, commentsRegion);

    expect(handled).toEqual(['comments']);
    expect(document.activeElement).not.toBe(
      container.querySelector('[data-testid="comments-button"]'),
    );
  });
});
