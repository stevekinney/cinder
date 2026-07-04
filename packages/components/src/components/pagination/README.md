# Pagination

Page-navigation control for stepping through multi-page result sets.

## Usage

```svelte
<script lang="ts">
  import Pagination from '@lostgradient/cinder/pagination';

  let currentPage = $state(1);
</script>

<Pagination bind:currentPage totalPages={10} />
```

When the total page count is unknown, omit `totalPages` and pass the direction
availability you know:

```svelte
<Pagination
  bind:currentPage
  hasPreviousPage={currentPage > 1}
  hasNextPage={links.next !== undefined}
/>
```

This renders the current page and previous/next controls without implying a
fake final page.

### REST Link headers

```svelte
<script lang="ts">
  import Pagination from '@lostgradient/cinder/pagination';

  let currentPage = $state(1);
  let links = $state<{ prev?: string; next?: string }>({});
</script>

<Pagination
  bind:currentPage
  hasPreviousPage={links.prev !== undefined}
  hasNextPage={links.next !== undefined}
/>
```

### Cursor pagination

```svelte
<script lang="ts">
  import Pagination from '@lostgradient/cinder/pagination';

  let currentPage = $state(1);
  let cursors = $state<{ previous?: string; next?: string }>({});
</script>

<Pagination
  bind:currentPage
  hasPreviousPage={cursors.previous !== undefined}
  hasNextPage={cursors.next !== undefined}
/>
```

## Props

<!-- generated:props:start -->

| Prop              | Type      | Required | Default | Description                                                                                   |
| ----------------- | --------- | -------- | ------- | --------------------------------------------------------------------------------------------- |
| `class`           | `string`  | no       | —       | Custom class merged with `.cinder-pagination`.                                                |
| `currentPage`     | `number`  | yes      | —       | Current page number (1-indexed). Bindable.                                                    |
| `hasNextPage`     | `boolean` | no       | —       | Whether a next page is available when totalPages is unknown. Defaults to false.               |
| `hasPreviousPage` | `boolean` | no       | —       | Whether a previous page is available when totalPages is unknown. Defaults to currentPage > 1. |
| `totalCount`      | `number`  | no       | —       | Optional total record count; formatted with formatNumber when provided.                       |
| `totalPages`      | `number`  | no       | —       | Total number of pages. Omit when only previous/next availability is known.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
