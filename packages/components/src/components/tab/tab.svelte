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
  import { getContext, untrack } from 'svelte';

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
  const tabId = id ?? `cinder-tab-${value}`;
  const panelId = `cinder-tab-panel-${value}`;

  const isActive = $derived(tabs.isActive(value));

  let buttonElement: HTMLButtonElement | undefined = $state();

  // Register the tab once when its button element becomes defined and
  // unregister on unmount. `value` is treated as stable for this tab's
  // lifetime (it is the identity key used by the parent's Map and the
  // recommended key for keyed `{#each}` blocks); reading it via `untrack`
  // ensures that a sibling prop change (e.g., `disabled` toggling) on the
  // same render pass cannot cause Svelte to re-trigger this effect, which
  // would delete and re-insert this tab's key in the parent's Map and
  // move it to the end of the navigation order. If a consumer needs to
  // change a Tab's `value` at runtime they should remount the Tab via a
  // changed key in their `{#each}` block.
  $effect(() => {
    if (!buttonElement) return;
    const currentValue = untrack(() => value);
    const currentButton = buttonElement;
    tabs.register(currentValue, currentButton);
    return () => {
      tabs.unregister(currentValue);
    };
  });

  // Sync disabled state without touching the registry, so flipping `disabled`
  // at runtime preserves navigation order. The cleanup clears the disabled
  // flag explicitly so this effect owns the lifecycle of the disabled bit
  // and stops relying on `unregister`'s incidental cleanup for that.
  $effect(() => {
    tabs.setDisabled(value, disabled);
    return () => {
      tabs.setDisabled(value, false);
    };
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
