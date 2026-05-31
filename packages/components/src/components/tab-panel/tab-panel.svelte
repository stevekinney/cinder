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
  import { getContext } from 'svelte';

  import { TABS_CONTEXT_KEY, type TabsContext } from '../tabs/tabs.svelte';
  import { cn } from '../../utilities/class-names.ts';

  let { value, class: className, children }: TabPanelProps = $props();

  const rawTabs = getContext<TabsContext | undefined>(TABS_CONTEXT_KEY);
  if (!rawTabs) {
    throw new Error('TabPanel must be used inside a Tabs component.');
  }
  const tabs: TabsContext = rawTabs;

  const isActive = $derived(tabs.isActive(value));
  // Both ids are derived deterministically from `value` so the
  // aria-labelledby relationship works without round-tripping through the
  // parent's registry. Tab uses the same default id pattern unless the
  // consumer supplies a custom `id` prop, in which case the consumer is
  // responsible for setting `aria-labelledby` on their own.
  const panelId = $derived(`cinder-tab-panel-${value}`);
  const labelledBy = $derived(`cinder-tab-${value}`);
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
