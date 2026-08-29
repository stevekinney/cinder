<script lang="ts">
  import SettingRow from './setting-row.svelte';
  import Input from '../input/input.svelte';
</script>

<SettingRow id="setting" label="Setting" managed={{ by: 'Admin', reason: 'Organization policy' }}>
  {#snippet control()}<Input id="setting" value="" />{/snippet}
</SettingRow>
