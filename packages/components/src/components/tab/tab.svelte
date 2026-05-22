<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Single selectable tab trigger inside a tabs composite that registers with the parent context and controls a matching tab-panel.
   * @tag navigation
   * @tag tabs
   * @useWhen Declaring one tab heading inside a tabs ancestor with a stable value identifier.
   * @useWhen Pairing one-to-one with a tab-panel that shares the same value to wire aria-controls.
   * @avoidWhen Used outside a tabs ancestor — the component throws at construction.
   * @avoidWhen Rendering a generic action button — use button instead.
   * @related tabs, tab-list, tab-panel
   */
  export type { TabProps } from './tab.types.ts';
</script>

<script lang="ts">
  import type { TabProps } from './tab.types.ts';
  import { getContext } from 'svelte';

  import { rovingTabIndex } from '../../_internal/collection.ts';
  import { TABS_CONTEXT_KEY, type TabsContext } from '../tabs/tabs.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  let { value, id, disabled = false, class: className, children, trailing }: TabProps = $props();

  const rawTabs = getContext<TabsContext | undefined>(TABS_CONTEXT_KEY);
  if (!rawTabs) {
    throw new Error('Tab must be used inside a Tabs component.');
  }
  const tabs: TabsContext = rawTabs;

  // Derive both ids from `value` so TabPanel can independently compute the
  // same id without coordinating through context. Consumers can still override
  // the tab id via the `id` prop; the panel id stays deterministic.
  const tabId = $derived(id ?? `cinder-tab-${value}`);
  const panelId = $derived(`cinder-tab-panel-${value}`);

  const isActive = $derived(tabs.isActive(value));

  let buttonElement: HTMLButtonElement | undefined = $state();

  // Register on mount and re-register if the button element or tab value
  // changes; unregister on unmount so the parent's navigation order stays
  // accurate.
  $effect(() => {
    const registeredValue = value;
    const registeredButton = buttonElement;
    if (!registeredButton) return;

    tabs.register(registeredValue, registeredButton, disabled);
    return () => {
      tabs.unregister(registeredValue);
    };
  });

  $effect(() => {
    const registeredValue = value;
    const registeredButton = buttonElement;
    const registeredDisabled = disabled;
    if (!registeredButton) return;

    tabs.updateDisabledState(registeredValue, registeredDisabled);
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
  class={classNames('cinder-tab', className)}
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
  {#if trailing}
    <span class="cinder-tab__trailing" aria-hidden="true">
      {@render trailing()}
    </span>
  {/if}
</button>
