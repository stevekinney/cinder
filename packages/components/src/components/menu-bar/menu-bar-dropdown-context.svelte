<script lang="ts">
  import type { Snippet } from 'svelte';
  import { setContext, untrack } from 'svelte';

  import {
    DROPDOWN_CONTEXT,
    DROPDOWN_REGISTER,
    DROPDOWN_REGISTER_TRIGGER,
    DROPDOWN_SET_OPEN,
  } from '../dropdown/dropdown.context.ts';
  import type { DropdownContext } from '../dropdown/dropdown.types.ts';

  type Props = {
    context: DropdownContext;
    registerMenu: (element: HTMLElement | null) => void;
    registerTrigger: (element: HTMLElement | null) => void;
    setOpen: (open: boolean) => void;
    children: Snippet;
  };

  const { context, registerMenu, registerTrigger, setOpen, children }: Props = $props();

  // Context is established once at setup; read the bridge values untracked so
  // they are not treated as reactive dependencies.
  setContext(
    DROPDOWN_CONTEXT,
    untrack(() => context),
  );
  setContext(
    DROPDOWN_REGISTER,
    untrack(() => registerMenu),
  );
  setContext(
    DROPDOWN_REGISTER_TRIGGER,
    untrack(() => registerTrigger),
  );
  setContext(
    DROPDOWN_SET_OPEN,
    untrack(() => setOpen),
  );
</script>

{@render children()}
