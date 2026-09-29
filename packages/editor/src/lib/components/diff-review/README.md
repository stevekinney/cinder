# DiffReview

Aggregate single- and multi-target diff review (COR-509 / DR-6): a file list with changed-line/comment counts and a Reviewed checkbox, the diff surface for the currently selected file, comment creation via range or file selection, a drafts inventory, and Markdown/JSON export. Composed entirely from the public `DiffViewer` (COR-514) and `SourceDiffViewer` (COR-515) annotation hooks, `diff-review-state` (COR-516), and the export functions (COR-513) — no private controller from either viewer is imported.

```svelte
<script lang="ts">
  import { DiffReview, createDiffReviewState } from '@lostgradient/editor';
  import type { DiffReviewTargetInput } from '@lostgradient/editor';

  const targets: DiffReviewTargetInput[] = [
    {
      targetId: 'readme',
      kind: 'markdown',
      label: 'README.md',
      original,
      current,
      normalizeInputs: true,
    },
    { targetId: 'patch', kind: 'source', label: 'Refactor', patch: unifiedPatchText },
  ];

  const created = createDiffReviewState(targets);
  let state = $state(created.ok ? created.value : undefined);
</script>

{#if state}
  <DiffReview {targets} {state} onStateChange={(next) => (state = next)} />
{/if}
```

## Props

| Prop            | Type                              | Description                                                                                                                                                           |
| --------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `targets`       | `DiffReviewTargetInput[]`         | Live document/patch content for every target `state` tracks. The host keeps this and `state.targets` in sync via its own `set-targets` dispatch when content changes. |
| `state`         | `DiffReviewState`                 | Controlled session state (`@lostgradient/editor/diff-review-state`).                                                                                                  |
| `onStateChange` | `(next: DiffReviewState) => void` | Called after every successful action.                                                                                                                                 |
| `readonly`      | `boolean`                         | Disables comments, drafts, review note, and Reviewed. Navigation, filtering, and export remain available. Default `false`.                                            |
| `reviewTitle`   | `string`                          | Markdown export heading. Default `'Review feedback'`.                                                                                                                 |
| `class`         | `string`                          | Additional class merged onto the root element.                                                                                                                        |

## Renderer selection

A Markdown target renders through `DiffViewer`; a source-patch target renders through Cinder's `SourceDiffViewer`, scoped to the currently selected file via `activeFileOccurrence`. Both are wired through their public `annotationSelection`/`onAnnotationSelectionChange` hooks; `DiffReview` converts each viewer's selection into a `DiffReviewRangeAnchor` (`diff-review-annotation-bridge.ts`) and immediately dispatches `create-draft` with it — the composer is a live view over that draft, not a local text buffer, so a partially written comment survives target switching, filtering, mode changes, and remount exactly like any other draft. Save dispatches `save-draft` (converting it into a real comment); Cancel only closes the composer panel and does **not** discard the draft, which remains recoverable from the drafts inventory.

## Comment-to-anchor navigation

Every comment in the sidebar's comments panel carries a "Go to" action. For a **current** comment (its target is still live and unchanged since capture), this focuses the comment's anchor in the diff through whichever viewer is mounted's own public `focusAnchor`/`focusFile` handle (never a private controller) — switching the target/file first if the comment belongs to one that isn't currently shown, and switching a Markdown `DiffViewer`'s view mode as needed to expose the anchor's side (both of those are the viewer's own `focusAnchor` behavior, not reimplemented here). If the viewer reports the anchor `unavailable` (its row isn't rendered under the current view), a visible `role="status"` message says so next to the diff. For an **outdated** or **removed** comment, "Go to" never touches the diff at all — it moves focus to that comment's own captured-detail text in place (`diff-review-comment-item.svelte`), which shows the target/path the comment was originally captured against. A removed comment (its target no longer appears in `state.targets` at all, not merely changed) also carries a "Removed" badge instead of "Outdated".

In `readonly` mode, a line-level (range) anchor's "Go to" always reports `unavailable`: `readonly` omits `onAnnotationSelectionChange` from both viewers, and each viewer's own contract only renders its per-line annotation controls (the actual DOM `focusAnchor` targets) when that callback is supplied. This is the underlying viewers' existing contract, not something this component adds or could bypass without reaching into their private controllers. A file-level comment's "Go to" is unaffected by `readonly` on a source target (`SourceDiffViewer`'s file headers render unconditionally); it's always `unavailable` on a Markdown target regardless of `readonly`, per the note above.

## Invalid targets, renderer failure, and empty diffs

- **Invalid targets**: `targets` is host-supplied live content, not itself validated by any reducer action. An update that fails `validateDiffReviewTargetList` (the same shape check `set-targets` uses) shows a `role="alert"` naming the structured error (`code`/`path`/`message`) and keeps rendering the last valid `targets` value — nothing is discarded or blanked.
- **Renderer failure**: the mounted `DiffViewer`/`SourceDiffViewer` is wrapped in a `<svelte:boundary>`. If it throws while rendering a target, that target's pane shows a local, scoped error message, its own "Add file comment" control is disabled, and every other target, the comments panel, drafts, and export are unaffected. (Both viewers' real parsers are deliberately lenient and don't throw on adversarial input reachable through the validated `targets` prop, so this is a defensive net for a future regression or a host that bypasses validation, not something reachable end-to-end today — see `diff-review-renderer.test.ts` for a direct test of the boundary itself.)
- **No commentable patch lines**: once a specific file is targeted (a Markdown target always is; a source target once selected) and it has zero added/removed/modified lines, the diff pane shows "No commentable patch lines." instead of the viewer. The file-level comment action is unaffected; there is simply nothing to select a line-level comment on.

## Layout

`.diff-review-layout` stacks the file list, diff, and review sidebar in document order below a `60rem` container width, and lays them out as three columns above it (`@container` query on `.diff-review`). Each region is a native landmark (`<nav>`/`<main>`/`<aside>`) with its own `aria-label` (`"File navigation"`, `"Diff"`, `"Review"`).

## Keyboard

Every control DiffReview itself composes (file buttons, the Reviewed checkbox, the path filter, toolbar controls, drafts-inventory actions, comment actions, and comment navigation) is a native, keyboard-operable element — no custom key handling layered on top. Deleting a comment opens Cinder's `ConfirmDialog`; canceling it returns focus to the "Delete" button that opened it. See `diff-review-keyboard.test.ts`.

## Internal, undiscoverable pieces

`diff-review-file-list.svelte`, `diff-review-renderer.svelte` (+ `diff-review-renderer.types.ts`), `diff-review-drafts-inventory.svelte`, `diff-review-toolbar.svelte`, `diff-review-anchor-status.ts`, and `diff-review-inline-markers.ts` are internal composition/marker/navigation-classification pieces. None is exported from `index.ts`, registered as its own mirror subpath, or discoverable outside this directory — only `DiffReview` itself and `DiffReviewComments` (a sibling public leaf, which also imports `diff-review-anchor-status.ts` for its own "Go to"/badge classification) are public.

## Related

`diff-review-comments`, `diff-viewer`, `review-editor`.
