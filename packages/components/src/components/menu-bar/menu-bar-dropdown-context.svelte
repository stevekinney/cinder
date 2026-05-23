<script lang="ts">
  import type { Snippet } from 'svelte';
  import { setContext } from 'svelte';

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

  setContext(DROPDOWN_CONTEXT, context);
  setContext(DROPDOWN_REGISTER, registerMenu);
  setContext(DROPDOWN_REGISTER_TRIGGER, registerTrigger);
  setContext(DROPDOWN_SET_OPEN, setOpen);
</script>

{@render children()}
