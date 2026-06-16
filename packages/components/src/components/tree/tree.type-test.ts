/**
 * Compile-time regression tests for the `Tree` compound-component namespace and
 * TreeProps row-source combinations.
 * svelte-check processes this file as part of the package typecheck.
 */
import type { Component, Snippet } from 'svelte';

import type { TreeDataItem } from '../../_internal/tree-data.ts';
import TreeItem from '../tree-item/tree-item.svelte';
import { Tree } from './index.ts';
import type { TreeProps } from './tree.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const children = null as any as Snippet;
const items: TreeDataItem[] = [{ id: 'alpha', label: 'Alpha' }];

const _item: typeof TreeItem = Tree.Item;

Tree satisfies Component<never>;

const _snippetTree: TreeProps = {
  'aria-label': 'Files',
  children,
};

const _virtualizedTree: TreeProps = {
  'aria-label': 'Files',
  virtualized: true,
  items,
};

// @ts-expect-error - a Tree must provide snippet children or virtualized data items
const _missingRows: TreeProps = {
  'aria-label': 'Files',
};

// @ts-expect-error - virtualized trees require data items
const _virtualizedWithoutItems: TreeProps = {
  'aria-label': 'Files',
  virtualized: true,
};

// @ts-expect-error - snippet children and virtualized data items are mutually exclusive
const _mixedSources: TreeProps = {
  'aria-label': 'Files',
  virtualized: true,
  items,
  children,
};

// @ts-expect-error - data items require the virtualized tree branch
const _itemsWithoutVirtualized: TreeProps = {
  'aria-label': 'Files',
  items,
};

void _snippetTree;
void _virtualizedTree;
void _missingRows;
void _virtualizedWithoutItems;
void _mixedSources;
void _itemsWithoutVirtualized;
void _item;
