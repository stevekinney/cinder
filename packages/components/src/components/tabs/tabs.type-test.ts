/**
 * Compile-time regression tests for the `Tabs` compound-component namespace.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that the `Object.assign` namespace members resolve and stay
 * correctly typed WITHOUT a hand-maintained `as typeof Root & { ... }` cast.
 * If a member is renamed in the `Object.assign` literal (e.g. `Trigger` →
 * `Tab`), the `satisfies` assertions below stop compiling — surfacing the
 * drift as a type error instead of silently keeping the old declared type.
 */
import type { Component } from 'svelte';

import TabList from '../tab-list/tab-list.svelte';
import TabPanel from '../tab-panel/tab-panel.svelte';
import Tab from '../tab/tab.svelte';
import { Tabs } from './index.ts';

// Each namespace member must resolve and be exactly its source component type.
const _list: typeof TabList = Tabs.List;
const _trigger: typeof Tab = Tabs.Trigger;
const _panel: typeof TabPanel = Tabs.Panel;

// The root remains callable as a component (the `Object.assign` target).
Tabs satisfies Component<never>;

void _list;
void _trigger;
void _panel;
