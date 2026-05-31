<script lang="ts">
  import { untrack } from 'svelte';
  import Popover from '../../components/popover/popover.svelte';
  import type { PopoverProps } from '../../components/popover/popover.types.ts';

  type Props = {
    initialOpen?: boolean;
    focusManagement?: PopoverProps['focusManagement'];
    triggerRef?: PopoverProps['triggerRef'];
    wireTriggerAria?: PopoverProps['wireTriggerAria'];
    id?: PopoverProps['id'];
    role?: PopoverProps['role'];
  };
  let {
    initialOpen = true,
    focusManagement,
    triggerRef = null,
    wireTriggerAria,
    id,
    role,
  }: Props = $props();

  let open = $state(untrack(() => initialOpen));

  const popoverProps = $derived({
    ...(focusManagement !== undefined ? { focusManagement } : {}),
    ...(triggerRef !== null ? { triggerRef } : {}),
    ...(wireTriggerAria !== undefined ? { wireTriggerAria } : {}),
    ...(id !== undefined ? { id } : {}),
    ...(role !== undefined ? { role } : {}),
  });
</script>

<div>
  <Popover bind:open {...popoverProps}>
    {#snippet trigger()}
      <button type="button">Open</button>
    {/snippet}
    <span>content</span>
  </Popover>

  <div data-testid="open-state">{open ? 'open' : 'closed'}</div>
</div>
