import TabList from '../tab-list/tab-list.svelte';
import TabPanel from '../tab-panel/tab-panel.svelte';
import Tab from '../tab/tab.svelte';
import './tabs.css';
import TabsRoot from './tabs.svelte';

/**
 * `Tabs` is the parent compound component. It is also a namespace whose
 * properties expose the compose-only leaves under their idiomatic names:
 * `Tabs.List`, `Tabs.Trigger`, and `Tabs.Panel`. The leaves remain importable
 * individually from `@lostgradient/cinder/tab-list`, `@lostgradient/cinder/tab`, and `@lostgradient/cinder/tab-panel`.
 */
const Tabs = Object.assign(TabsRoot, {
  List: TabList,
  Trigger: Tab,
  Panel: TabPanel,
});

export default Tabs;
export type { TabListProps } from '../tab-list/tab-list.types.ts';
export type { TabPanelProps } from '../tab-panel/tab-panel.types.ts';
export type { TabProps } from '../tab/tab.types.ts';
export type { TabsContext, TabsOrientation, TabsProps } from './tabs.types.ts';
export { Tab, TabList, TabPanel, Tabs };
