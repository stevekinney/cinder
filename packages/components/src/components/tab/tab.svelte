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
  // `Tab.value` is treated as immutable after mount. The component reads
  // `value` via `untrack` inside both registration effects so that changing
  // `value` at runtime does not re-key the parent registry. Mutating `value`
  // after mount is unsupported and will leave the registry in a stale state.
  export type { TabProps } from './tab.types.ts';
</script>

<script lang="ts">
  import type { TabProps } from './tab.types.ts';
  import { getContext, untrack } from 'svelte';

  import { rovingTabIndex } from '../../_internal/collection.ts';
  import { TABS_CONTEXT_KEY, type TabsContext } from '../tabs/tabs.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    value,
    id,
    disabled = false,
    class: className,
    children,
    trailing,
  }: TabProps = $props();

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
  const isFocusable = $derived(tabs.isFocusable(value));

  let buttonElement: HTMLButtonElement | undefined = $state();

  // Effect A — mount/unmount registration. Depends only on `buttonElement`.
  // Everything else is read via `untrack`, including the registry mutation
  // call: `tabs.register` writes to a reactive `version` counter, and reading
  // that inside an effect would subscribe this effect to it and create a
  // self-triggering loop.
  $effect(() => {
    if (!buttonElement) return;
    const button = buttonElement;
    untrack(() => {
      tabs.register(value, button, disabled);
    });
    return () => {
      untrack(() => {
        tabs.unregister(value);
      });
    };
  });

  // Effect B — sync `disabled` to the registry without re-registering.
  // Subscribes only to `disabled`; the mutation call is wrapped in `untrack`
  // for the same reason as Effect A.
  $effect(() => {
    const next = disabled;
    untrack(() => {
      tabs.setDisabled(value, next);
    });
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
  tabindex={rovingTabIndex(isFocusable)}
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
