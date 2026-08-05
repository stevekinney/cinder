/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { TreeItemRenameController } = await import('./tree-item-rename.svelte.ts');

type RenameCall = { id: string; value: string };

function createController(onRename: (id: string, value: string) => Promise<void>) {
  const controller = new TreeItemRenameController({
    getId: () => 'alpha',
    getLabel: () => 'Alpha',
    getOnRename: () => onRename,
    getDisabled: () => false,
    getOuterElement: () => undefined,
    getElementId: () => 'tree-item-alpha',
    canFocusVisibleDelta: () => false,
    focusVisibleDelta: () => {},
  });
  return controller;
}

describe('TreeItemRenameController', () => {
  test('commitEdit calls onRename with the edited value and clears editing on success', async () => {
    const calls: RenameCall[] = [];
    const controller = createController(async (id, value) => {
      calls.push({ id, value });
    });

    controller.beginEdit();
    controller.editValue = 'Beta';
    const result = await controller.commitEdit();

    expect(result).toBe(true);
    expect(calls).toEqual([{ id: 'alpha', value: 'Beta' }]);
    expect(controller.editing).toBe(false);
  });

  test('commitEdit sets renameError and stays editing when onRename rejects', async () => {
    const controller = createController(async () => {
      throw new Error('Name already exists');
    });

    controller.beginEdit();
    controller.editValue = 'Beta';
    const result = await controller.commitEdit();

    expect(result).toBe(false);
    expect(controller.editing).toBe(true);
    expect(controller.renameError).toBe('Rename failed: Name already exists.');
  });
});
