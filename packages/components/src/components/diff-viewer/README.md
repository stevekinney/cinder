# DiffViewer

Side-by-side or unified Markdown diff surface with hunk grouping, word-level inline changes, and size-based debounce gating.

## Usage

```svelte
<script lang="ts">
  import { DiffViewer } from '@lostgradient/cinder/diff-viewer';
</script>
```

## Guidance

### Use When

- Comparing two Markdown documents and wanting the bundled toolbar, view-mode toggle, front-matter handling, and large-payload safeguards.
- Building a review workflow that needs hunked, line-anchored Markdown diffs out of the box as a heavyweight suite.

### Avoid When

- Showing only a counts summary — use diff-statistics on its own for a lightweight presentation.
- Diffing non-Markdown source code where syntax-aware highlighting matters more than prose-aware rendering.

## Props

<!-- generated:props:start -->

| Prop              | Type                                     | Required | Default | Description                                                                                                                                                                                                                                                                                 |
| ----------------- | ---------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`                                 | no       | —       | Additional CSS classes                                                                                                                                                                                                                                                                      |
| `current`         | `string`                                 | yes      | —       | The current/modified text                                                                                                                                                                                                                                                                   |
| `normalizeInputs` | `boolean`                                | no       | —       | Whether to normalize markdown inputs before comparison. When true (default), both original and current are normalized to canonical form before diffing, preventing false positives from formatting differences.                                                                             |
| `original`        | `string`                                 | yes      | —       | The original/baseline text                                                                                                                                                                                                                                                                  |
| `readonly`        | `boolean`                                | no       | —       | Whether the viewer is read-only (hides revert buttons)                                                                                                                                                                                                                                      |
| `viewMode`        | `"unified"` \| `"final"` \| `"original"` | no       | —       | Bindable: reactive access to current view mode. Parent components can bind to control or observe the view mode.                                                                                                                                                                             |
| `hunks`           | `(opaque)`                               | no       | —       | Bindable: reactive access to computed hunks. Parent components can bind to this to reactively access hunk data. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                     |
| `onrevertall`     | `(opaque)`                               | no       | —       | Called when user wants to revert all changes A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                     |
| `onreverthunk`    | `(opaque)`                               | no       | —       | Called when user wants to revert a specific hunk A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                 |
| `toolbar`         | `(opaque)`                               | no       | —       | Override the entire toolbar for advanced customization. When provided, replaces the default toolbar completely. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                  |
| `toolbarActions`  | `(opaque)`                               | no       | —       | Additional toolbar actions rendered in the toolbar-right section. Use this to inject custom buttons (e.g., export actions) without replacing the entire toolbar. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
