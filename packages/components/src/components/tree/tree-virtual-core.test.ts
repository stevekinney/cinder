import { describe, expect, test } from 'bun:test';

import {
  descendantTreeDataIds,
  flattenTreeDataItems,
  visibleTreeDataItems,
  type TreeDataItem,
} from '../../_internal/tree-data.ts';

const items: readonly TreeDataItem[] = [
  {
    id: 'projects',
    label: 'Projects',
    children: [
      { id: 'apollo', label: 'Apollo' },
      { id: 'zeus', label: 'Zeus' },
    ],
  },
  {
    id: 'archive',
    label: 'Archive',
    children: [{ id: 'old-apollo', label: 'Old Apollo' }],
  },
];

describe('Tree virtual data model', () => {
  test('flattens the full tree with full-sibling aria metadata', () => {
    const flattened = flattenTreeDataItems(items);
    expect(flattened.map((item) => item.id)).toEqual([
      'projects',
      'apollo',
      'zeus',
      'archive',
      'old-apollo',
    ]);
    expect(flattened.find((item) => item.id === 'projects')).toMatchObject({
      level: 1,
      posInSet: 1,
      setSize: 2,
      branch: true,
    });
    expect(flattened.find((item) => item.id === 'zeus')).toMatchObject({
      level: 2,
      posInSet: 2,
      setSize: 2,
      parentId: 'projects',
    });
  });

  test('visible items respect expansion without losing full metadata', () => {
    const flattened = flattenTreeDataItems(items);
    const visible = visibleTreeDataItems(flattened, ['projects']);
    expect(visible.map((item) => item.id)).toEqual(['projects', 'apollo', 'zeus', 'archive']);
    expect(visible.find((item) => item.id === 'zeus')?.posInSet).toBe(2);
    expect(visible.find((item) => item.id === 'zeus')?.setSize).toBe(2);
  });

  test('filtering retains matches and ancestors only', () => {
    const flattened = flattenTreeDataItems(items);
    const visible = visibleTreeDataItems(flattened, [], (item) =>
      item.label.toLowerCase().includes('old'),
    );
    expect(visible.map((item) => item.id)).toEqual(['archive', 'old-apollo']);
  });

  test('descendant ids are stable for cascade operations', () => {
    const flattened = flattenTreeDataItems(items);
    expect(descendantTreeDataIds(flattened, 'projects')).toEqual(['apollo', 'zeus']);
    expect(descendantTreeDataIds(flattened, 'missing')).toEqual([]);
  });
});
