---
'@lostgradient/cinder': minor
---

Input keeps its native element when a `leading` or `trailing` addon appears or disappears. The control wrapper is now always rendered — `.cinder-input-group` with addons, a boxless `.cinder-input-host` (`display: contents`) without — so the `<input>` has one stable position in the tree instead of moving between template arms, and focus, the selection range, and IME composition survive the toggle. Unadorned inputs lay out exactly as before, and the host carries `data-cinder-full-width` so ancestors that detect a full-width control by direct child keep matching.

DOM contract change for consumers styling the native control: an unadorned `.cinder-input` is no longer a direct child of its frame or of the element that composes it. Descendant selectors (`.your-row .cinder-input`) still match; a direct-child selector (`.your-row > .cinder-input`) must become `.your-row > .cinder-input-host > .cinder-input`. TimeField's own control-row sizing was the one in-repo case and is updated.
