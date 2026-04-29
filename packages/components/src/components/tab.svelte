<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TabProps = {
    /** Identifier — matches the value of the corresponding TabPanel. */
    value: string;
    /** Optional explicit id override; auto-generated otherwise for ARIA wiring. */
    id?: string;
    /** Disables this single tab. The panel content is hidden but its DOM stays. */
    disabled?: boolean;
    /** Additional class names merged with `.cinder-tab`. */
    class?: string;
    /** Tab label content. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { getContext, onDestroy } from 'svelte';

  import { rovingTabIndex } from '../_internal/collection.ts';
  import { TABS_CONTEXT_KEY, type TabsContext } from './tabs.svelte';
  import { cn } from '../utilities/class-names.ts';

  let { value, id, disabled = false, class: className, children }: TabProps = $props();

  const rawTabs = getContext<TabsContext | undefined>(TABS_CONTEXT_KEY);
  if (!rawTabs) {
    throw new Error('Tab must be used inside a Tabs component.');
  }
  const tabs: TabsContext = rawTabs;

  // Derive both ids from `value` so TabPanel can independently compute the
  // same id without coordinating through context. Consumers can still override
  // the tab id via the `id` prop; the panel id stays deterministic.
  const tabId = id ?? `cinder-tab-${value}`;
  const panelId = `cinder-tab-panel-${value}`;

  const isActive = $derived(tabs.isActive(value));

  let buttonElement: HTMLButtonElement | undefined = $state();

  // Register on mount and re-register if the button element changes; unregister
  // on unmount so the parent's navigation order stays accurate.
  $effect(() => {
    if (buttonElement) {
      tabs.register(value, buttonElement);
    }
    return () => {
      tabs.unregister(value);
    };
  });

  onDestroy(() => {
    tabs.unregister(value);
  });

  function handleClick(): void {
    if (disabled) return;
    tabs.select(value);
  }
</script>

<button
  bind:this={buttonElement}
  type="button"
  role="tab"
  id={tabId}
  class={cn('cinder-tab', className)}
  data-cinder-value={value}
  data-cinder-active={isActive ? '' : undefined}
  data-cinder-disabled={disabled || undefined}
  aria-selected={isActive}
  aria-controls={panelId}
  tabindex={rovingTabIndex(isActive)}
  {disabled}
  onclick={handleClick}
  onkeydown={tabs.handleKeydown}
>
  {@render children()}
</button>
