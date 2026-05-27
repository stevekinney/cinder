<script lang="ts" module>
  export const title = 'Basic data list';
  export const description = 'Renders each item using the parameterized children snippet.';
</script>

<script lang="ts">
  import { Cluster } from 'cinder/cluster';
  import { DataList } from 'cinder/data-list';

  const users = [
    { name: 'Alice Chen', role: 'Engineer' },
    { name: 'Bob Osei', role: 'Designer' },
    { name: 'Carol Mwangi', role: 'Product' },
  ];
</script>

<DataList items={users}>
  {#snippet children(user)}
    <Cluster justify="space-between">
      <strong>{user.name}</strong>
      <span style="color: var(--cinder-text-muted);">{user.role}</span>
    </Cluster>
  {/snippet}
</DataList>
