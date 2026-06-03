<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Collapsible labelled bucket inside side-navigation that groups related side-navigation-item entries under a single heading.
   * @tag navigation
   * @tag grouping
   * @useWhen Splitting a long side-navigation column into clearly named sections.
   * @useWhen Letting users collapse rarely used groups to reduce visual noise in the sidebar.
   * @avoidWhen Used outside a side-navigation ancestor — it expects that landmark for context.
   * @avoidWhen Hosting a single flat list with no grouping — place side-navigation-item entries directly.
   * @related side-navigation, side-navigation-item
   */
  export type { SideNavigationGroupProps } from './side-navigation-group.types.ts';
</script>

<script lang="ts">
  import type { SideNavigationGroupProps } from './side-navigation-group.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import {
    setSideNavigationGroupContext,
    tryGetSideNavigationGroupContext,
    type SideNavigationGroupRegistration,
  } from '../_internal/side-navigation-group-context.ts';

  let {
    label,
    id: idProp,
    expanded = $bindable(true),
    disabled = false,
    icon,
    badge,
    class: className,
    children,
    ...rest
  }: SideNavigationGroupProps = $props();

  const generatedId = $props.id();
  const id = $derived(idProp ?? generatedId);

  const validatedLabel = $derived.by(() => {
    if (label.trim() === '') {
      throw new Error('SideNavigationGroup requires a non-empty label.');
    }
    return label;
  });
  const headerId = $derived(`${id}-trigger`);
  const panelId = $derived(`${id}-panel`);

  function toggle(): void {
    if (disabled) return;
    expanded = !expanded;
  }

  // Bubble active state from descendant items up to the trigger. The group is
  // "contains-active" when any registered child reports itself active.
  let activeCount = $state(0);
  const containsActive = $derived(activeCount > 0);

  function register(): SideNavigationGroupRegistration {
    let wasActive = false;
    let unregistered = false;
    return {
      setActive(active: boolean) {
        if (unregistered || active === wasActive) return;
        wasActive = active;
        activeCount += active ? 1 : -1;
      },
      unregister() {
        if (unregistered) return; // idempotent — never double-decrement
        unregistered = true;
        if (wasActive) activeCount -= 1;
      },
    };
  }

  const parentGroup = tryGetSideNavigationGroupContext();
  let parentHandle: SideNavigationGroupRegistration | undefined;

  $effect(() => {
    if (!parentGroup) return;
    parentHandle = parentGroup.register();
    return () => {
      parentHandle?.unregister();
      parentHandle = undefined;
    };
  });

  $effect(() => {
    parentHandle?.setActive(containsActive);
  });

  setSideNavigationGroupContext({ register });
</script>

<li
  {...rest}
  {id}
  class={classNames('cinder-side-navigation-group', className)}
  data-cinder-expanded={expanded ? '' : undefined}
  data-cinder-contains-active={containsActive ? '' : undefined}
>
  <button
    type="button"
    id={headerId}
    class="cinder-side-navigation-group__trigger"
    aria-expanded={expanded}
    aria-controls={panelId}
    {disabled}
    onclick={toggle}
  >
    {#if icon}
      <span class="cinder-side-navigation-group__icon" aria-hidden="true">{@render icon()}</span>
    {/if}
    <span class="cinder-side-navigation-group__label">{validatedLabel}</span>
    {#if badge}
      <span class="cinder-side-navigation-group__badge">{@render badge()}</span>
    {/if}
    <svg
      class="cinder-side-navigation-group__chevron"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill-rule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
        clip-rule="evenodd"
      />
    </svg>
  </button>
  <ul
    id={panelId}
    class="cinder-side-navigation-group__panel"
    aria-labelledby={headerId}
    hidden={!expanded}
  >
    {@render children()}
  </ul>
</li>
