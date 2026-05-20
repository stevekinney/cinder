<script lang="ts" module>
  export const title = 'Basic data list';
  export const description = 'Renders each item using the parameterized children snippet.';
</script>

<script lang="ts">
  import { DataList } from 'cinder/data-list';
  const users = [
    { name: 'Alice Chen', role: 'Engineer' },
    { name: 'Bob Osei', role: 'Designer' },
    { name: 'Carol Mwangi', role: 'Product' },
  ];
</script>

<DataList items={users}>
  {#snippet children(user)}
    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
      <strong>{user.name}</strong>
      <span style="color: var(--cinder-text-muted);">{user.role}</span>
    </div>
  {/snippet}
</DataList>
