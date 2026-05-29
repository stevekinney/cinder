/**
 * Compile-time regression tests for the `SideNavigation` compound-component
 * namespace. svelte-check processes this file; tsc does not (it excludes
 * .svelte imports).
 *
 * These verify that the `Object.assign` namespace members resolve and stay
 * correctly typed WITHOUT a hand-maintained `as typeof Root & { ... }` cast.
 * If a member is renamed in the `Object.assign` literal, the assignments below
 * stop compiling — surfacing the drift as a type error instead of silently
 * keeping the old declared type.
 */
import type { Component } from 'svelte';

import SideNavigationGroup from '../side-navigation-group/side-navigation-group.svelte';
import SideNavigationItem from '../side-navigation-item/side-navigation-item.svelte';
import { SideNavigation } from './index.ts';

const _group: typeof SideNavigationGroup = SideNavigation.Group;
const _item: typeof SideNavigationItem = SideNavigation.Item;

SideNavigation satisfies Component<never>;

void _group;
void _item;
