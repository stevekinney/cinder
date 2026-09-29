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

declare const children: Snippet;
const items: TreeDataItem[] = [{ id: 'alpha', label: 'Alpha' }];

const item: typeof TreeItem = Tree.Item;

Tree satisfies Component<never>;

const snippetTree: TreeProps = {
  'aria-label': 'Files',
  children,
};

const virtualizedTree: TreeProps = {
  'aria-label': 'Files',
  virtualized: true,
  items,
};

// @ts-expect-error - a Tree must provide snippet children or virtualized data items
const missingRows: TreeProps = {
  'aria-label': 'Files',
};

// @ts-expect-error - virtualized trees require data items
const virtualizedWithoutItems: TreeProps = {
  'aria-label': 'Files',
  virtualized: true,
};

// @ts-expect-error - snippet children and virtualized data items are mutually exclusive
const mixedSources: TreeProps = {
  'aria-label': 'Files',
  virtualized: true,
  items,
  children,
};

// @ts-expect-error - data items require the virtualized tree branch
const itemsWithoutVirtualized: TreeProps = {
  'aria-label': 'Files',
  items,
};

void snippetTree;
void virtualizedTree;
void missingRows;
void virtualizedWithoutItems;
void mixedSources;
void itemsWithoutVirtualized;
void item;
