import { describe, expect, mock, test } from 'bun:test';

import {
  moveTreeNode,
  TreeDragController,
  type TreeMoveNode,
} from '../../_internal/tree-drag-controller.svelte.ts';
import type { TreeNodeRegistration } from '../../_internal/tree-registry.svelte.ts';

type Node = TreeMoveNode & { label: string };

const nodes: Node[] = [
  { id: 'a', parentId: null, label: 'A' },
  { id: 'a1', parentId: 'a', label: 'A1' },
  { id: 'a2', parentId: 'a', label: 'A2' },
  { id: 'b', parentId: null, label: 'B' },
  { id: 'c', parentId: null, label: 'C' },
];

function ids(input: readonly Node[]): string[] {
  return input.map((node) => node.id);
}

describe('moveTreeNode', () => {
  test('moves a node before a sibling', () => {
    const result = moveTreeNode(nodes, 'c', { id: 'b', position: 'before' });

    expect(ids(result)).toEqual(['a', 'a1', 'a2', 'c', 'b']);
    expect(result.find((node) => node.id === 'c')?.parentId).toBeNull();
  });

  test('moves a node after a branch subtree', () => {
    const result = moveTreeNode(nodes, 'c', { id: 'a', position: 'after' });

    expect(ids(result)).toEqual(['a', 'a1', 'a2', 'c', 'b']);
  });

  test('moves a node into a branch', () => {
    const result = moveTreeNode(nodes, 'c', { id: 'a', position: 'child' });

    expect(ids(result)).toEqual(['a', 'c', 'a1', 'a2', 'b']);
    expect(result.find((node) => node.id === 'c')?.parentId).toBe('a');
  });

  test('moves a branch with its full subtree', () => {
    const result = moveTreeNode(nodes, 'a', { id: 'c', position: 'after' });

    expect(ids(result)).toEqual(['b', 'c', 'a', 'a1', 'a2']);
    expect(result.find((node) => node.id === 'a1')?.parentId).toBe('a');
  });

  test('rejects moving a branch into its own descendant', () => {
    const result = moveTreeNode(nodes, 'a', { id: 'a1', position: 'child' });

    expect(result).toBe(nodes);
  });

  test('moving an item before its next sibling is a same-position no-op', () => {
    const result = moveTreeNode(nodes, 'a1', { id: 'a2', position: 'before' });

    expect(result).toBe(nodes);
  });

  test('moving an item after itself is a no-op', () => {
    const result = moveTreeNode(nodes, 'b', { id: 'b', position: 'after' });

    expect(result).toBe(nodes);
  });

  test('browser-facing source avoids ES2023 array-copy helpers', async () => {
    const sourcePaths = [
      '../../_internal/chart/chart-cartesian-model.ts',
      '../../_internal/chart/chart-cartesian-series.ts',
      '../../_internal/chart/chart-decimation-gaps.ts',
      '../../_internal/chart/chart-decimation.ts',
      '../../_internal/chart/chart-scale.ts',
      '../../_internal/tree-drag-controller.svelte.ts',
      '../choice-grid/choice-grid.svelte',
      '../data-grid/data-grid.svelte',
      '../json-schema-editor/enum-editor.svelte',
      '../pagination/pagination.svelte',
      '../slider/slider.svelte',
      '../spectrogram/spectrogram.svelte',
      '../speed-dial/speed-dial.svelte',
      '../table-of-contents/table-of-contents-active-heading.svelte.ts',
      '../table/table.fixture.svelte',
      '../virtual-list/_internal/sticky-items.ts',
      '../../convention-structural-test-helpers.ts',
      '../../utilities/focus.ts',
      '../../utilities/use-history.svelte.ts',
    ];

    for (const sourcePath of sourcePaths) {
      const source = await Bun.file(new URL(sourcePath, import.meta.url)).text();
      expect(source, sourcePath).not.toMatch(/\.(?:toSorted|toReversed)\s*\(/);
    }
  });
});

describe('TreeDragController', () => {
  test('moveBy falls back to the lifted item when the active target is no longer visible', () => {
    let visibleIds = ['a', 'b', 'c', 'd'];
    const announcements: string[] = [];
    const controller = new TreeDragController({
      getVisibleIds: () => visibleIds,
      getNode: (id): TreeNodeRegistration => ({
        id,
        parentId: null,
        level: 1,
        node: document.createElement('div'),
        disabled: false,
        isBranch: () => false,
        label: () => id.toUpperCase(),
        focus: () => {},
      }),
      getParentId: () => null,
      isBranch: () => false,
      focus: mock(),
      announce: (message) => announcements.push(message),
      commit: mock(),
    });

    controller.lift('b', 'keyboard');
    controller.setDropTarget({ id: 'c', position: 'after' });
    visibleIds = ['a', 'b', 'd'];

    controller.moveBy(-1);

    expect(controller.dropTarget).toEqual({ id: 'a', position: 'before' });
    expect(announcements.at(-1)).toContain('moved before A');
  });
});
