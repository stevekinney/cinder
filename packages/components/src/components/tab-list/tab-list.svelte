<script lang="ts" module>
  export type { TabListProps } from './tab-list.types.ts';
</script>

<script lang="ts">
  import type { TabListProps } from './tab-list.types.ts';
  import { getContext } from 'svelte';

  import { TABS_CONTEXT_KEY, type TabsContext } from '../tabs.svelte';
  import { cn } from '../../utilities/class-names.ts';

  let { label, labelledBy, class: className, children }: TabListProps = $props();

  const rawTabs = getContext<TabsContext | undefined>(TABS_CONTEXT_KEY);
  if (!rawTabs) {
    throw new Error('TabList must be used inside a Tabs component.');
  }
  const tabs: TabsContext = rawTabs;
</script>

<div
  role="tablist"
  class={cn('cinder-tab-list', className)}
  data-cinder-orientation={tabs.orientation}
  aria-label={label}
  aria-labelledby={labelledBy}
  aria-orientation={tabs.orientation}
>
  {@render children()}
</div>
