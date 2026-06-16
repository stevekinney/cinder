<script lang="ts" module>
  export const title = 'Clearable search field';
  export const description = 'Search input with an initial value so the clear button is visible.';
</script>

<script lang="ts">
  import { SearchField } from '@lostgradient/cinder/search-field';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);
</script>

<SearchField
  id={fieldId}
  aria-label="Search components"
  defaultValue="cinder"
  placeholder="Filter by name"
/>
