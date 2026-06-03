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
  import { untrack } from 'svelte';

  import { rovingTabIndex } from '../../_internal/collection.ts';
  import { getTabsContext } from '../tabs/tabs-context.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { value, id, disabled = false, class: className, children, trailing }: TabProps = $props();

  const tabs = getTabsContext();

  // Derive both ids from the root's baseId and the tab's value so that two
  // Tabs instances sharing the same value produce distinct DOM ids. The panel
  // id is always computed from baseId and value; it does not track a custom
  // `id` prop on this Tab.
  //
  // ⚠️  Custom-id wiring: if you supply a custom `id` prop to override this
  // Tab's element id, the paired TabPanel's default `aria-labelledby` still
  // points at the baseId-derived id (e.g. `${baseId}-tab-${value}`), which no
  // longer matches the button's id. Close the gap by passing the SAME custom id
  // to the paired TabPanel's `ariaLabelledby` prop. Removing the custom `id`
  // override restores fully automatic wiring.
  const tabId = $derived(id ?? `${tabs.baseId}-tab-${value}`);
  const panelId = $derived(`${tabs.baseId}-panel-${value}`);

  const isActive = $derived(tabs.isActive(value));
  const isFocusable = $derived(tabs.isFocusable(value));

  let buttonElement: HTMLButtonElement | undefined = $state();

  // Capture the registry key once. `Tab.value` is treated as immutable after
  // mount (see module-level note above); reading it via `untrack` here makes
  // the immutability mechanical — even if a consumer mutates the prop, the
  // registry keeps using the original key for register, setDisabled, and
  // unregister, so the registry never drifts into an inconsistent state.
  const registeredValue = untrack(() => value);

  // Effect A — mount/unmount registration. Depends only on `buttonElement`.
  // The initial `disabled` is seeded into the registry on mount so first
  // paint computes the right tab stop without waiting for Effect B. The
  // mutation calls themselves are wrapped in `untrack` because `register`
  // and `unregister` write to a reactive `version` counter; reading that
  // inside an effect would self-trigger.
  $effect(() => {
    if (!buttonElement) return;
    const button = buttonElement;
    const initialDisabled = untrack(() => disabled);
    untrack(() => {
      tabs.register(registeredValue, button, initialDisabled);
    });
    return () => {
      untrack(() => {
        tabs.unregister(registeredValue);
      });
    };
  });

  // Effect B — sync subsequent `disabled` prop changes to the registry
  // without re-registering. Subscribes only to `disabled`; the mutation
  // call is wrapped in `untrack` for the same reason as Effect A.
  // `setDisabled` is a safe no-op when called before `register` has run.
  $effect(() => {
    const next = disabled;
    untrack(() => {
      tabs.setDisabled(registeredValue, next);
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
  data-variant={tabs.orientation}
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
