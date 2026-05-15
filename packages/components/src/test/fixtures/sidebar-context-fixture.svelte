<script lang="ts">
  import Sidebar from '../../components/sidebar.svelte';
  import Probe from './sidebar-context-probe.svelte';

  type Props = { collapsed?: boolean };
  let { collapsed = false }: Props = $props();
</script>

<Sidebar {collapsed}>
  {#snippet navigation()}
    <ul>
      <li>
        <Probe />
      </li>
    </ul>
  {/snippet}
</Sidebar>
