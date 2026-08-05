<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Single selectable tab trigger inside a tabs composite that registers with the parent context and controls a matching tab-panel or caller-owned panel id.
   * @tag navigation
   * @tag tabs
   * @useWhen Declaring one tab heading inside a tabs ancestor with a stable value identifier.
   * @useWhen Pairing one-to-one with a tab-panel that shares the same value to wire aria-controls.
   * @useWhen Pointing multiple tab triggers at a caller-owned panel with the controls prop.
   * @avoidWhen Used outside a tabs ancestor — the component throws at construction.
   * @avoidWhen Rendering a generic action button — use button instead.
   * @related tabs, tab-list, tab-panel
   */
  // `Tab.value` is treated as immutable after mount. The component reads
  // `value` via `untrack` at the top-level registration call and inside
  // every registration-related effect so that changing `value` at runtime
  // does not re-key the parent registry. Mutating `value` after mount is
  // unsupported and will leave the registry in a stale state.
  export type { TabProps } from './tab.types.ts';
</script>

<script lang="ts">
  import type { TabProps } from './tab.types.ts';
  import { untrack } from 'svelte';

  import { rovingTabIndex } from '../../_internal/collection.ts';
  import { getTabsContext } from '../tabs/tabs-context.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    value,
    id,
    controls,
    disabled = false,
    class: className,
    children,
    trailing,
  }: TabProps = $props();

  const tabs = getTabsContext();

  // Derive both ids from the root's baseId and the tab's value so that two
  // Tabs instances sharing the same value produce distinct DOM ids. The default
  // panel id does not track a custom `id` prop on this Tab. `controls` can
  // intentionally override the controlled panel id for caller-owned panels.
  //
  // ⚠️  Custom-id wiring: if you supply a custom `id` prop to override this
  // Tab's element id, the paired TabPanel's default `aria-labelledby` still
  // points at the baseId-derived id (e.g. `${baseId}-tab-${value}`), which no
  // longer matches the button's id. Close the gap by passing the SAME custom id
  // to the paired TabPanel's `ariaLabelledby` prop. Removing the custom `id`
  // override restores fully automatic wiring.
  const tabId = $derived(id ?? `${tabs.baseId}-tab-${value}`);
  const panelId = $derived.by(() => {
    // Caller-owned panels can provide a non-empty aria-controls override.
    const controlsId = controls?.trim();
    return controlsId ? controlsId : `${tabs.baseId}-panel-${value}`;
  });

  const isActive = $derived(tabs.isActive(value));
  const isFocusable = $derived(tabs.isFocusable(value));

  let buttonElement: HTMLButtonElement | undefined = $state();

  // Capture the registry key once. `Tab.value` is treated as immutable after
  // mount (see module-level note above); reading it via `untrack` here makes
  // the immutability mechanical — even if a consumer mutates the prop, the
  // registry keeps using the original key for registration, setDisabled, and
  // unregister, so the registry never drifts into an inconsistent state.
  const registeredValue = untrack(() => value);

  // Synchronous, top-level order registration — runs as part of this
  // component's own script execution, before this (or any sibling's)
  // `isFocusable` $derived is ever read. This is what makes SSR able to
  // compute the right tab stop: `registerOrder` mutates `tabs`' reactive
  // `version` state from inside the currently-running component's own
  // block-effect reaction, which Svelte's `state_unsafe_mutation` guard
  // would otherwise reject, so the call itself (not just the `disabled`
  // read) is wrapped in `untrack`.
  untrack(() => {
    tabs.registerOrder(registeredValue, disabled);
  });

  // Effect A — mount/unmount button attachment. Depends only on
  // `buttonElement`. `registerOrder` is idempotent, so calling it again here
  // is a no-op on the common path; it exists to make the effect body
  // rerun-safe: `$effect` cleanup runs both on unmount and before every
  // rerun of the same effect, and the cleanup below deletes this Tab's
  // entire registry entry (including the order info the top-level call
  // above set). If this effect ever reran instead of only unmounting, a
  // bare `attachButton` call would attach to a now-missing entry and this
  // Tab would silently lose its tab stop for good. Calling `registerOrder`
  // first always restores the order entry before attaching the button. The
  // mutation calls themselves are wrapped in `untrack` because
  // `registerOrder` and `unregister` write to a reactive `version` counter;
  // reading that inside an effect would self-trigger.
  $effect(() => {
    if (!buttonElement) return;
    const button = buttonElement;
    untrack(() => {
      tabs.registerOrder(registeredValue, disabled);
      tabs.attachButton(registeredValue, button);
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
  // `setDisabled` is a safe no-op when called before `registerOrder` has run.
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
