/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: JsonViewer } = await import('./json-viewer.svelte');

afterEach(() => cleanup());

describe('JsonViewer', () => {
  test('renders a primitive value', () => {
    const { container } = render(JsonViewer, { value: 'hello' });
    expect(container.querySelector('.cinder-json-viewer__value')?.textContent?.trim()).toContain(
      'hello',
    );
    expect(container.querySelector('[role="treeitem"]')?.getAttribute('tabindex')).toBe('0');
  });

  test('renders an object with key labels', () => {
    const { container } = render(JsonViewer, { value: { name: 'Alice', age: 30 } });
    const keys = Array.from(container.querySelectorAll('.cinder-json-viewer__key'));
    const labels = keys.map((k) => k.textContent?.trim());
    expect(labels).toContain('name:');
    expect(labels).toContain('age:');
  });

  test('key label for an expandable node sits INSIDE the toggle button (focus ring covers the full row)', () => {
    // The nested object means the root is expandable. Its key label (the property
    // name) must be a child of the .cinder-json-viewer__toggle button so that
    // the focus ring drawn on the button surrounds the key text as well.
    const { container } = render(JsonViewer, { value: { config: { a: 1 } } });
    // Find the toggle button for the nested expandable node whose key is "config"
    const toggleButtons = Array.from(container.querySelectorAll('.cinder-json-viewer__toggle'));
    const configButton = toggleButtons.find(
      (button) =>
        button.querySelector('.cinder-json-viewer__key')?.textContent?.trim() === 'config:',
    );
    expect(configButton).not.toBeNull();
    // The key span must be a DESCENDANT of the button, not a sibling
    const keySpan = configButton?.querySelector('.cinder-json-viewer__key');
    expect(keySpan).not.toBeNull();
    expect(keySpan?.textContent?.trim()).toBe('config:');
  });

  test('toggle button aria-label includes the key name for an expandable node', () => {
    const { container } = render(JsonViewer, { value: { items: [1, 2, 3] } });
    const toggleButtons = Array.from(container.querySelectorAll('.cinder-json-viewer__toggle'));
    const itemsButton = toggleButtons.find((button) =>
      button.getAttribute('aria-label')?.startsWith('items:'),
    );
    expect(itemsButton).not.toBeNull();
    expect(itemsButton?.getAttribute('aria-label')).toBe('items: array, 3 items');
  });

  test('only the root expandable treeitem is tabbable', () => {
    const { container } = render(JsonViewer, { value: { config: { nested: true } } });
    const treeItems = Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]'));
    const tabbableTreeItems = treeItems.filter((item) => item.getAttribute('tabindex') === '0');

    expect(tabbableTreeItems).toHaveLength(1);
    expect(tabbableTreeItems[0]?.getAttribute('aria-label')).toBe('object, 1 item');
    const nestedToggle = treeItems.find((item) =>
      item.getAttribute('aria-label')?.startsWith('config:'),
    );
    expect(nestedToggle?.getAttribute('tabindex')).toBe('-1');
  });

  test('expanded child groups are nested inside their owning treeitem', () => {
    const { container } = render(JsonViewer, { value: { config: { nested: true } } });
    const rootTreeItem = container.querySelector<HTMLElement>(
      '[role="treeitem"][aria-label="object, 1 item"]',
    )!;
    const childGroup = rootTreeItem.querySelector('.cinder-json-viewer__children[role="group"]');

    expect(childGroup).not.toBeNull();
  });

  test('ArrowRight on an expanded object moves focus to its first child', async () => {
    const { container } = render(JsonViewer, { value: { config: { nested: true } } });
    const rootTreeItem = container.querySelector<HTMLElement>(
      '[role="treeitem"][aria-label="object, 1 item"]',
    )!;

    rootTreeItem.focus();
    await fireEvent.keyDown(rootTreeItem, { key: 'ArrowRight' });

    expect(document.activeElement?.getAttribute('aria-label')).toBe('config: object, 1 item');
  });

  test('ArrowLeft on a leaf moves focus to its parent treeitem', async () => {
    const { container } = render(JsonViewer, { value: { config: { nested: true } } });
    const rootTreeItem = container.querySelector<HTMLElement>(
      '[role="treeitem"][aria-label="object, 1 item"]',
    )!;
    const configTreeItem = container.querySelector<HTMLElement>(
      '[role="treeitem"][aria-label="config: object, 1 item"]',
    )!;
    rootTreeItem.focus();
    await fireEvent.keyDown(rootTreeItem, { key: 'ArrowRight' });
    configTreeItem.focus();
    await fireEvent.keyDown(configTreeItem, { key: 'ArrowRight' });
    const nestedTreeItem = container.querySelector<HTMLElement>(
      '[role="treeitem"][aria-level="3"]',
    )!;
    nestedTreeItem.focus();
    await fireEvent.keyDown(nestedTreeItem, { key: 'ArrowLeft' });

    expect(document.activeElement).toBe(configTreeItem);
  });

  test('does not expose selection state without a selection model', () => {
    const { container } = render(JsonViewer, { value: { config: { nested: true } } });
    const treeItems = Array.from(container.querySelectorAll('[role="treeitem"]'));

    expect(treeItems.length).toBeGreaterThan(0);
    expect(treeItems.every((item) => item.getAttribute('aria-selected') === null)).toBe(true);
  });

  test('Enter and Space toggle a focused expandable treeitem', async () => {
    const { container } = render(JsonViewer, { value: { config: { nested: true } } });
    const rootTreeItem = container.querySelector<HTMLElement>(
      '[role="treeitem"][aria-label="object, 1 item"]',
    )!;

    rootTreeItem.focus();
    await fireEvent.keyDown(rootTreeItem, { key: 'Enter' });
    expect(rootTreeItem.getAttribute('aria-expanded')).toBe('false');

    await fireEvent.keyDown(rootTreeItem, { key: ' ' });
    expect(rootTreeItem.getAttribute('aria-expanded')).toBe('true');
  });

  test('renders an array with index labels', () => {
    const { container } = render(JsonViewer, { value: [10, 20, 30] });
    const keys = Array.from(container.querySelectorAll('.cinder-json-viewer__key'));
    const labels = keys.map((k) => k.textContent?.trim());
    expect(labels).toEqual(['0:', '1:', '2:']);
  });

  test('shows the too-large fallback above maxBytes', () => {
    const big = 'x'.repeat(2000);
    const { container } = render(JsonViewer, { value: big, maxBytes: 100 });
    expect(container.querySelector('.cinder-json-viewer__fallback')).not.toBeNull();
  });

  test('renders the too-deep marker beyond maxDepth', () => {
    const deep: Record<string, unknown> = {};
    let cursor: Record<string, unknown> = deep;
    for (let i = 0; i < 6; i++) {
      const next: Record<string, unknown> = {};
      cursor['nested'] = next;
      cursor = next;
    }
    const { container } = render(JsonViewer, { value: deep, maxDepth: 3, initialDepth: 999 });
    expect(container.querySelector('.cinder-json-viewer__too-deep')).not.toBeNull();
  });

  test('root too-deep marker remains tabbable', () => {
    const { container } = render(JsonViewer, {
      value: { nested: true },
      maxDepth: 0,
      initialDepth: 999,
    });
    const root = container.querySelector('[role="treeitem"]');
    expect(root?.querySelector('.cinder-json-viewer__too-deep')).not.toBeNull();
    expect(root?.getAttribute('tabindex')).toBe('0');
  });
});

describe('JsonViewer — unserializable fallback', () => {
  // JSON.stringify throws on circular refs and BigInt. The viewer must show a
  // clear "can't be serialized" message, never a garbage "~Infinity KB" size.
  test('circular reference shows the unserializable fallback, not a size error', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const { container } = render(JsonViewer, { value: circular });
    const fallback = container.querySelector('.cinder-json-viewer__fallback');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain("can't be serialized");
    expect(fallback?.textContent).not.toContain('Infinity');
    expect(fallback?.textContent).not.toContain('NaN');
  });

  test('BigInt value shows the unserializable fallback', () => {
    const { container } = render(JsonViewer, { value: { big: 10n } });
    const fallback = container.querySelector('.cinder-json-viewer__fallback');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain("can't be serialized");
  });

  test.each([
    ['undefined', undefined],
    ['a symbol', Symbol('x')],
    ['a function', () => 'noop'],
  ])(
    '%s (JSON.stringify returns undefined, not a throw) shows the unserializable fallback',
    (_label, value) => {
      const { container } = render(JsonViewer, { value });
      const fallback = container.querySelector('.cinder-json-viewer__fallback');
      expect(fallback).not.toBeNull();
      expect(fallback?.textContent).toContain("can't be serialized");
      expect(fallback?.textContent).not.toContain('Infinity');
      expect(fallback?.textContent).not.toContain('undefined KB');
    },
  );

  test('a genuinely oversized payload still shows the size-based fallback', () => {
    const big = { blob: 'x'.repeat(2048) };
    const { container } = render(JsonViewer, { value: big, maxBytes: 100 });
    const fallback = container.querySelector('.cinder-json-viewer__fallback');
    expect(fallback?.textContent).toContain('too large');
    expect(fallback?.textContent).not.toContain('Infinity');
  });
});
