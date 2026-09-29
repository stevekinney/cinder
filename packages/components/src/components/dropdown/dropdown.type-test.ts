/**
 * Compile-time regression tests for the `Dropdown` compound-component namespace.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that the `Object.assign` namespace members resolve and stay
 * correctly typed WITHOUT a hand-maintained `as typeof Root & { ... }` cast.
 * If a member is renamed in the `Object.assign` literal, the assignments below
 * stop compiling — surfacing the drift as a type error instead of silently
 * keeping the old declared type.
 */
import type { Component } from 'svelte';

import DropdownGroup from '../dropdown-group/dropdown-group.svelte';
import DropdownItem from '../dropdown-item/dropdown-item.svelte';
import DropdownLabel from '../dropdown-label/dropdown-label.svelte';
import DropdownMenu from '../dropdown-menu/dropdown-menu.svelte';
import DropdownSeparator from '../dropdown-separator/dropdown-separator.svelte';
import DropdownTrigger from '../dropdown-trigger/dropdown-trigger.svelte';
import { Dropdown } from './index.ts';

const trigger: typeof DropdownTrigger = Dropdown.Trigger;
const menu: typeof DropdownMenu = Dropdown.Menu;
const item: typeof DropdownItem = Dropdown.Item;
const label: typeof DropdownLabel = Dropdown.Label;
const separator: typeof DropdownSeparator = Dropdown.Separator;
const group: typeof DropdownGroup = Dropdown.Group;

Dropdown satisfies Component<never>;

void trigger;
void menu;
void item;
void label;
void separator;
void group;
