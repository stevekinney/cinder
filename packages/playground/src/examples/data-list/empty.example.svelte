<script lang="ts" module>
  export const title = 'Empty state fallback';
  export const description =
    'When items is empty, the empty snippet renders inside a component-owned `<li class="cinder-data-list-empty">` — centered, muted padding, no inline styles required.';
</script>

<script lang="ts">
  import { DataList } from '@lostgradient/cinder/data-list';
  import { StackedListItem } from '@lostgradient/cinder/stacked-list-item';

  const members: { id: string; name: string }[] = [];
</script>

<DataList items={members}>
  {#snippet children(member)}
    <StackedListItem>
      {#snippet title()}{member.name}{/snippet}
    </StackedListItem>
  {/snippet}
  {#snippet empty()}
    No team members yet.
  {/snippet}
</DataList>
