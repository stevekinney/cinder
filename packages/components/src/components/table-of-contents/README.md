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

| Prop                | Type       | Required | Default           | Description                                                                                                               |
| ------------------- | ---------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel`         | `string`   | no       | `"On this page"`  | Accessible name for the nav landmark.                                                                                     |
| `class`             | `string`   | no       | —                 | Additional class names merged with `.cinder-table-of-contents`.                                                           |
| `headingSelector`   | `string`   | no       | `"h2, h3, h4"`    | CSS selector used to gather headings inside the target element.                                                           |
| `observeRootMargin` | `string`   | no       | `"0% 0% -70% 0%"` | Root margin passed to IntersectionObserver for active-section detection.                                                  |
| `target`            | `string`   | no       | —                 | CSS selector used to find the target heading container in derived mode.                                                   |
| `items`             | `(opaque)` | no       | —                 | Explicit nested TOC items for controlled mode. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-table-of-contents-link-active-border-color`
- `--cinder-table-of-contents-link-active-color`
- `--cinder-table-of-contents-link-border-color`
- `--cinder-table-of-contents-link-color`
- `--cinder-table-of-contents-link-indent-step`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
