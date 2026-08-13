---
'@lostgradient/editor': patch
---

Stop the Escape-then-Tab focus escape from outliving focus. Pressing Escape inside a list arms a
one-shot latch that lets the next Tab leave the editor (WCAG 2.1.2), and the latch was validated
only against editor state. Leaving the editor and returning to the same caret applies no
ProseMirror transaction, so the document and selection still looked untouched and the latch stayed
armed indefinitely: press Escape to dismiss a menu, click away, click back, then press Tab meaning
"indent this bullet" and focus is thrown out of the editor instead. The latch now clears when focus
leaves the editable surface. Escape immediately followed by Tab still escapes, and a Tab with no
Escape before it still indents.
