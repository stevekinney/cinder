<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Single list-wrapped navigation entry tuned for the vertical layout of side-navigation, delegating rendering to navigation-item.
   * @tag navigation
   * @tag sidebar
   * @useWhen Rendering one entry inside a side-navigation column or side-navigation-group.
   * @useWhen Keeping list semantics correct so screen readers announce sidebar entry counts.
   * @avoidWhen Placing entries in a horizontal navigation-bar — use navigation-item directly.
   * @avoidWhen Rendering outside a side-navigation list — use navigation-item without the list wrapper.
   * @related side-navigation, side-navigation-group, navigation-item
   */
  export type { SideNavigationItemProps } from './side-navigation-item.types.ts';
</script>

<script lang="ts">
  import type { SideNavigationItemProps } from './side-navigation-item.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import NavigationItem from '../navigation-item/navigation-item.svelte';
  import {
    tryGetSideNavigationGroupContext,
    type SideNavigationGroupRegistration,
  } from '../_internal/side-navigation-group-context.ts';

  const props: SideNavigationItemProps = $props();
  const active = $derived(props.active ?? false);
  // Forward everything except listItemClass to NavigationItem.
  const navigationItemProps = $derived.by(() => {
    const { listItemClass: _omit, ...rest } = props;
    return rest;
  });

  // When this item sits inside a SideNavigationGroup, report its active state
  // so the group can light up its trigger. Outside a group the context is
  // undefined and these effects are no-ops.
  const group = tryGetSideNavigationGroupContext();
  let handle: SideNavigationGroupRegistration | undefined;
  // One-time registration: no reactive reads, so it runs exactly once at mount
  // and cleans up once at unmount. Keeping it free of `active` avoids coupling
  // registration to the group's counter writes (which would loop).
  $effect(() => {
    if (!group) return;
    handle = group.register();
    return () => {
      handle?.unregister();
      handle = undefined;
    };
  });
  // Ongoing active reporting. Runs on mount (reporting the initial state) and on
  // every `active` change. `handle` is populated by the registration effect,
  // which Svelte runs first (declaration order) in the same mount flush.
  $effect(() => {
    handle?.setActive(active);
  });
</script>

<li class={classNames('cinder-side-navigation__item', props.listItemClass)}>
  <NavigationItem {...navigationItemProps} variant="vertical" />
</li>
