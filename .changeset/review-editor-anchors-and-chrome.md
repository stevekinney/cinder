---
'@lostgradient/editor': minor
---

Fix ReviewEditor's seeded-thread anchoring, wire the documented thread
auto-delete, expose the imperative surface, and collapse the editor view's
stacked toolbars into one row.

Found by exercising the published package as a consumer would — rendering
`ReviewEditor` with persisted `threads` already in the prop, which is the most
common way an app loads a saved review.

**Seeded threads highlighted the entire document.** Milkdown sets the initial
document with a single step spanning the whole doc. Anchors present at that
moment were mapped through it, so `map(from, -1)` collapsed to 0 and
`map(to, 1)` expanded to the document end, and every seeded thread decorated
every block. The mapping's "follow the edit" branch then overwrote the anchor's
`quote` with the entire document text without raising `needsReanchor`, so
deferred re-anchoring never ran and the only data that could have recovered the
anchor was gone. A wholesale replacement now bypasses position mapping entirely
and defers to re-anchoring, which locates anchors by quote.

Syncing threads into the plugin also verifies each anchor against the document
instead of trusting its `from`/`to`, and raises re-anchoring for any that do not
check out. `from`/`to` are ProseMirror positions — not raw-Markdown indices and
not `doc.textBetween()` offsets, which sit in the same object as
`lastKnownOffset` — and no prop documentation said so, so seeded anchors were
routinely in the wrong coordinate space with nothing to signal it.

**Threads whose anchor text was deleted were never removed.** `comments/types.ts`
documents that threads have no "orphaned" state because "When anchor text is
deleted, threads are automatically removed". The plugin detected the condition
and called `onAnchorDeleted`, but ReviewEditor constructed the plugin without
that handler. The decoration vanished while the thread stayed in the bindable
`threads` array pointing at text that no longer existed, and `onthreaddelete`
never fired. The handler is now wired.

**The imperative surface was unreachable.** The implementation exports ~22
instance methods, but the public wrapper rendered it without `bind:this` and
re-exported nothing, so `bind:this` on `<ReviewEditor>` produced a component
with no methods — putting the whole `getState`/`setState` persistence
round-trip out of reach from the published entry point. The wrapper now forwards
them.

**Announcements rendered as visible text.** `LiveRegion` hid itself with
`class="sr-only"`; Cinder ships `.cinder-sr-only`, a bare `.sr-only` is defined
nowhere, and the component has no `<style>` block of its own.

**The comments toggle's `aria-controls` never resolved.** It derived the
sidebar's id from its own (`{id}-controls`), advertising
`{id}-controls-sidebar` while the sidebar is `{id}-sidebar`. The id is now
passed in explicitly.

**The editor view stacked two toolbars.** The diff view already passes
DiffViewer an empty toolbar snippet ("controls are in the unified bar above")
and the summary view passes `showToolbar={false}`, but the editor view passed
neither — costing ~90px of chrome before any document content. The formatting
controls now render inside the unified bar, halving that to ~41px.

To make that possible, `MarkdownEditor` gains `ontoolbarcontextchange`, and
`ToolbarContext` now also carries `onUndo`, `onRedo`, `onLinkClick`, and
`linkPopoverOpen`. Both are additive. The handlers close a real gap: the
documented `toolbar` snippet claims to replace the default toolbar, but without
them a caller could not reproduce undo, redo, or the link popover.

The unified bar's `role` changes from `toolbar` to `group`. It contains a
`tablist` — never a valid child of `toolbar` — and now the editor's own
`toolbar`, and a `toolbar` may not nest inside a `toolbar`. A labelled `group`
describes what the bar is and keeps its children valid.
