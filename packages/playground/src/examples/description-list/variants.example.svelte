<script lang="ts" module>
  export const title = 'Description list variants';
  export const description = 'Striped and two-column layout variants.';
</script>

<script lang="ts">
  import { DescriptionList } from 'cinder/description-list';
  import type { DescriptionListItem } from 'cinder/description-list';

  const items: DescriptionListItem[] = [
    { term: 'Repository', definition: 'cinder' },
    { term: 'Language', definition: 'TypeScript' },
    { term: 'Framework', definition: 'Svelte 5' },
    { term: 'Runtime', definition: 'Bun' },
  ];
</script>

<div class="example-preview-column">
  <DescriptionList {items} variant="striped" />
  <DescriptionList {items} variant="two-column" />
</div>
