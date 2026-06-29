# TableOfContents

On-page heading navigation for long-form content and docs layouts.

## Usage

```svelte
<script lang="ts">
  import TableOfContents from '@lostgradient/cinder/table-of-contents';
</script>

<TableOfContents target="#article-content" />
```

## Props

<!-- generated:props:start -->

| Prop                | Type     | Required | Default | Description                                                              |
| ------------------- | -------- | -------- | ------- | ------------------------------------------------------------------------ |
| `ariaLabel`         | `string` | no       | —       | Accessible name for the nav landmark.                                    |
| `class`             | `string` | no       | —       | Additional class names merged with `.cinder-table-of-contents`.          |
| `headingSelector`   | `string` | no       | —       | CSS selector used to gather headings inside the target element.          |
| `observeRootMargin` | `string` | no       | —       | Root margin passed to IntersectionObserver for active-section detection. |
| `target`            | `string` | no       | —       | CSS selector used to find the target heading container in derived mode.  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-toc-link-active-border-color`
- `--cinder-toc-link-active-color`
- `--cinder-toc-link-border-color`
- `--cinder-toc-link-color`
- `--cinder-toc-link-indent-step`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
