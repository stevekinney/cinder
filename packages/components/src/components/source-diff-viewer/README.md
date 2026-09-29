# SourceDiffViewer

Lightweight unified-patch viewer for source-code and operational diffs with file headers, hunk headers, line state styling, and bounded rendering.

See the [editor/Cinder surface boundary](https://github.com/stevekinney/cinder/blob/main/docs/decisions/editor-chat-cinder-surfaces.md). `SourceDiffViewer` owns dependency-light source patches; use the editor `DiffViewer` for Markdown review and editor-runtime workflows.

## Usage

```svelte
<script lang="ts">
  import { SourceDiffViewer } from '@lostgradient/cinder';

  const patch = `diff --git a/src/generated.txt b/src/generated.txt
--- a/src/generated.txt
+++ b/src/generated.txt
@@ -1,6 +1,6 @@
 unchanged
-old one
+new one
-old two
+new two
 unchanged
`;
</script>

<SourceDiffViewer {patch} maxLines={4} />
```

Use SourceDiffViewer for source-code patches, agent workspace patches, Git output, and other operational unified diffs. Use `DiffViewer` from `@lostgradient/editor` for Markdown document review, front-matter handling, Markdown normalization, and prose-oriented word-level changes.

## Annotation hooks

SourceDiffViewer exposes optional, dependency-light selection and file hooks so a caller can build comment/annotation UI without SourceDiffViewer ever importing `@lostgradient/editor` or Markdown/Milkdown/ProseMirror. These hooks are the Cinder half of the [diff-review contract](../../../../editor/documentation/diff-review-contract.md); the Editor package's `DiffReview`/`DiffReviewComments` consume them, but this component itself has no idea either exists.

```svelte
<script lang="ts">
  import { SourceDiffViewer, type SourceDiffAnnotationSelection } from '@lostgradient/cinder';

  const patch = `diff --git a/src/cache.ts b/src/cache.ts
--- a/src/cache.ts
+++ b/src/cache.ts
@@ -1,2 +1,2 @@
-cache.set(key, result);
+cache.set(key, result, { ttl: 60 });
 return result;
`;

  let selection: SourceDiffAnnotationSelection | null = $state(null);
</script>

<SourceDiffViewer
  {patch}
  annotationSelection={selection}
  onAnnotationSelectionChange={(next) => (selection = next)}
/>
```

- `onFilesChange(files)` reports a descriptor — occurrence, paths, label, hunk/changed-line counts, and whether the file's content was entirely cut by `maxLines` — for every file the parser recognized, including a fully truncated one that never appears in the rendered output.
- `activeFileOccurrence` renders exactly one recognized file; omit it (the default) to render every file, matching prior behavior. A fully truncated active file still renders its header and an explicit "Lines unavailable at the current display limit." message.
- `fileAnnotation` renders alongside each file's header regardless of the other annotation hooks, receiving that file's descriptor. `lineAnnotation` renders next to each commentable row/side's add-comment control, so — like the control itself — it only appears when `onAnnotationSelectionChange` is also supplied.
- `annotationSelection` + `onAnnotationSelectionChange` are a controlled pair, separate from ordinary diff navigation: a line's add-comment button or Shift-click selects/extends and commits immediately; a focused control's Enter starts a keyboard selection, Shift+Arrow extends it, Escape cancels and returns focus to the origin, and Enter commits. An extension that would cross a file, hunk, or side boundary is rejected — the origin never moves — with the reason announced in an instance-scoped status region.
- `ref` exposes `focusFile(fileOccurrence)` and `focusAnchor(anchor)`, each returning `{ status: 'focused' | 'unavailable' }` and operating only within that component instance.

Every hook is optional and additive: with none supplied, rendering is byte-for-byte the same as before this feature existed, and two instances on the same page never share selection state, focus, or DOM ids.

Contract note: this repository's `check-prop-conventions` gate bans a non-native-passthrough lowercase `on*` prop, so the cross-package diff-review contract's `onfileschange`/`onannotationselectionchange` spelling is translated here to `onFilesChange`/`onAnnotationSelectionChange`. Every field name and payload shape is otherwise exactly as specified.

## Guidance

### Use When

- Rendering source-code unified patches from agent output, Git operations, workspace changes, or review systems.
- Showing operational patch output where file and hunk structure matters more than Markdown front matter or word-level prose review.

### Avoid When

- Comparing two Markdown documents with normalization, front-matter, and revert affordances — use `DiffViewer` from `@lostgradient/editor`.
- Showing syntax-highlighted code samples rather than patch output — use code-block instead.

## Props

<!-- generated:props:start -->

| Prop                          | Type               | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activeFileOccurrence`        | `number` \| `null` | no       | —       | Controlled zero-based file occurrence to render exclusively. Absent (the default) renders every file, matching prior behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ariaLabel`                   | `string`           | no       | —       | Accessible label for the diff region.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `class`                       | `string`           | no       | —       | Additional CSS classes merged with `.cinder-source-diff-viewer`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `lineNumbers`                 | `boolean`          | no       | `true`  | Whether old and new line-number gutters are rendered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `maxLines`                    | `integer`          | no       | `1000`  | Maximum number of diff rows to render before truncating.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `patch`                       | `string`           | yes      | —       | Unified patch text to parse and render.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `annotationSelection`         | `(opaque)`         | no       | —       | Controlled current annotation selection. Distinct from ordinary diff navigation: setting or clearing it never affects which rows are shown. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                             |
| `empty`                       | `(opaque)`         | no       | —       | Rendered when the patch is empty or contains no displayable diff rows. Falls back to a default "No patch lines to display." message — matching the `empty` snippet the chart/command families expose. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                   |
| `fileAnnotation`              | `(opaque)`         | no       | —       | Rendered next to each file's header, alongside its file-level annotation controls. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `lineAnnotation`              | `(opaque)`         | no       | —       | Rendered next to each commentable row's add-comment control. Like that control, it only appears when `onAnnotationSelectionChange` is also supplied — pass both to render per-line annotation markers. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                  |
| `onAnnotationSelectionChange` | `(opaque)`         | no       | —       | Called when the user commits, extends, or clears an annotation selection. See `onFilesChange` above for why this repository spells the contract's `onannotationselectionchange` as camelCase. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                           |
| `onFilesChange`               | `(opaque)`         | no       | —       | Called with a descriptor for every recognized file whenever the parsed patch changes. Named `onFilesChange` (camelCase) rather than the lowercase `onfileschange` the cross-package diff-review contract uses elsewhere: this repository's `check-prop-conventions` gate structurally bans a non-native-passthrough lowercase `on*` prop, so the callback casing is translated to this repository's house style while every field name and the payload shape stay exactly as specified. Not expressible in JSON Schema; see the component types for the signature. |
| `ref`                         | `(opaque)`         | no       | —       | Programmatic handle for `focusFile`/`focusAnchor`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
