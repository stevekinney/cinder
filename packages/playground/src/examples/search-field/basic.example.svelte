<script lang="ts" module>
  export const title = 'Clearable search field';
  export const description = 'Search input with an initial value so the clear button is visible.';
</script>

<script lang="ts">
  import { SearchField } from '@lostgradient/cinder/search-field';
</script>

<SearchField
  id="search-field-basic"
  aria-label="Search components"
  defaultValue="cinder"
  placeholder="Filter by name"
/>
