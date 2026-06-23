/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { checkBuildFlagHydrationSafety } from '../../test/hydration-safety.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: TreeRenameFixture } =
  await import('../../test/fixtures/tree-rename-fixture.svelte');
const treeRenameFixtureSource = new URL(
  '../../test/fixtures/tree-rename-fixture.svelte',
  import.meta.url,
).pathname;

afterEach(() => cleanup());

function treeItem(container: HTMLElement, label: string): HTMLElement {
  const labelElement = [...container.querySelectorAll<HTMLElement>('.cinder-sr-only')].find(
    (element) => element.textContent === label,
  );
  if (!labelElement?.id) throw new Error(`Missing treeitem label: ${label}`);
  const item = container.querySelector<HTMLElement>(
    `[role="treeitem"][aria-labelledby="${labelElement.id}"]`,
  );
  if (!item) throw new Error(`Missing treeitem for label: ${label}`);
  return item;
}

function itemById(container: HTMLElement, id: string): HTMLElement {
  const item = [...container.querySelectorAll<HTMLElement>('[data-cinder-tree-item-id]')].find(
    (element) => element.dataset['cinderTreeItemId'] === id,
  );
  if (!item) throw new Error(`Missing treeitem id: ${id}`);
  return item;
}

function renameInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('.cinder-tree-item__rename-input');
  if (!input) throw new Error('Missing rename input');
  return input;
}

async function beginRenameWithF2(container: HTMLElement): Promise<HTMLInputElement> {
  const item = itemById(container, 'alpha');
  item.focus();
  await fireEvent.keyDown(item, { key: 'F2' });
  await waitFor(() => {
    expect(document.activeElement).toBe(renameInput(container));
  });
  return renameInput(container);
}

async function flushLiveRegion(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await tick();
}

describe('Tree — inline label rename', () => {
  test('F2 enters edit mode with the current value selected and labelled', async () => {
    const { container } = render(TreeRenameFixture, {});

    const input = await beginRenameWithF2(container);
    const item = itemById(container, 'alpha');

    expect(input.value).toBe('Alpha');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Alpha'.length);
    expect(input.getAttribute('aria-label')).toBe('Editing: Alpha');
    expect(item.getAttribute('aria-label')).toBe('Editing: Alpha');
    expect(item.hasAttribute('aria-labelledby')).toBe(false);
    expect(item.getAttribute('tabindex')).toBe('0');
  });

  test('double-clicking the default label enters edit mode', async () => {
    const { container } = render(TreeRenameFixture, {});

    const label = container.querySelector<HTMLElement>('.cinder-tree-item__label');
    expect(label).not.toBeNull();
    await fireEvent.dblClick(label!);

    await waitFor(() => {
      expect(document.activeElement).toBe(renameInput(container));
    });
  });

  test('Enter commits, calls onrename, remounts with the new label, and restores focus', async () => {
    const calls: Array<[string, string]> = [];
    const { container } = render(TreeRenameFixture, {
      props: {
        onrename: (itemId: string, nextLabel: string) => {
          calls.push([itemId, nextLabel]);
        },
      },
    });

    const input = await beginRenameWithF2(container);
    await fireEvent.input(input, { target: { value: 'Renamed' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(calls).toEqual([['alpha', 'Renamed']]);
      expect(treeItem(container, 'Renamed')).toBe(itemById(container, 'alpha'));
      const renamedItem = itemById(container, 'alpha');
      expect(document.activeElement).toBe(renamedItem);
      expect(renamedItem.isConnected).toBe(true);
      expect(renamedItem.getAttribute('tabindex')).toBe('0');
    });
    expect(treeItem(container, 'Renamed')).toBe(itemById(container, 'alpha'));
    const ids = [...container.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('remount focus restoration is scoped to the edited tree', async () => {
    const { container: firstTree } = render(TreeRenameFixture, {
      props: { initialLabel: 'First' },
    });
    const { container: secondTree } = render(TreeRenameFixture, {
      props: { initialLabel: 'Second' },
    });

    const input = await beginRenameWithF2(secondTree);
    await fireEvent.input(input, { target: { value: 'Second Renamed' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const renamedItem = itemById(secondTree, 'alpha');
      expect(treeItem(secondTree, 'Second Renamed')).toBe(renamedItem);
      expect(document.activeElement).toBe(renamedItem);
    });
    expect(document.activeElement).not.toBe(itemById(firstTree, 'alpha'));
  });

  test('Escape cancels without calling onrename and restores focus to the item', async () => {
    const calls: Array<[string, string]> = [];
    const { container } = render(TreeRenameFixture, {
      props: {
        onrename: (itemId: string, nextLabel: string) => {
          calls.push([itemId, nextLabel]);
        },
      },
    });

    const input = await beginRenameWithF2(container);
    await fireEvent.input(input, { target: { value: 'Discarded' } });
    await fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(calls).toEqual([]);
      expect(treeItem(container, 'Alpha')).toBe(itemById(container, 'alpha'));
      expect(document.activeElement).toBe(itemById(container, 'alpha'));
    });
  });

  test('blur commits the edit', async () => {
    const calls: Array<[string, string]> = [];
    const { container } = render(TreeRenameFixture, {
      props: {
        onrename: (itemId: string, nextLabel: string) => {
          calls.push([itemId, nextLabel]);
        },
      },
    });

    const input = await beginRenameWithF2(container);
    await fireEvent.input(input, { target: { value: 'Blurred' } });
    await fireEvent.blur(input);

    await waitFor(() => {
      expect(calls).toEqual([['alpha', 'Blurred']]);
      expect(treeItem(container, 'Blurred')).toBe(itemById(container, 'alpha'));
    });
  });

  test('empty labels are invalid on the input and keep edit mode active', async () => {
    const calls: Array<[string, string]> = [];
    const { container } = render(TreeRenameFixture, {
      props: {
        onrename: (itemId: string, nextLabel: string) => {
          calls.push([itemId, nextLabel]);
        },
      },
    });

    const input = await beginRenameWithF2(container);
    await fireEvent.input(input, { target: { value: '   ' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(calls).toEqual([]);
      expect(renameInput(container).getAttribute('aria-invalid')).toBe('true');
      expect(renameInput(container).getAttribute('aria-describedby')).toBeTruthy();
      expect(document.activeElement).toBe(renameInput(container));
    });
    const describedBy = renameInput(container).getAttribute('aria-describedby');
    expect(container.querySelector(`#${describedBy}`)?.textContent).toBe('Label is required.');

    await flushLiveRegion();
    const alert = container.querySelector('[role="alert"][aria-live="assertive"]');
    expect(alert?.textContent).toContain('Label is required.');
  });

  test('onrename rejection keeps edit mode active and exposes the error accessibly', async () => {
    const calls: Array<[string, string]> = [];
    const { container } = render(TreeRenameFixture, {
      props: {
        onrename: async (itemId: string, nextLabel: string) => {
          calls.push([itemId, nextLabel]);
          throw new Error('Name already exists');
        },
      },
    });

    const input = await beginRenameWithF2(container);
    await fireEvent.input(input, { target: { value: 'Duplicate' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(calls).toEqual([['alpha', 'Duplicate']]);
      expect(renameInput(container).value).toBe('Duplicate');
      expect(renameInput(container).getAttribute('aria-invalid')).toBe('true');
      expect(renameInput(container).getAttribute('aria-describedby')).toBeTruthy();
      expect(document.activeElement).toBe(renameInput(container));
      expect(itemById(container, 'alpha').getAttribute('aria-label')).toBe('Editing: Alpha');
      expect(itemById(container, 'alpha').hasAttribute('data-cinder-editing')).toBe(true);
    });

    const describedBy = renameInput(container).getAttribute('aria-describedby');
    expect(container.querySelector(`#${describedBy}`)?.textContent).toBe(
      'Rename failed: Name already exists.',
    );
    await flushLiveRegion();
    const alert = container.querySelector('[role="alert"][aria-live="assertive"]');
    expect(alert?.textContent).toContain('Rename failed: Name already exists.');
  });

  test('disabled items do not enter edit mode', async () => {
    const { container } = render(TreeRenameFixture, { props: { disabled: true } });

    const item = itemById(container, 'alpha');
    item.focus();
    await fireEvent.keyDown(item, { key: 'F2' });

    expect(container.querySelector('.cinder-tree-item__rename-input')).toBeNull();
  });

  test('Enter begins editing only when selectionMode is none', async () => {
    const { container } = render(TreeRenameFixture, { props: { selectionMode: 'none' } });

    const item = itemById(container, 'alpha');
    await fireEvent.keyDown(item, { key: 'Enter' });
    await waitFor(() => {
      expect(document.activeElement).toBe(renameInput(container));
    });

    cleanup();

    const { container: singleContainer } = render(TreeRenameFixture, {
      props: { selectionMode: 'single' },
    });
    const singleItem = itemById(singleContainer, 'alpha');
    await fireEvent.keyDown(singleItem, { key: 'Enter' });
    expect(singleContainer.querySelector('.cinder-tree-item__rename-input')).toBeNull();
  });

  test('rapid repeated F2 opens one editor', async () => {
    const { container } = render(TreeRenameFixture, {});

    const item = itemById(container, 'alpha');
    await fireEvent.keyDown(item, { key: 'F2' });
    await fireEvent.keyDown(item, { key: 'F2' });

    await waitFor(() => {
      expect(container.querySelectorAll('.cinder-tree-item__rename-input')).toHaveLength(1);
    });
  });

  test('Tab commits and moves focus to the next item', async () => {
    const { container } = render(TreeRenameFixture, {});

    const input = await beginRenameWithF2(container);
    await fireEvent.input(input, { target: { value: 'Tabbed' } });
    await fireEvent.keyDown(input, { key: 'Tab' });

    await waitFor(() => {
      expect(treeItem(container, 'Tabbed')).toBe(itemById(container, 'alpha'));
      expect(document.activeElement).toBe(treeItem(container, 'Beta'));
    });
  });

  test('Tab commits and releases native focus traversal at tree edges', async () => {
    const { container } = render(TreeRenameFixture, { props: { includeBeta: false } });

    const input = await beginRenameWithF2(container);
    await fireEvent.input(input, { target: { value: 'Edge' } });
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    const defaultAllowed = input.dispatchEvent(tabEvent);

    expect(defaultAllowed).toBe(true);
    await waitFor(() => {
      expect(treeItem(container, 'Edge')).toBe(itemById(container, 'alpha'));
    });
  });

  test('renaming an expanded branch preserves expandedIds', async () => {
    const { container } = render(TreeRenameFixture, { props: { branch: true } });

    const input = await beginRenameWithF2(container);
    await fireEvent.input(input, { target: { value: 'Branch Renamed' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const branchItem = treeItem(container, 'Branch Renamed');
      expect(branchItem).toBe(itemById(container, 'alpha'));
      expect(branchItem.getAttribute('aria-expanded')).toBe('true');
    });
  });

  test('SSR never emits a mid-rename input', async () => {
    const result = await checkBuildFlagHydrationSafety(treeRenameFixtureSource, {});

    expect(result.buildFlagInvariant).toBe(true);
    expect(result.serverHtml).not.toContain('cinder-tree-item__rename-input');
    expect(result.clientHtml).not.toContain('cinder-tree-item__rename-input');
  });
});
