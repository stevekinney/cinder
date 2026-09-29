# DiffViewer

Side-by-side or unified Markdown diff surface with hunk grouping, word-level inline changes, and size-based debounce gating.

See the [editor/Cinder surface boundary](https://github.com/stevekinney/cinder/blob/main/docs/decisions/editor-chat-cinder-surfaces.md). This editor-owned `DiffViewer` is for Markdown review workflows; use Cinder's `SourceDiffViewer` for dependency-light operational source patches.

## Usage

```svelte
<script lang="ts">
  import { DiffViewer } from '@lostgradient/editor';
</script>
```

## Guidance

### Use When

- Comparing two Markdown documents and wanting the bundled toolbar, view-mode toggle, front-matter handling, and large-payload safeguards.
- Building a review workflow that needs hunked, line-anchored Markdown diffs out of the box as a heavyweight suite.

### Avoid When

- Showing only a counts summary — use diff-statistics on its own for a lightweight presentation.
- Diffing non-Markdown source code where syntax-aware highlighting matters more than prose-aware rendering.

## Copying the diff

The toolbar's "Copy diff" button (internally wired via `oncopydiff`, not a public prop) copies a real unified-diff document to the clipboard — `---`/`+++` file headers and `@@ ... @@` hunk markers, produced by `generateUnifiedDiff`/`formatComputedUnifiedDiff` in `../../export/unified-diff.ts`.

The copy is always a full-document unified diff of the original vs. the current text, regardless of the toolbar's current `viewMode`. Switching between Unified/Final/Original only changes what's rendered on screen; it never scopes what gets copied. This is a deliberate decision (see the comment above `copyUnifiedDiff` in `diff-viewer.svelte`), not an oversight.

## Annotation hooks

DiffViewer exposes optional, side-aware selection and file hooks so a caller can build comment UI, matching [SourceDiffViewer's](../../../../../cinder/src/components/source-diff-viewer/README.md) interaction vocabulary while preserving Markdown-specific context (front matter, normalization, direct line counting). These hooks are the Editor half of the [diff-review contract](../../../../documentation/diff-review-contract.md).

```svelte
<script lang="ts">
  import { DiffViewer, type DiffViewerAnnotationSelection } from '@lostgradient/editor';

  const original = '# Title\n\nkeep\nold line\nkeep end';
  const current = '# Title\n\nkeep\nnew line\nkeep end';

  let selection: DiffViewerAnnotationSelection | null = $state(null);
</script>

<DiffViewer
  {original}
  {current}
  annotationSelection={selection}
  onAnnotationSelectionChange={(next) => (selection = next)}
/>
```

- `annotationSelection` + `onAnnotationSelectionChange` are a controlled pair, separate from ordinary diff navigation: a row's add-comment button or Shift-click selects/extends and commits immediately; a focused control's Enter starts a keyboard selection, Shift+Arrow extends it on the same side, Escape cancels and returns focus to the origin, and Enter commits. A Markdown document is one continuous body rather than a file/hunk-partitioned patch, so the only rejection reasons are `cross-side` (extending to the other side) and `edge` (past the top/bottom of the document) — never `cross-file`/`cross-hunk` — announced through a `role="status"` region above the diff content.
- Unified, Final, and Original view modes each expose whichever side(s) they render: a `modified` row's old and new text are independent targets with distinct line numbers and content; `same` (unchanged) rows are commentable on both sides; `added`/`removed` rows only on the side they exist on.
- `coordinateSpace` and `rawMapping` follow `normalizeInputs`: a normalized (default) comparison always reports `'normalized-markdown'` with `rawMapping: { status: 'unavailable', reason: 'normalization' }`, for every row including unchanged ones — never `'raw-source'`. A non-normalized comparison reports `'raw-source'` with `rawMapping: { status: 'exact' }`, and `startLine`/`endLine` are the input's own direct line numbers, offset by any leading front matter, with CRLF treated as a single line separator.
- While the diff is stale (large-document debounced/manual tiers awaiting recomputation), every add-comment control is disabled with a visible explanation; comments already rendered through `lineAnnotation`/`fileAnnotation` remain visible.
- Front matter is always ambiguous for line-level anchoring, so `fileAnnotation` renders a file-level hook next to it instead — regardless of the other annotation hooks — receiving the changed front-matter field names as context.
- The `ref` prop's `focusAnchor(anchor)` method switches `viewMode` as needed to expose the requested side, then focuses that control, returning `{ status: 'unavailable' }` rather than throwing when the target row cannot be found. Two `DiffViewer` instances on the same page never share selection, keyboard state, or control ids.

## Props

<!-- generated:props:start -->

| Prop                          | Type                                     | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                       | `string`                                 | no       | —       | Additional CSS classes                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `current`                     | `string`                                 | yes      | —       | The current/modified text                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `normalizeInputs`             | `boolean`                                | no       | —       | Whether to normalize markdown inputs before comparison. When true (default), both original and current are normalized to canonical form before diffing, preventing false positives from formatting differences.                                                                                                                                                                                                                                                                 |
| `original`                    | `string`                                 | yes      | —       | The original/baseline text                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `readonly`                    | `boolean`                                | no       | —       | Whether the viewer is read-only (hides revert buttons)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `viewMode`                    | `"unified"` \| `"final"` \| `"original"` | no       | —       | Bindable: reactive access to current view mode. Parent components can bind to control or observe the view mode.                                                                                                                                                                                                                                                                                                                                                                 |
| `annotationSelection`         | `(opaque)`                               | no       | —       | Controlled current annotation selection. Distinct from ordinary diff navigation and view-mode state: setting or clearing it never affects which lines are shown. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                     |
| `fileAnnotation`              | `(opaque)`                               | no       | —       | Rendered once alongside the front-matter section, whenever the document has front matter. Front matter offers file-level comments only (its changes aren't cleanly attributable to one selectable line), so this snippet receives the changed field names as context rather than a line anchor. Unlike `lineAnnotation`, it renders regardless of whether `onAnnotationSelectionChange` is supplied. Not expressible in JSON Schema; see the component types for the signature. |
| `hunks`                       | `(opaque)`                               | no       | —       | Bindable: reactive access to computed hunks. Parent components can bind to this to reactively access hunk data. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                      |
| `lineAnnotation`              | `(opaque)`                               | no       | —       | Rendered next to each commentable row's add-comment control. Like that control, it only appears when `onAnnotationSelectionChange` is also supplied -- pass both to render per-line annotation markers. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                              |
| `onAnnotationSelectionChange` | `(opaque)`                               | no       | —       | Called when the user commits, extends, or clears an annotation selection. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                            |
| `onRevertAll`                 | `(opaque)`                               | no       | —       | Called when user wants to revert all changes Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                         |
| `onRevertHunk`                | `(opaque)`                               | no       | —       | Called when user wants to revert a specific hunk Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                     |
| `ref`                         | `(opaque)`                               | no       | —       | Programmatic handle for `focusAnchor`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                               |
| `toolbar`                     | `(opaque)`                               | no       | —       | Override the entire toolbar for advanced customization. When provided, replaces the default toolbar completely. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                      |
| `toolbarActions`              | `(opaque)`                               | no       | —       | Additional toolbar actions rendered in the toolbar-right section. Use this to inject custom buttons (e.g., export actions) without replacing the entire toolbar. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
