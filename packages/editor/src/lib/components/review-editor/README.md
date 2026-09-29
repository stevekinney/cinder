# ReviewEditor

Markdown editor extended with inline review threads, anchored comments, and collaborative annotation state.

## Usage

```svelte
<script lang="ts">
  import { ReviewEditor } from '@lostgradient/editor';
</script>
```

## Guidance

### Use When

- Building a document review experience that needs both a Markdown editor and anchored comment threads in one bundled surface.
- Threading reviewer commentary against specific selections inside a long-form document.

### Avoid When

- Plain authoring with no review threads — markdown-editor is the lighter primitive.
- Reviewing diffs between two documents rather than annotating one — use diff-viewer instead.

## Props

<!-- generated:props:start -->

| Prop                      | Type                     | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                   | `string`                 | no       | —       | Additional CSS classes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `currentUserId`           | `string`                 | no       | —       | Current user ID for permissions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `id`                      | `string`                 | yes      | —       | Unique identifier for accessibility (required).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `mode`                    | `"edit"` \| `"readonly"` | no       | —       | Editor mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `name`                    | `string`                 | no       | —       | Form field name prefix for hidden inputs (enables form participation).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `original`                | `string`                 | no       | —       | Original/baseline content for diff comparison.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `placeholder`             | `string`                 | no       | —       | Placeholder text when empty.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `snapshotMode`            | `boolean`                | no       | —       | Snapshot mode for visual regression testing. When `true`: - Applies `caret-color: transparent` and `user-select: none` to the editor root via a `data-snapshot-mode` attribute, producing a stable visual state (no blinking cursor, no selection highlights). - Blurs any focused element inside the component on mount so the initial screenshot does not capture a focused ring or active caret. - The inner MarkdownEditor instance also receives `snapshotMode={true}`. This is a purely visual / CSS concern. It does NOT affect editability, ProseMirror state, or any prop controlled by `readonly` / `mode`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `value`                   | `string`                 | no       | —       | Current markdown content (two-way bindable).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `diffReviewState`         | `(opaque)`               | no       | —       | Opt-in, host-controlled diff-review session for this document's embedded diff tab (COR-512 / DR-7). Absent by default: every existing consumer's behavior, DOM, and export scope are exactly unchanged. Never mutated directly — every change flows back out through `onDiffReviewStateChange`. Independent of `threads`/`ProseMirror` anchoring: enabling or removing this prop never touches document comment threads, and a bound `original`/`value` change latches diff comments outdated without affecting prose threads. `ReviewEditor` reconciles this against its own bound `original`/`value` as a single `markdown` target keyed by its `id` prop (see `buildReviewEditorDiffReviewTarget`), through `restoreDiffReviewState` — the same atomic validate-and-reconcile path a remount uses. An input that fails that validation shows an integration error and keeps the last valid state; ordinary document editing is never affected. Removing this prop stops diff controls/export integration without erasing or overwriting the host's own state; supplying it again re-validates from the current input. Not expressible in JSON Schema; see the component types for the signature. |
| `onCommentCreate`         | `(opaque)`               | no       | —       | Called when a comment is created in an existing thread. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `onCommentDelete`         | `(opaque)`               | no       | —       | Called when a comment is deleted. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `onCommentUpdate`         | `(opaque)`               | no       | —       | Called when a comment is updated. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `onDiffReviewStateChange` | `(opaque)`               | no       | —       | Called whenever the reconciled diff-review state changes: after a comment/draft/review-note action the diff tab's controls dispatch, and whenever a bound `original`/`value` change latches affected diff comments outdated. Never called for a supplied state that fails validation. Named `onDiffReviewStateChange` (not the cross-package contract's lowercase `ondiffreviewstatechange`): this repository's `check-prop-conventions` gate structurally bans a non-native-passthrough lowercase `on*` prop, exactly like `DiffReview`'s `onStateChange` and `SourceDiffViewer`'s `onFilesChange` before it. The field and payload are otherwise exactly the ratified contract's. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `onThreadCreate`          | `(opaque)`               | no       | —       | Called when user initiates thread creation. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `onThreadDelete`          | `(opaque)`               | no       | —       | Called when a thread is deleted. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `onValueChange`           | `(opaque)`               | no       | —       | Called when content changes. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `threads`                 | `(opaque)`               | no       | —       | Comment threads (two-way bindable). Anchor positions use two different coordinate spaces, and neither is a raw Markdown string index: `anchor.from` and `anchor.to` are ProseMirror document positions, while `anchor.lastKnownOffset` and `anchor.originalPosition.offset` are `doc.textBetween()` text offsets. All four are expressed against the full document — when the content carries YAML front matter, the component subtracts the front matter's character length before handing anchors to the editor. Positions are verified against the document. A newly seeded anchor whose range does not match its `quote` is reported in dev and re-anchored by quote. The intentional `0`/`0` sentinel created by `toRuntimeThreads(state.threads)` is exempt from the warning and re-anchors normally. Restore persisted state with that helper (or call `setState`) rather than hand-computing positions. See `shared/anchor-types.ts` for the field-by-field contract. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                            |

<!-- generated:props:end -->

## Persisting and restoring

`getState()` returns a serializable `ReviewState`. Its `threads` are `PersistedThread[]`, which deliberately drop the ProseMirror `from`/`to` positions — those only mean something against a live document, and a document can move on between save and restore.

To restore, bind `value` and `threads` from the same saved state and run the threads through `toRuntimeThreads`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { ReviewEditor, toRuntimeThreads } from '@lostgradient/editor';
  import type { ReviewState, Thread } from '@lostgradient/editor';

  let value = $state('');
  let threads = $state<Thread[]>([]);

  // `localStorage` does not exist while the component script runs on the
  // server, and the saved key may be missing on a first visit.
  onMount(() => {
    const stored = localStorage.getItem('review-state');
    if (stored === null) return;
    const saved: ReviewState = JSON.parse(stored);
    value = saved.content;
    threads = toRuntimeThreads(saved.threads);
  });
</script>

<ReviewEditor id="review" bind:value bind:threads currentUserId="steve" />
```

`toRuntimeThreads` seeds `from`/`to` with `0`. That pair is an _unplaced_ sentinel rather than a position: a collapsed range paints no highlight, and the anchor plugin locates each thread by its `quote` against the live document and writes the real positions back through the binding shortly after mount.

Restoring against different content is survivable. Because every restored thread goes through re-anchoring, a thread whose quote is no longer in the document comes back _orphaned_ rather than placed: it is kept in `threads`, paints no highlight, shows in the sidebar as missing its text, and re-anchors on a later pass if the text returns. `onThreadDelete` does **not** fire, and no cleanup is owed — removing an orphaned thread is your decision, made with `deleteThread`.

The same is true while editing. Deleting anchored text orphans its thread instead of destroying it, because a deletion and the first half of a cut-and-paste are indistinguishable at the moment the text disappears, and re-anchoring is debounced 300ms — faster than anyone cutting a paragraph and pasting it back. Check `anchor.status` to tell the two states apart:

```ts
const orphaned = threads.filter((thread) => thread.anchor.status === 'orphaned');
```

Comment exports carry the same signal: an orphaned thread serializes with `status: 'orphaned'`, and its stale coordinates move to `lastKnownSelection` (omitted entirely when no genuine historical offset exists) so nothing reads as a current position.

The imperative alternative is `setState(saved)`, which sets the content and re-anchors in one call:

```svelte
<script lang="ts">
  let editor: ReviewEditor;

  function restore(saved: ReviewState) {
    editor.setState(saved);
  }
</script>

<ReviewEditor bind:this={editor} id="review" currentUserId="steve" />
```

Do not hand-compute anchor positions. If you seed `threads` directly, `anchor.from`/`to` are ProseMirror positions against the full document — including the front matter's character length when the content has any — while `anchor.lastKnownOffset` is a `doc.textBetween()` text offset. Neither is an index into the Markdown string. A newly seeded anchor that does not match the document is reported in dev and re-anchored by quote. The `0`/`0` sentinel created by `toRuntimeThreads` is intentionally exempt from that warning and re-anchors normally. Restore through `toRuntimeThreads` or `setState`, and let the component compute the positions.

## Diff comments (opt-in, COR-512 / DR-7)

Supplying `diffReviewState` enables a second, independent comment domain inside the same instance: diff comments on the embedded diff tab, alongside the existing ProseMirror-anchored `threads`. It round-trips separately from `ReviewState`/`threads` — there is no migration between the two, and they never share an ID space.

```svelte
<script lang="ts">
  import { ReviewEditor, createDiffReviewState } from '@lostgradient/editor';
  import type { DiffReviewState } from '@lostgradient/editor';

  let original = $state('# Plan\n\nShip login.');
  let value = $state('# Plan\n\nShip login and a dashboard.');

  const created = createDiffReviewState([
    {
      targetId: 'plan',
      kind: 'markdown',
      label: 'Document diff',
      original,
      current: value,
      normalizeInputs: true,
    },
  ]);
  if (!created.ok) throw new Error('Invalid initial diff-review target.');
  let diffReviewState = $state<DiffReviewState>(created.value);
</script>

<ReviewEditor
  id="plan"
  bind:original
  bind:value
  {diffReviewState}
  onDiffReviewStateChange={(next) => (diffReviewState = next)}
/>
```

- Diff comments render in the same comment list as document threads, each row badged `Diff · old` / `Diff · new` / `Diff · file` to distinguish the anchor domain. Selecting a current diff comment opens the diff tab and focuses its side; an outdated or removed one focuses its own captured detail instead.
- Every committed `original`/`value` change (typing, a front-matter edit, `setMarkdown`, "Revert all") immediately latches every diff comment on that document outdated — it is never dropped, only marked stale.
- An invalid `diffReviewState` (malformed shape, an unsupported version) shows a visible error and keeps the last state that validated; document editing is never affected. Removing the prop stops the diff tab's controls without erasing your own state object — supply it again to resume.
- Cancelling the inline composer never deletes a nonempty draft. It stays reachable from a persistent "Unsaved drafts" panel (rendered regardless of which tab is open) with Open/Save/Discard actions — every export scope is blocked (`drafts-pending`) until each nonempty draft is saved or explicitly discarded.
- `exportAggregateReviewMarkdown()`/`exportAggregateReviewJson()` (also on the public component instance) export every saved diff comment plus every retained document thread/reply, each exactly once, through the real `@lostgradient/editor/export` exporters. They return `{ok: false, error: {code: 'invalid-record', ...}}` when diff review isn't enabled. The existing `exportMarkdownSummary`/`exportUnifiedDiff`/`getFormData` are unaffected and keep exporting only `threads`.

See `docs/decisions/diff-review-contract.md` (this package's `documentation/diff-review-contract.md`) for the full data/export contract, and `DiffReview`/`DiffReviewComments` for the equivalent standalone (non-`ReviewEditor`) composition.

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
