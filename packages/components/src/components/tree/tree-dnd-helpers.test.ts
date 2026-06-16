import { describe, expect, test } from 'bun:test';

import { moveTreeNode, type TreeMoveNode } from '../../_internal/tree-drag-controller.svelte.ts';

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

  test('drag controller avoids ES2023 array reversal helpers', async () => {
    const source = await Bun.file(
      new URL('../../_internal/tree-drag-controller.svelte.ts', import.meta.url),
    ).text();

    expect(source).not.toContain('.toReversed(');
  });
});
