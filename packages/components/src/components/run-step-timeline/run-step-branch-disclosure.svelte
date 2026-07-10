<script lang="ts">
  import type { Snippet } from 'svelte';
  import Collapsible from '../collapsible/collapsible.svelte';
  import type { CollapsibleTriggerState } from '../collapsible/collapsible.types.ts';

  let {
    initialOpen,
    triggerAriaLabel,
    class: className,
    trigger,
    children,
  }: {
    /** The auto-open decision, read once when the group first mounts. */
    initialOpen: boolean;
    /** Accessible name forwarded to the collapsible trigger button. */
    triggerAriaLabel: string;
    /** Classes merged onto the collapsible root. */
    class: string;
    /** Trigger heading content. */
    trigger: string | Snippet<[CollapsibleTriggerState]>;
    /** The lane list revealed when the group is open. */
    children: Snippet;
  } = $props();

  // Seed the disclosure state exactly once, from the group's initial auto-open
  // decision. Binding `open` directly to a value derived from live step status
  // (the collapsible seeds *and* re-syncs from an un-`bind:`-ed `open` prop) would
  // slam the group shut the moment its active lane finished — overriding the
  // reader's own toggle. Owning the state locally via `bind:open` keeps
  // `collapsed`/`collapseThreshold` as documented *initial* behavior while leaving
  // the group freely user-togglable for the rest of its life.
  let open = $state(initialOpen);
</script>

<Collapsible bind:open {trigger} {triggerAriaLabel} class={className}>
  {@render children()}
</Collapsible>
