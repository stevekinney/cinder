---
'@lostgradient/editor': minor
---

Keep a comment when its anchored text is cut, stop trapping Tab inside lists,
fix front-matter diffs, and make soft comment deletion work.

**Cutting and pasting commented text no longer destroys the comment**
(cinder#1284). Re-anchoring is debounced 300ms, and deletion is indistinguishable
from a cut at the moment the text disappears — so a person who cut a commented
paragraph and pasted it back a second later lost the comment, with no undo.
`AnchorStatus` gains `'orphaned'`: a vanished quote now marks the anchor orphaned
and KEEPS the thread, rendering no decoration and retrying on every later pass, so
restoring the text restores the anchor. The comment sidebar marks such threads and
says their quoted text is missing. Removing a thread is now the consumer's
decision — the component no longer does it on the user's behalf, and
`onAnchorDeleted` is deprecated and never called.

**Tab is no longer a keyboard trap inside list items** (WCAG 2.1.2). Tabbing in
put the caret at the end of the document; if that block was a list item, the
sink/lift keymap consumed both Tab and Shift+Tab, so the only way out was to keep
re-indenting the bullet. Tab still indents inside a list, but there is now an
escape.

**`generateUnifiedDiff` no longer corrupts YAML front matter.** `normalize()`
re-read the `---` fences as a thematic break plus a setext heading, injecting
8-dash lines and wrong hunk headers and producing a patch `git apply` rejects —
through `exportUnifiedDiff()`, the `<name>-diff` hidden input, and the Copy Diff
menu item, while the docs promise git-appliable output. Front matter is parsed
off, only the body is normalized, and the front matter is re-attached verbatim.

**`deleteComment` no longer silently no-ops on the event the component emits.**
It bailed when a soft delete omitted `deletedAt`, but `CommentDeleteEvent` has no
such field, so the obvious wiring typechecked and did nothing — after the
component had already announced "Comment deleted". The reducer now stamps the
timestamp itself; an explicit `deletedAt` still wins.

**The editor's loading placeholder is no longer visible text.** `EditorSkeleton`
hid it with a bare `sr-only` class that Cinder does not ship, so "Loading
editor..." rendered as body copy during load and permanently without JavaScript.
