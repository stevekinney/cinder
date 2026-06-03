<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Content region inside a tabs composite that becomes visible when its sibling tab with the matching value is active.
   * @tag navigation
   * @tag tabs
   * @useWhen Hosting the body content associated with a specific tab inside a tabs ancestor.
   * @useWhen Letting the tabs context drive aria-labelledby and visibility automatically from the shared value.
   * @avoidWhen Used outside a tabs ancestor — the component throws at construction.
   * @avoidWhen Rendering the tab trigger itself — use tab inside a tab-list.
   * @related tabs, tab, tab-list
   */
  export type { TabPanelProps } from './tab-panel.types.ts';
</script>

<script lang="ts">
  import type { TabPanelProps } from './tab-panel.types.ts';

  import { getTabsContext } from '../tabs/tabs-context.ts';
  import { cn } from '../../utilities/class-names.ts';

  let { value, class: className, children }: TabPanelProps = $props();

  const tabs = getTabsContext();

  const isActive = $derived(tabs.isActive(value));
  // Both ids are derived from the root's baseId and this panel's value so
  // that two Tabs instances sharing the same value produce distinct DOM ids.
  // This mirrors the pattern in tab.svelte; the root Tabs provides `baseId`
  // via context to namespace every Tab/TabPanel pair it owns.
  const panelId = $derived(`${tabs.baseId}-panel-${value}`);
  const labelledBy = $derived(`${tabs.baseId}-tab-${value}`);
</script>

{#if isActive}
  <div
    id={panelId}
    role="tabpanel"
    class={cn('cinder-tab-panel', className)}
    data-cinder-value={value}
    aria-labelledby={labelledBy}
    tabindex="0"
  >
    {@render children()}
  </div>
{/if}
