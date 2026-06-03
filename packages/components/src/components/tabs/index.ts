import TabList from '../tab-list/tab-list.svelte';
import TabPanel from '../tab-panel/tab-panel.svelte';
import Tab from '../tab/tab.svelte';
import './tabs.css';
import TabsRoot from './tabs.svelte';

/**
 * `Tabs` is the parent compound component. It is also a namespace whose
 * properties expose the compose-only leaves under their idiomatic names:
 * `Tabs.List`, `Tabs.Trigger`, and `Tabs.Panel`. The leaves remain importable
 * individually from `cinder/tab-list`, `cinder/tab`, and `cinder/tab-panel`.
 */
const Tabs = Object.assign(TabsRoot, {
  List: TabList,
  Trigger: Tab,
  Panel: TabPanel,
});

export default Tabs;
export type { TabsContext, TabsOrientation, TabsProps } from './tabs.types.ts';
export { Tabs };
