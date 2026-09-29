# SourceDiffViewer · accessibility

## Pattern

SourceDiffViewer presents structured source diff output. Preserve file headers, hunk headers, line-state labels, and source order so assistive technology receives the same relationships that are visible on screen.

Purpose: Lightweight unified-patch viewer for source-code and operational diffs with file headers, hunk headers, line state styling, and bounded rendering.

## Use when

- Rendering source-code unified patches from agent output, Git operations, workspace changes, or review systems.
- Showing operational patch output where file and hunk structure matters more than Markdown front matter or word-level prose review.

## Avoid when

- Comparing two Markdown documents with normalization, front-matter, and revert affordances — use `DiffViewer` from `@lostgradient/editor`.
- Showing syntax-highlighted code samples rather than patch output — use code-block instead.

## Keyboard and focus

Without `onAnnotationSelectionChange`, the component is read-only and keyboard behavior follows the rendered native elements. The diff region has an accessible label through `ariaLabel`; provide a specific label when multiple diff viewers appear on the same page.

Supplying `onAnnotationSelectionChange` turns on one native `<button>` per commentable row/side, each a real focus stop in source order (addition and removal rows expose one control on their own side; context rows expose separate old- and new-side controls). On a focused control:

- **Enter** starts a selection at that row, or — while a selection is pending — commits it and calls `onAnnotationSelectionChange` with the final range.
- **Shift+ArrowDown** / **Shift+ArrowUp** extend the pending selection one row at a time on the same side, moving focus to the new endpoint's control.
- **Escape** cancels a pending selection without committing it and returns focus to the control where the selection started.

Shift-clicking a second control extends from the last selection origin and commits immediately; plain pointer dragging never starts a range. An attempted extension across a file, hunk, or side boundary is rejected without moving the origin, and the reason is announced through an instance-scoped `role="status"` region rendered above the diff (only present when annotation hooks are supplied). Metadata, binary-notice, and fully truncated rows never render a control, so they can never anchor a comment.

Each control and the file header carry stable, instance-scoped DOM ids, so two `SourceDiffViewer` instances on the same page never collide and never share keyboard state — a selection made in one instance has no visible or behavioral effect on another. The `ref` prop's `focusFile`/`focusAnchor` methods move focus programmatically within that same instance only, returning `{ status: 'unavailable' }` rather than throwing when the target row is not currently rendered (pruned by `maxLines`, or hidden by `activeFileOccurrence`).

## Names, roles, and state

Addition and removal rows include visually hidden labels such as "Added line 4" and "Removed line 2" so color is not the only state cue. Line-number gutters are decorative and hidden from assistive technology. Each add-comment control has an accessible name naming its side and line number (e.g. "Add comment on added or unchanged line 4").

When rendering bounded output, the truncation notice uses `role="status"` and includes both the rendered and total diff-line counts. A file selected through `activeFileOccurrence` whose content was entirely cut by `maxLines` still renders its header and an explicit "Lines unavailable at the current display limit." message rather than disappearing silently.

## Verification

- Render SourceDiffViewer in the playground or a focused test fixture.
- Inspect the region label, file labels, hunk labels, and row text in browser accessibility tools.
- Confirm additions and removals remain identifiable without relying on color.
- Check forced-colors mode because additions and removals use status-colored surfaces.
- With `onAnnotationSelectionChange` supplied, verify the full keyboard matrix above with a screen reader: focus reaches every add-comment control, Enter/Shift+Arrow/Escape behave as documented, and a rejected extension is announced once without moving focus away from the target control.

## Verification performed this session

- **2026-09-24 (COR-511, commit `46de156b`):** the annotation-hook keyboard model documented above (range selection, Shift-click, Enter/Shift+Arrow/Escape, focus return, two-instance isolation, and the default-no-annotation-props case) is exercised end-to-end by `source-diff-viewer-annotation.playwright.ts` (Chromium via Playwright); this session added no new browser coverage to this component directly — it added light/dark theme, 320px-layout, and read-only-state axe checks to the composing `DiffReview` shell instead (`diff-review.a11y.md`). This file has no standalone theme/narrow-layout/axe browser test of its own yet.
- **Human acceptance: not performed by any human.** The ratified contract (SHA-256 `ac837e3a…`) reserves DR-8 design/accessibility acceptance for Steve Kinney, covering "both viewer annotation interactions"; no agent may supply it. The COR-511 orchestrating session reports Steve waived this gate on 2026-09-23 ("Nothing needs my sign off"); Linear comment `a5463ac9-c4d0-455b-ba01-d30c3fcfdb9a` on COR-511 records the same. This record relies on that report and does not independently verify it — no contract amendment was filed. No VoiceOver or other manual screen-reader pass was run against this component in any session.

## 2026-09-24 (COR-511 continuation, commit `2f3a76a6`), agent-verified, no human review

No new browser coverage was added against this component's own fixture directly. New coverage composed through `DiffReview` (recorded in full in `diff-review.a11y.md`, Chromium via Playwright, no source defect found):

- A binary-only file (a `Binary files a/… and b/… differ` notice, no hunks) has `changedLineCount: 0`, so `DiffReview` never mounts a line-level control against it — confirming the documented "metadata, binary-notice, and fully truncated rows never render a control" rule holds through the composed path, not only in this component's own fixture — `diff-review-error-states.playwright.ts`.
- The truncation notice ("Showing first N of M diff lines.") surfaces correctly when this component is composed inside `DiffReview`'s renderer, with rendered rows still commentable — same file.
- Two-instance isolation for the composed `DiffReviewComments` panel two `DiffReview` mounts each own (this component's own annotation-hook two-instance isolation was already covered directly by `source-diff-viewer-annotation.playwright.ts`) — `diff-review-isolation.playwright.ts`.

This file still has no standalone theme/narrow-layout/axe browser test of its own.

**Human acceptance: waived, not performed, by Steve Kinney.** Linear comment `a5463ac9-c4d0-455b-ba01-d30c3fcfdb9a` on COR-511, read directly by this agent with `list_comments`: "Human acceptance gate waived by Steve Kinney (2026-09-23) … 'Nothing needs my sign off.'" No human reviewed this work. VoiceOver was not driven in this session.

Related components: `diff-statistics`, `code-block`.
