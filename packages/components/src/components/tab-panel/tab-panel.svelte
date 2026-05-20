<script lang="ts" module>
  export type { TabPanelProps } from './tab-panel.types.ts';
</script>

<script lang="ts">
  import type { TabPanelProps } from './tab-panel.types.ts';
  import { getContext } from 'svelte';

  import { TABS_CONTEXT_KEY, type TabsContext } from '../tabs.svelte';
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
  const panelId = `cinder-tab-panel-${value}`;
  const labelledBy = `cinder-tab-${value}`;
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
