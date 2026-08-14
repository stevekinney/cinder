---
'@lostgradient/editor': patch
---

Make the comment composer's inline submit button clickable in WebKit, where it did nothing at all.

The button is revealed by `:focus-within` on its container, which also flips it from `pointer-events: none` to `auto`. WebKit does not focus a `<button>` on mousedown — so mid-gesture the textarea blurred, `:focus-within` dropped, `pointer-events` returned to `none` before mouseup, and the mouseup hit-tested to the textarea instead. Per spec the `click` then retargeted to the nearest common ancestor, the wrapper `<div>`, so the button never saw a click and the form never submitted. In Safari the composer's primary affordance was dead and the only working path was the undiscoverable Cmd+Enter.

Worth stating because it decides where the fix belongs: the engine behavior is benign on its own. A minimal page with no component code submits an ungated textarea+button form identically in all three engines; only the `:focus-within` gate breaks it, and only in WebKit. The stylesheet is what turned a spec-legal engine behavior into a broken control.

Fixed by suppressing mousedown's default focus change on the submit, so the textarea keeps focus for the whole gesture and `:focus-within` never drops. Not fixed by keeping `pointer-events: auto` while `opacity: 0`, which would leave an invisible click target over the textarea. `CommentComposer` is shared, so this covers the inline composer, the thread popover, and the selection popover.

Fixes #1295.
