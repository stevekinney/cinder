# DiffReviewComments

Reusable, resolution-aware comments panel for a `DiffReviewState` session (COR-509 / DR-6). Shows every saved comment by default (including resolved and outdated ones), with an explicit "Unresolved only" filter, plus the session's review note. Standalone-usable next to a bare `DiffViewer`/`SourceDiffViewer`, or composed inside the aggregate `DiffReview` shell.

```svelte
<script lang="ts">
  import { DiffReviewComments, createDiffReviewState } from '@lostgradient/editor';

  const created = createDiffReviewState([
    {
      targetId: 'doc',
      kind: 'markdown',
      label: 'notes.md',
      original,
      current,
      normalizeInputs: false,
    },
  ]);
  let state = $state(created.ok ? created.value : undefined);
</script>

{#if state}
  <DiffReviewComments {state} onStateChange={(next) => (state = next)} />
{/if}
```

## Props

| Prop            | Type                                   | Description                                                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `state`         | `DiffReviewState`                      | Controlled session state (`@lostgradient/editor/diff-review-state`). Never mutated directly.                                                                                                                                                                                                     |
| `onStateChange` | `(next: DiffReviewState) => void`      | Called after every successful edit/delete/resolve/reopen/review-note action.                                                                                                                                                                                                                     |
| `readonly`      | `boolean`                              | Disables every mutating control; viewing and filtering remain available. Default `false`.                                                                                                                                                                                                        |
| `defaultFilter` | `'all' \| 'unresolved'`                | Initial filter. Uncontrolled after mount. Default `'all'`.                                                                                                                                                                                                                                       |
| `onNavigate`    | `(comment: DiffReviewComment) => void` | Called when a person activates a **CURRENT** comment's "Go to" action — never for an outdated or removed one. The host wires this to whichever diff viewer it owns, calling that viewer's own public `focusAnchor`/`focusFile`. Optional; when omitted, "Go to" on a current comment is a no-op. |
| `class`         | `string`                               | Additional class merged onto the root `<section>`.                                                                                                                                                                                                                                               |

## Behavior

- Delete requires confirmation (`ConfirmDialog`) and is irreversible once confirmed — it removes the comment from state and from every subsequent export.
- Edit/resolve/reopen/delete/review-note dispatch through `reduceDiffReviewState` (via the shared `dispatchDiffReviewAction` helper); a rejected action never calls `onStateChange` and leaves the panel's state untouched.
- Outdated comments render an `Outdated` badge but are never hidden — they remain fully visible and editable/resolvable/deletable like any other comment. A comment whose target has been removed entirely (not merely changed) renders `Removed` instead.
- Every comment has a "Go to" action. For a `current` comment this calls `onNavigate`; this component classifies status itself (`diff-review-anchor-status.ts`, shared with `DiffReview`) so a standalone host never has to. For an `outdated`/`removed` comment, "Go to" instead moves DOM focus to that comment's own captured-detail text (its originally captured target label and path) and never calls `onNavigate` — the diff is never focused for a stale or gone anchor.

## Why `onStateChange`, not `onstatechange`

The ratified cross-package diff-review contract names this callback `onstatechange`. This repository's `check-prop-conventions` gate structurally bans a non-native-passthrough lowercase `on*` prop (a lowercase `on*` name must resolve to a real DOM-event handler). `@lostgradient/cinder`'s `SourceDiffViewer` already established the precedent (`onFilesChange`, `onAnnotationSelectionChange`) of keeping the field name and payload exactly as specified while translating only the casing to this repository's house style.

## Related

`diff-review`, `review-editor`.
