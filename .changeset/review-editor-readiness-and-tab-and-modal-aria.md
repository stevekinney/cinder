---
'@lostgradient/editor': patch
---

Fix three `ReviewEditor` a11y/state-liveness defects, all found by
`stevekinney/chatroom`'s `/exercises/review-*` suite carrying them as pinned
known-bug regression tests.

`data-ready` was a latch (`editorViewReady`) set true on the inner editor's
first `onready`/selection-change and never cleared. Switching to the Diff or
Summary tab destroys the `MarkdownEditor` instance behind the `{#if
activeView === 'editor'}` branch, but `data-ready` kept reporting `"true"`
with no editor mounted — a consumer that waits on `data-ready` after a view
switch was acting on an editor that no longer existed. Fixed by deriving the
reset from `editorRef` itself (which Svelte's own `bind:this` unbinds to
`undefined` on unmount) rather than from a one-way latch, so `data-ready`
means "an editor is available right now" and comes back once the editor view
remounts and finishes initializing. Fixes #1301.

Two of the three view tabs (`Diff`, `Summary`) always pointed `aria-controls`
at a panel id that was not in the document, because the view area renders
exactly one panel via an `{#if}`/`{:else if}`/`{:else}` chain — the inactive
views' panels are removed entirely, not hidden. A screen reader following the
tab-to-panel relationship on an inactive tab found nothing. Fixed by only
passing `controls` to the ACTIVE segment; the inactive tabs now claim no
panel at all instead of a dangling one, which axe's `aria-valid-attr-value`
rule (every IDREF-valued ARIA attribute must resolve) confirms is clean.
Fixes #1303.

The thread popover declared `role="dialog" aria-modal="true"` while nothing
outside it — `.review-editor-main`, the comment sidebar — was made `inert` or
`aria-hidden`, and the component's own F6 landmark navigation deliberately
moves focus OUT of the popover into `.review-editor-main` while it stays
open. `aria-modal="true"` is a promise that everything outside the dialog is
unavailable; this popover never kept that promise, and F6 proves it was never
meant to. Chose to drop `aria-modal="true"` (rather than making the popover
genuinely modal by adding `inert` to the surrounding regions and removing
F6) because F6-out-without-closing is the popover's actual, intended
behavior — an anchored, non-modal comment popover, the same pattern as
Google Docs or a GitHub PR review thread, not a page-blocking dialog. The
existing Tab-trap-within-the-popover and Escape-to-restore behavior needed no
change either way and are unaffected. Fixes #1305.

Review follow-up on #1305: the thread popover's anchor only exists in the
editor view, so leaving it (Diff/Summary) unmounts `editorRef` — the same
unbind #1301's fix relies on. That turned F6's `customFocusHandler` for the
`'editor'` region into a no-op (`editorRef?.getView()?.focus()` on a null
ref) that still returned `true`, suppressing the region navigator's fallback
and stranding focus inside a popover pointing at content that was no longer
rendered — precisely the failure mode dropping `aria-modal` was supposed to
keep escapable. Fixed by closing the thread popover in the same
"left the editor view" branch that already clears the (separate) selection
popover for the same reason.

That popover-close, in turn, unmounts `ThreadPopover`, and its own focus trap
unconditionally restores focus on deactivate — even when the SAME
interaction that triggered the close (arrow-key roving-tabindex on the view
switcher) had already moved focus to the newly active tab a moment earlier
in the same call stack, stealing it back to the trap's `restoreFallback`
(the sidebar toggle). Corrected by re-asserting focus on the active tab
after `tick()`, once the trap's own restore has had its say — there is no
reactive hook into the trap's restore decision from the outside, so this
corrects the result rather than preventing the race.

Verified against the real Chromium accessibility tree (via the CDP
`Accessibility` domain), not just DOM attribute presence, for all three:
`role="textbox"` appearing/disappearing on the ProseMirror node in step with
`data-ready` (#1301, an implicit ARIA role from `contenteditable` with no DOM
attribute to assert on directly), an `aria-valid-attr-value` axe pass on the
tablist (#1303), and the computed `modal` AX property on the popover node
(#1305) — the same category of gap that made cinder#1292's first fix attempt
wrong until it was checked against the computed tree instead of attribute
presence alone.
