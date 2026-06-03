<script lang="ts">
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';

  import {
    setDropdownContext,
    setDropdownRegister,
    setDropdownRegisterTrigger,
    setDropdownSetOpen,
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
  setDropdownContext(untrack(() => context));
  setDropdownRegister(untrack(() => registerMenu));
  setDropdownRegisterTrigger(untrack(() => registerTrigger));
  setDropdownSetOpen(untrack(() => setOpen));
</script>

{@render children()}
