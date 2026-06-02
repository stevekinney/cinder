<script lang="ts" module>
  export const title = 'Basic data list';
  export const description =
    'A list of homogeneous records. DataList is the semantic `<ul role="list">` container; each row is a StackedListItem with a title and trailing meta. Row chrome (padding, dividers, density) is owned by the row, so content stays compactly aligned instead of stretching to the viewport edges.';
</script>

<script lang="ts">
  import { DataList } from 'cinder/data-list';
  import { StackedListItem } from 'cinder/stacked-list-item';

  const members = [
    { id: 'alice', name: 'Alice Chen', role: 'Engineer', status: 'Active' },
    { id: 'bob', name: 'Bob Osei', role: 'Designer', status: 'Active' },
    { id: 'carol', name: 'Carol Mwangi', role: 'Product', status: 'Invited' },
  ];
</script>

<DataList items={members} key={(m) => m.id}>
  {#snippet children(member)}
    <StackedListItem>
      {#snippet title()}{member.name}{/snippet}
      {#snippet meta()}{member.role} · {member.status}{/snippet}
    </StackedListItem>
  {/snippet}
</DataList>
