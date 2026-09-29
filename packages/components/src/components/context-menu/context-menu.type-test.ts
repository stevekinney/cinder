/**
 * Compile-time regression tests for the `ContextMenu` compound-component namespace.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that the `Object.assign` namespace members resolve and stay
 * correctly typed WITHOUT a hand-maintained `as typeof Root & { ... }` cast.
 * If a member is renamed in the `Object.assign` literal, the assignments below
 * stop compiling — surfacing the drift as a type error instead of silently
 * keeping the old declared type.
 */
import type { Component } from 'svelte';

import ContextMenuTrigger from '../context-menu-trigger/context-menu-trigger.svelte';
import DropdownGroup from '../dropdown-group/dropdown-group.svelte';
import DropdownItem from '../dropdown-item/dropdown-item.svelte';
import DropdownLabel from '../dropdown-label/dropdown-label.svelte';
import DropdownMenu from '../dropdown-menu/dropdown-menu.svelte';
import DropdownSeparator from '../dropdown-separator/dropdown-separator.svelte';
import { ContextMenu } from './index.ts';

const trigger: typeof ContextMenuTrigger = ContextMenu.Trigger;
const menu: typeof DropdownMenu = ContextMenu.Menu;
const item: typeof DropdownItem = ContextMenu.Item;
const label: typeof DropdownLabel = ContextMenu.Label;
const separator: typeof DropdownSeparator = ContextMenu.Separator;
const group: typeof DropdownGroup = ContextMenu.Group;

ContextMenu satisfies Component<never>;

void trigger;
void menu;
void item;
void label;
void separator;
void group;
