<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TabListProps = {
    /** Optional accessible name for the tablist. Sets `aria-label`. */
    label?: string;
    /** Reference to a heading or label element that names the tablist. */
    labelledBy?: string;
    /** Additional class names merged with `.cinder-tab-list`. */
    class?: string;
    /** Tab children. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { getContext } from 'svelte';

  import { TABS_CONTEXT_KEY, type TabsContext } from './tabs.svelte';
  import { cn } from '../utilities/class-names.ts';

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
