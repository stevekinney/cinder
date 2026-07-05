# SourceDiffViewer

Lightweight unified-patch viewer for source-code and operational diffs with file headers, hunk headers, line state styling, and bounded rendering.

## Usage

```svelte
<script lang="ts">
  import { SourceDiffViewer } from '@lostgradient/cinder/source-diff-viewer';
</script>
```

Use SourceDiffViewer for source-code patches, agent workspace patches, Git output, and other operational unified diffs. Keep using DiffViewer for Markdown document review, front-matter handling, Markdown normalization, and prose-oriented word-level changes.

## Guidance

### Use When

- Rendering source-code unified patches from agent output, Git operations, workspace changes, or review systems.
- Showing operational patch output where file and hunk structure matters more than Markdown front matter or word-level prose review.

### Avoid When

- Comparing two Markdown documents with normalization, front-matter handling, and revert affordances — use diff-viewer instead.
- Showing syntax-highlighted code samples rather than patch output — use code-block instead.

## Props

<!-- generated:props:start -->

| Prop           | Type      | Required | Default                        | Description                                                         |
| -------------- | --------- | -------- | ------------------------------ | ------------------------------------------------------------------- |
| `ariaLabel`    | `string`  | no       | —                              | Accessible label for the diff region.                               |
| `class`        | `string`  | no       | —                              | Additional CSS classes merged with `.cinder-source-diff-viewer`.    |
| `emptyMessage` | `string`  | no       | `"No patch lines to display."` | Message shown when the patch is empty or contains no diffable rows. |
| `lineNumbers`  | `boolean` | no       | `true`                         | Whether old and new line-number gutters are rendered.               |
| `maxLines`     | `integer` | no       | `1000`                         | Maximum number of diff rows to render before truncating.            |
| `patch`        | `string`  | yes      | —                              | Unified patch text to parse and render.                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
