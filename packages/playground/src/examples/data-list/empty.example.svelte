<script lang="ts" module>
  export const title = 'Empty state fallback';
  export const description = 'The empty snippet renders when items is an empty array.';
</script>

<script lang="ts">
  import { DataList } from '../../../../components/src/index.ts';
</script>

<DataList items={[]}>
  {#snippet children(item)}
    <span>{item}</span>
  {/snippet}
  {#snippet empty()}
    <p style="color: var(--cinder-text-muted); font-style: italic;">No items to display.</p>
  {/snippet}
</DataList>
