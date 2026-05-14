<script lang="ts">
  import Popover from '../../components/popover.svelte';

  type Props = { initialOpen?: boolean };
  let { initialOpen = true }: Props = $props();

  let open = $state(initialOpen);
</script>

<div>
  <Popover bind:open>
    {#snippet trigger()}
      <button type="button">Open</button>
    {/snippet}
    <span>content</span>
  </Popover>

  <div data-testid="open-state">{open ? 'open' : 'closed'}</div>
</div>
