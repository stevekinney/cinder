# ReviewEditor · accessibility

## Pattern

ReviewEditor packages a higher-level workflow. Confirm the composed controls, labels, states, and keyboard path match the domain task instead of treating the visual shell as the accessibility contract.

Purpose: Markdown editor extended with inline review threads, anchored comments, and collaborative annotation state.

## Use when

- Building a document review experience that needs both a Markdown editor and anchored comment threads in one bundled surface.
- Threading reviewer commentary against specific selections inside a long-form document.

## Avoid when

- Plain authoring with no review threads — markdown-editor is the lighter primitive.
- Reviewing diffs between two documents rather than annotating one — use diff-viewer instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle ReviewEditor, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ReviewEditor accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ReviewEditor in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

## Verification performed this session

- **2026-09-24 (COR-511, commit `46de156b`):** the diff-comments integration (create an old-side deletion comment in the diff tab, switch to the editor tab and back; the merged document/diff comments list; cross-tab navigation focus; cancel/discard of a pending draft into the Unsaved-drafts inventory; a disabled composer while read-only) is exercised end-to-end by `review-editor-diff-comments.playwright.ts` (Chromium via Playwright). This session added no new browser coverage to ReviewEditor directly, and it has no dedicated theme, 320px-layout, or automated-axe browser test of its own yet.
- **Human acceptance: not performed by any human.** The ratified contract (SHA-256 `ac837e3a…`) reserves DR-8 design/accessibility acceptance for Steve Kinney, covering "ReviewEditor integration"; no agent may supply it. The COR-511 orchestrating session reports Steve waived this gate on 2026-09-23 ("Nothing needs my sign off"); Linear comment `a5463ac9-c4d0-455b-ba01-d30c3fcfdb9a` on COR-511 records the same. This record relies on that report and does not independently verify it — no contract amendment was filed. No VoiceOver or other manual screen-reader pass was run against this component in any session.

## 2026-09-24 (COR-511 continuation, commit `2f3a76a6`), agent-verified, no human review

Closes the one gap the prior entry above named as missing: light/dark theming and a 320-CSS-pixel narrow layout for the diff-comments integration, via `review-editor-diff-theme-and-narrow-layout.playwright.ts` (Chromium via Playwright, no source defect found).

- **Light and dark themes:** with a real, saved old-side diff comment in place, the diff tab renders with 0 automated axe-core violations (`wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`) in both themes.
- **320px narrow layout:** the Editor/Diff tab strip and the diff tab's own annotation controls remain visible and reachable, the page has no horizontal overflow (`document.documentElement.scrollWidth` never exceeds `clientWidth`), and axe reports 0 violations scoped to the mount.

This still has no continuous real-keyboard Tab-order walk of its own beyond the tab strip; `review-editor-diff-comments.playwright.ts`'s existing tests already exercise Enter/click-driven interaction end to end for every documented case (create, cancel/discard into the drafts inventory, cross-tab navigation focus, and read-only).

**Human acceptance: waived, not performed, by Steve Kinney.** Linear comment `a5463ac9-c4d0-455b-ba01-d30c3fcfdb9a` on COR-511, read directly by this agent with `list_comments`: "Human acceptance gate waived by Steve Kinney (2026-09-23) … 'Nothing needs my sign off.'" No human reviewed this work. VoiceOver was not driven in this session.

## Adversarial review follow-up (COR-511 verification review, no human review)

Reviewing the diff-comments composer against the contract ("Open clears only the necessary filters and focuses its composer," no read-only exception stated) found a real gap: **`handleDiffDraftOpen` never focused the reopened composer, in either mode**, unlike `diff-review.svelte`'s own "Open" action. There was no `composerFocusRequested`-style wiring at all. Its read-only branch also used a `disabled` textarea, which — even after adding focus wiring — could never actually receive focus in a real browser (disabled elements are unfocusable), so read-only "Open" would still have silently failed to focus anything.

Fixed: added the same request-flag-plus-`$effect` pattern already proven in `diff-review.svelte`, and changed the textarea from `disabled` to native `readonly` (blocks editing identically — Playwright's `toBeEditable()` still fails on it — while keeping the element focusable and its text selectable/copyable). Regression tests in `review-editor-diff-comments.playwright.ts`: a new editable-mode case, "Open on a pending draft focuses the reopened composer," and a `toBeFocused()` assertion added to the existing read-only "opening a pending draft while read-only" case. Both confirmed red (`toBeFocused()` timing out against the prior source) before the fix.

Related components: `markdown-editor`.
