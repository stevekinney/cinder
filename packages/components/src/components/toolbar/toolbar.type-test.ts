/**
 * Compile-time regression tests for the `Toolbar` compound-component namespace.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that the `Object.assign` namespace members resolve and stay
 * correctly typed WITHOUT a hand-maintained `as typeof Root & { ... }` cast.
 * If a member is renamed in the `Object.assign` literal, the assignments below
 * stop compiling — surfacing the drift as a type error instead of silently
 * keeping the old declared type.
 */
import type { Component } from 'svelte';

import { Toolbar } from './index.ts';
import ToolbarGroup from './toolbar-group.svelte';
import ToolbarSpacer from './toolbar-spacer.svelte';

const _group: typeof ToolbarGroup = Toolbar.Group;
const _spacer: typeof ToolbarSpacer = Toolbar.Spacer;

Toolbar satisfies Component<never>;

void _group;
void _spacer;
