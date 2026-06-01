<script lang="ts" module>
  export const title = 'Description list';
  export const description = 'Key–value metadata pairs in the default stacked layout.';
</script>

<script lang="ts">
  import { DescriptionList } from 'cinder/description-list';
  import type { DescriptionListItem } from 'cinder/description-list';

  const items: DescriptionListItem[] = [
    { term: 'Component', definition: 'DescriptionList' },
    { term: 'Status', definition: 'Stable' },
    { term: 'Version', definition: '1.0.0' },
    { term: 'License', definition: 'MIT' },
    { term: 'Maintainer', definition: 'Cinder team' },
  ];
</script>

<DescriptionList {items} />
