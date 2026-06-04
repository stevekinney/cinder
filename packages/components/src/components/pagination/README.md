# Pagination

Page-navigation control for stepping through multi-page result sets.

## Usage

```svelte
<script lang="ts">
  import Pagination from '@lostgradient/cinder/pagination';
</script>

<Pagination />
```

## Props

<!-- generated:props:start -->

| Prop          | Type     | Required | Default | Description                                                             |
| ------------- | -------- | -------- | ------- | ----------------------------------------------------------------------- |
| `class`       | `string` | no       | —       | Custom class merged with `.cinder-pagination`.                          |
| `currentPage` | `number` | yes      | —       | Current page number (1-indexed). Bindable.                              |
| `totalCount`  | `number` | no       | —       | Optional total record count; formatted with formatNumber when provided. |
| `totalPages`  | `number` | yes      | —       | Total number of pages.                                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
