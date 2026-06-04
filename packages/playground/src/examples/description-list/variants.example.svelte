<script lang="ts" module>
  export const title = 'Description list variants';
  export const description = 'Striped and two-column layout variants.';
</script>

<script lang="ts">
  import { DescriptionList } from '@lostgradient/cinder/description-list';
  import type { DescriptionListItem } from '@lostgradient/cinder/description-list';

  const items: DescriptionListItem[] = [
    { term: 'Repository', definition: '@lostgradient/cinder' },
    { term: 'Language', definition: 'TypeScript' },
    { term: 'Framework', definition: 'Svelte 5' },
    { term: 'Runtime', definition: 'Bun' },
  ];
</script>

<div class="example-preview-column">
  <DescriptionList {items} variant="striped" />
  <DescriptionList {items} variant="two-column" />
</div>
