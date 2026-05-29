/**
 * Compile-time regression tests for the `GridList` compound-component namespace.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that the `Object.assign` namespace members resolve and stay
 * correctly typed WITHOUT a hand-maintained `as typeof Root & { ... }` cast.
 * If a member is renamed in the `Object.assign` literal, the assignment below
 * stops compiling — surfacing the drift as a type error instead of silently
 * keeping the old declared type.
 */
import type { Component } from 'svelte';

import GridListItem from '../grid-list-item/grid-list-item.svelte';
import { GridList } from './index.ts';

const _item: typeof GridListItem = GridList.Item;

GridList satisfies Component<never>;

void _item;
