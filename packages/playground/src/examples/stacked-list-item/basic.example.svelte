<script lang="ts" module>
  export const title = 'Basic row';
  export const description =
    'A minimal StackedListItem with the required `title` snippet and a `meta` snippet, mounted inside the DataList container it is designed to compose with.';
</script>

<script lang="ts">
  import { DataList } from '@lostgradient/cinder/data-list';
  import { StackedListItem } from '@lostgradient/cinder/stacked-list-item';

  const members = [
    { id: 'alice', name: 'Alice Chen', role: 'Engineer' },
    { id: 'bob', name: 'Bob Osei', role: 'Designer' },
    { id: 'carol', name: 'Carol Mwangi', role: 'Product' },
  ];
</script>

<DataList items={members} key={(member) => member.id}>
  {#snippet children(member)}
    <StackedListItem>
      {#snippet title()}{member.name}{/snippet}
      {#snippet meta()}{member.role}{/snippet}
    </StackedListItem>
  {/snippet}
</DataList>
