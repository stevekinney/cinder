# DiffViewer · accessibility

## Pattern

DiffViewer packages a higher-level workflow. Confirm the composed controls, labels, states, and keyboard path match the domain task instead of treating the visual shell as the accessibility contract.

Purpose: Side-by-side or unified Markdown diff surface with hunk grouping, word-level inline changes, and size-based debounce gating.

## Use when

- Comparing two Markdown documents and wanting the bundled toolbar, view-mode toggle, front-matter handling, and large-payload safeguards.
- Building a review workflow that needs hunked, line-anchored Markdown diffs out of the box as a heavyweight suite.

## Avoid when

- Showing only a counts summary — use diff-statistics on its own for a lightweight presentation.
- Diffing non-Markdown source code where syntax-aware highlighting matters more than prose-aware rendering.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle DiffViewer, verify the focused element remains visually apparent in default and forced-colors modes.

`[` and `]` jump to the previous/next change when focus is anywhere inside this `DiffViewer` instance (not global — see the `handleKeydown` comment in `diff-viewer.svelte`). The toolbar's Previous/Next buttons carry that shortcut in their accessible name — `aria-label="Previous change ([)"` / `aria-label="Next change (])"` — rather than describing it through a separate element. The adjacent `Kbd` keycaps are purely visual (`aria-hidden="true"`); they annotate the button they sit next to and do not need their own description.

### Annotation hooks (COR-514)

Without `onAnnotationSelectionChange`, annotation is off and rendering is unchanged. Supplying it turns on one native `<button>` add-comment control per commentable row/side, each a real focus stop in source order — a `same` (unchanged) row exposes both an old- and a new-side control; a `modified` row exposes independent old- and new-side controls with distinct text; an `added`/`removed` row exposes only the side it exists on. On a focused control:

- **Enter** starts a selection at that row, or — while a selection is pending — commits it and calls `onAnnotationSelectionChange` with the final range.
- **Shift+ArrowDown** / **Shift+ArrowUp** extend the pending selection one row at a time on the same side, moving focus to the new endpoint's control.
- **Escape** cancels a pending selection without committing it and returns focus to the control where the selection started.

Shift-clicking a second control extends from the last selection origin and commits immediately. An attempted extension to the other side, or past the top/bottom of the document, is rejected without moving the origin; the reason is announced through a `role="status"` region rendered above the diff content (present whenever annotation hooks are supplied). While the diff is stale (large-document debounced/manual tiers awaiting recomputation), every add-comment control is disabled with a visible explanation next to it and in that same status region — saved comments rendered through `lineAnnotation`/`fileAnnotation` remain visible throughout.

Front matter is always "ambiguous" for line-level anchoring, so it offers a file-level comment hook (`fileAnnotation`) instead of per-line controls, with the changed field names as context. Unlike `lineAnnotation`, it renders whenever front matter is present, regardless of whether annotation is otherwise enabled.

Each control carries a stable, instance-scoped DOM id, so two `DiffViewer` instances on the same page never collide and never share keyboard state. The `ref` prop's `focusAnchor` method switches `viewMode` as needed to expose the requested side (a `final`-mode viewer switches to `unified` to expose an `old`-side anchor; an `original`-mode viewer switches to `unified` to expose a `new`-side anchor) and then moves focus to that control, returning `{ status: 'unavailable' }` rather than throwing when the target row cannot be found.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When DiffViewer accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

The toolbar's copy button has the accessible name "Copy unified diff" (`aria-label` on the `Button`). Its result is announced through a `role="status"` live region: "Unified diff copied." on success, "Unable to copy unified diff." on failure. The copy is always a full-document unified diff, independent of the current `viewMode` — see `diff-viewer.svelte`'s `copyUnifiedDiff` and the README's "Copying the diff" section.

Each add-comment control has an accessible name naming its side and line number (e.g. "Add comment on added or unchanged line 4").

## Verification

- Render DiffViewer in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

## Verification performed this session

- **2026-09-24 (COR-511, commit `46de156b`):** the annotation-hook keyboard model documented above (range selection on both sides, Shift-click, Enter/Shift+Arrow/Escape, focus return, two-instance isolation, the default-no-annotation-props case, and stale-diff gating) is exercised end-to-end by `diff-viewer-annotation.playwright.ts` (Chromium via Playwright); this session added no new browser coverage to this component directly — it added light/dark theme, 320px-layout, and read-only-state axe checks to the composing `DiffReview` shell instead (`diff-review.a11y.md`). This file has no standalone theme/narrow-layout/axe browser test of its own yet.
- **Human acceptance: not performed by any human.** The ratified contract (SHA-256 `ac837e3a…`) reserves DR-8 design/accessibility acceptance for Steve Kinney, covering "both viewer annotation interactions"; no agent may supply it. The COR-511 orchestrating session reports Steve waived this gate on 2026-09-23 ("Nothing needs my sign off"); Linear comment `a5463ac9-c4d0-455b-ba01-d30c3fcfdb9a` on COR-511 records the same. This record relies on that report and does not independently verify it — no contract amendment was filed. No VoiceOver or other manual screen-reader pass was run against this component in any session; the copy/status announcements above were verified with `role="status"` DOM assertions only.

## 2026-09-24 (COR-511 continuation, commit `2f3a76a6`), agent-verified, no human review

No new browser coverage was added against this component's own fixture directly. It gained two forms of new coverage composed through `DiffReview` (both recorded in full in `diff-review.a11y.md`, Chromium via Playwright, no source defect found):

- **Mid-session staleness composed inside DiffReview**: growing a Markdown target's content past the 100KB manual-tier threshold shows this component's own "The diff is outdated. Recompute it to add a new comment; existing comments remain available." explanation and disables line-level annotation controls exactly as `diff-viewer-annotation.playwright.ts`'s own stale-diff describe block already proved directly against this component — `diff-review-error-states.playwright.ts` proves the composed path reaches the same behavior with no divergence.
- **Comment-to-anchor navigation's negative case**: an outdated/removed comment's "Go to" never focuses one of this component's own `[data-cinder-annotation-control]` elements — `diff-review-navigation.playwright.ts`.

This file still has no standalone theme/narrow-layout/axe browser test of its own; that gap remains open (DiffReview's own composed shell has that coverage — see `diff-review.a11y.md`).

**Human acceptance: waived, not performed, by Steve Kinney.** Linear comment `a5463ac9-c4d0-455b-ba01-d30c3fcfdb9a` on COR-511, read directly by this agent with `list_comments`: "Human acceptance gate waived by Steve Kinney (2026-09-23) … 'Nothing needs my sign off.'" No human reviewed this work. VoiceOver was not driven in this session.

Related components: `diff-statistics`, `code-block`.
