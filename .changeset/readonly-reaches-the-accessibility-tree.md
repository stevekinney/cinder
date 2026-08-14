---
'@lostgradient/editor': patch
---

Convey `readonly` to assistive technology in the WYSIWYG editor, which previously announced a read-only document as an ordinary editable text box.

`setEditorReadonly` set ProseMirror's `editable` prop, giving the node `contenteditable="false"`. That stops edits but does not convey read-only-ness: Chromium still computed the resulting textbox as `readonly=false, settable=true` — the same state an editable editor reports. So a screen reader announced an editable field, and typing into it did nothing and said nothing.

The same component already got this right in source mode, where the `<textarea>` carries the native `readonly` attribute. Switching an editor between its two view modes should not change whether a user is told the document is read-only.

The state is now mirrored onto `view.dom` as `aria-readonly`, alongside the `aria-label` that is applied there for the same reason. That placement is not incidental: measured with CDP `Accessibility.getFullAXTree`, `aria-readonly` on the wrapping `role="application"` host changes nothing, because the textbox role lives on the ProseMirror node and ARIA states do not inherit down to it.

Fixes #1292.
