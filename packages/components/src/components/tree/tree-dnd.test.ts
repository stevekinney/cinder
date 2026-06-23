/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Snippet } from 'svelte';
import { createRawSnippet, mount, tick, unmount } from 'svelte';

import type { TreeReorderTarget } from '../../_internal/tree-drag-controller.svelte.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type { TreeItemProps } from '../tree-item/tree-item.types.ts';
import type { TreeSelectionMode } from './tree.types.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');
const { default: TreeItem } = await import('../tree-item/tree-item.svelte');

afterEach(() => cleanup());

type Item = {
  id: string;
  label: string;
  draggable?: boolean;
  disabled?: boolean;
  branch?: boolean;
  children?: Item[];
  onrename?: TreeItemProps['onrename'];
};

function treeItemsSnippet(items: Item[]): Snippet {
  return createRawSnippet(() => ({
    render: () => '<div></div>',
    setup: (node: Element) => {
      const instances: ReturnType<typeof mount>[] = [];
      for (const item of items) {
        const children = item.children ? treeItemsSnippet(item.children) : undefined;
        const props: TreeItemProps = {
          id: item.id,
          label: item.label,
        };
        if (item.draggable !== undefined) props.draggable = item.draggable;
        if (item.disabled !== undefined) props.disabled = item.disabled;
        if (item.branch !== undefined) props.branch = item.branch;
        if (item.onrename !== undefined) props.onrename = item.onrename;
        if (children !== undefined) props.children = children;
        instances.push(
          mount(TreeItem, {
            target: node,
            props,
          }),
        );
      }
      return () => {
        for (const instance of instances) unmount(instance);
      };
    },
  }));
}

function treeItem(container: HTMLElement, label: string): HTMLElement {
  const labelElement = [...container.querySelectorAll<HTMLElement>('.cinder-sr-only')].find(
    (element) => element.textContent === label,
  );
  if (!labelElement?.id) throw new Error(`Missing label: ${label}`);
  const item = container.querySelector<HTMLElement>(
    `[role="treeitem"][aria-labelledby="${labelElement.id}"]`,
  );
  if (!item) throw new Error(`Missing treeitem: ${label}`);
  return item;
}

function dragHandle(container: HTMLElement, label: string): HTMLButtonElement {
  const item = treeItem(container, label);
  const handle = item.querySelector<HTMLButtonElement>('.cinder-tree-item__drag-handle');
  if (!handle) throw new Error(`Missing drag handle: ${label}`);
  return handle;
}

async function flushLiveRegion(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await tick();
}

function renderTree(
  options: {
    items?: Item[];
    expandedIds?: string[];
    selectionMode?: TreeSelectionMode;
    onreorder?: (draggedId: string, target: TreeReorderTarget) => void;
  } = {},
) {
  const onreorder = options.onreorder ?? mock();
  const items = options.items ?? [
    { id: 'a', label: 'Alpha', draggable: true },
    { id: 'b', label: 'Beta', draggable: true },
    { id: 'c', label: 'Gamma', draggable: true },
  ];
  const result = render(Tree, {
    props: {
      'aria-label': 'Reorder tree',
      expandedIds: options.expandedIds ?? [],
      selectionMode: options.selectionMode ?? 'none',
      onreorder,
      children: treeItemsSnippet(items),
    },
  });
  return { ...result, onreorder };
}

describe('Tree — drag-and-drop reorder', () => {
  test('renders non-tab-stop drag handles only for enabled draggable items', () => {
    const { container } = renderTree({
      items: [
        { id: 'a', label: 'Alpha', draggable: true },
        { id: 'b', label: 'Beta', draggable: true, disabled: true },
        { id: 'c', label: 'Gamma' },
      ],
    });

    const alphaHandle = dragHandle(container, 'Alpha');
    expect(alphaHandle.getAttribute('aria-label')).toBe('Reorder Alpha');
    expect(alphaHandle.getAttribute('aria-describedby')).toBeTruthy();
    expect(treeItem(container, 'Alpha').getAttribute('aria-describedby')).toBe(
      alphaHandle.getAttribute('aria-describedby'),
    );
    expect(alphaHandle.getAttribute('tabindex')).toBe('-1');
    expect(treeItem(container, 'Beta').querySelector('.cinder-tree-item__drag-handle')).toBeNull();
    expect(treeItem(container, 'Gamma').querySelector('.cinder-tree-item__drag-handle')).toBeNull();
  });

  test('drag handle click does not bubble to the tree item', async () => {
    const { container } = renderTree({ selectionMode: 'single' });
    const alpha = treeItem(container, 'Alpha');
    const handle = dragHandle(container, 'Alpha');
    let bubbledClicks = 0;
    alpha.addEventListener('click', () => {
      bubbledClicks += 1;
    });

    await fireEvent.click(handle);

    expect(bubbledClicks).toBe(0);
    expect(alpha.getAttribute('aria-selected')).toBe('false');
  });

  test('Space and Enter on a draggable selectable item keep their selection behavior', async () => {
    const onreorder = mock();
    const { container } = renderTree({ selectionMode: 'single', onreorder });
    const alpha = treeItem(container, 'Alpha');

    alpha.focus();
    await fireEvent.keyDown(alpha, { key: ' ' });

    expect(alpha.getAttribute('aria-selected')).toBe('true');
    expect(alpha.hasAttribute('data-cinder-dragging')).toBe(false);

    await fireEvent.keyDown(alpha, { key: 'Enter' });

    expect(alpha.getAttribute('aria-selected')).toBe('false');
    expect(onreorder).not.toHaveBeenCalled();
  });

  test('Control Shift Space starts a keyboard drag from the focused tree item', async () => {
    const calls: Array<[string, TreeReorderTarget]> = [];
    const { container } = renderTree({
      onreorder: (draggedId, target) => calls.push([draggedId, target]),
    });
    const alpha = treeItem(container, 'Alpha');

    alpha.focus();
    await fireEvent.keyDown(alpha, { key: ' ', ctrlKey: true, shiftKey: true });

    await waitFor(() => {
      expect(alpha.hasAttribute('data-cinder-dragging')).toBe(true);
      expect(document.activeElement).toBe(alpha);
    });

    await fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    await fireEvent.keyDown(alpha, { key: ' ' });

    await waitFor(() => {
      expect(calls).toEqual([
        ['a', { id: 'b', position: 'after', fromParentId: null, toParentId: null }],
      ]);
      expect(document.activeElement).toBe(alpha);
    });
  });

  test('pointerup does not drop a keyboard drag', async () => {
    const onreorder = mock();
    const { container } = renderTree({ onreorder });
    const tree = container.querySelector<HTMLElement>('[role="tree"]')!;
    const alpha = treeItem(container, 'Alpha');

    alpha.focus();
    await fireEvent.keyDown(alpha, { key: ' ', ctrlKey: true, shiftKey: true });
    await fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    await fireEvent.pointerUp(tree);

    expect(onreorder).not.toHaveBeenCalled();
    expect(alpha.hasAttribute('data-cinder-dragging')).toBe(true);
    expect(treeItem(container, 'Beta').getAttribute('data-cinder-drop-target')).toBe('after');

    await fireEvent.keyDown(alpha, { key: ' ' });

    expect(onreorder).toHaveBeenCalledTimes(1);
  });

  test('F2 does not enter rename mode during an active drag', async () => {
    const onrename = mock();
    const { container } = renderTree({
      items: [
        { id: 'a', label: 'Alpha', draggable: true, onrename },
        { id: 'b', label: 'Beta', draggable: true },
      ],
    });
    const alpha = treeItem(container, 'Alpha');

    alpha.focus();
    await fireEvent.keyDown(alpha, { key: ' ', ctrlKey: true, shiftKey: true });
    await fireEvent.keyDown(alpha, { key: 'F2' });

    expect(alpha.hasAttribute('data-cinder-dragging')).toBe(true);
    expect(container.querySelector('.cinder-tree-item__rename-input')).toBeNull();
    expect(onrename).not.toHaveBeenCalled();
  });

  test('Space lifts an item and announces keyboard instructions', async () => {
    const { container } = renderTree();
    const handle = dragHandle(container, 'Alpha');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });

    await waitFor(() => {
      expect(handle.getAttribute('aria-pressed')).toBe('true');
      expect(treeItem(container, 'Alpha').hasAttribute('data-cinder-dragging')).toBe(true);
    });
    await flushLiveRegion();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Alpha, lifted');
  });

  test('ArrowDown then Space drops after the next visible item', async () => {
    const calls: Array<[string, TreeReorderTarget]> = [];
    const { container } = renderTree({
      onreorder: (draggedId, target) => calls.push([draggedId, target]),
    });
    const handle = dragHandle(container, 'Alpha');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(treeItem(container, 'Beta').getAttribute('data-cinder-drop-target')).toBe('after');
    await fireEvent.keyDown(handle, { key: ' ' });

    await waitFor(() => {
      expect(calls).toEqual([
        ['a', { id: 'b', position: 'after', fromParentId: null, toParentId: null }],
      ]);
      expect(document.activeElement).toBe(handle);
      expect(handle.getAttribute('aria-pressed')).toBe('false');
    });
  });

  test('Home and End move an active keyboard drag to the visible tree edges', async () => {
    const calls: Array<[string, TreeReorderTarget]> = [];
    const { container } = renderTree({
      onreorder: (draggedId, target) => calls.push([draggedId, target]),
    });
    const handle = dragHandle(container, 'Beta');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'End' });
    expect(treeItem(container, 'Gamma').getAttribute('data-cinder-drop-target')).toBe('after');
    await fireEvent.keyDown(handle, { key: 'Home' });
    expect(treeItem(container, 'Alpha').getAttribute('data-cinder-drop-target')).toBe('before');
    await fireEvent.keyDown(handle, { key: 'Enter' });

    expect(calls).toEqual([
      ['b', { id: 'a', position: 'before', fromParentId: null, toParentId: null }],
    ]);
  });

  test('Escape cancels an active keyboard drag without reordering', async () => {
    const onreorder = mock();
    const { container } = renderTree({ onreorder });
    const handle = dragHandle(container, 'Alpha');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'Escape' });

    expect(onreorder).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(handle.getAttribute('aria-pressed')).toBe('false');
      expect(document.activeElement).toBe(handle);
    });
  });

  test('Tab cancels an active keyboard drag without trapping focus', async () => {
    const onreorder = mock();
    const { container } = renderTree({ onreorder });
    const handle = dragHandle(container, 'Alpha');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    expect(handle.getAttribute('aria-pressed')).toBe('true');

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    const defaultAllowed = handle.dispatchEvent(tabEvent);

    expect(defaultAllowed).toBe(true);
    expect(onreorder).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(handle.getAttribute('aria-pressed')).toBe('false');
      expect(treeItem(container, 'Alpha').hasAttribute('data-cinder-dragging')).toBe(false);
    });
  });

  test('dropping immediately after lift does not emit a self-target reorder', async () => {
    const onreorder = mock();
    const { container } = renderTree({ onreorder });
    const handle = dragHandle(container, 'Alpha');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: ' ' });

    expect(onreorder).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(handle.getAttribute('aria-pressed')).toBe('false');
      expect(document.activeElement).toBe(handle);
    });
  });

  test('ArrowRight reparents the dragged item into the previous branch', async () => {
    const calls: Array<[string, TreeReorderTarget]> = [];
    const { container } = renderTree({
      expandedIds: ['a'],
      items: [
        { id: 'a', label: 'Alpha', branch: true, draggable: true },
        { id: 'b', label: 'Beta', draggable: true },
      ],
      onreorder: (draggedId, target) => calls.push([draggedId, target]),
    });
    const handle = dragHandle(container, 'Beta');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(treeItem(container, 'Alpha').hasAttribute('data-cinder-drop-into')).toBe(true);
    await fireEvent.keyDown(handle, { key: 'Enter' });

    expect(calls).toEqual([
      ['b', { id: 'a', position: 'child', fromParentId: null, toParentId: 'a' }],
    ]);
  });

  test('ArrowLeft reparents a child out after its parent', async () => {
    const calls: Array<[string, TreeReorderTarget]> = [];
    const { container } = renderTree({
      expandedIds: ['a'],
      items: [
        {
          id: 'a',
          label: 'Alpha',
          branch: true,
          draggable: true,
          children: [{ id: 'b', label: 'Beta', draggable: true }],
        },
      ],
      onreorder: (draggedId, target) => calls.push([draggedId, target]),
    });
    const handle = dragHandle(container, 'Beta');

    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(treeItem(container, 'Alpha').getAttribute('data-cinder-drop-target')).toBe('after');
    await fireEvent.keyDown(handle, { key: 'Enter' });

    expect(calls).toEqual([
      ['b', { id: 'a', position: 'after', fromParentId: 'a', toParentId: null }],
    ]);
  });
});
