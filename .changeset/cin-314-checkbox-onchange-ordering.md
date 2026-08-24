---
'@lostgradient/cinder': patch
---

Fix `Checkbox` forwarding a mutated event to `onchange` instead of the browser's raw native event.

Previously, `handleChange` ran `commitValue` (which invokes `onValueChangeRequest`/`onValueChange` and can veto the toggle) and mutated the DOM's `checked` state _before_ calling the consumer's `onchange`. That meant a consumer reading `event.target.checked` (or `event.currentTarget.checked`) inside `onchange` would see Cinder's post-veto value, not what the user actually did in the browser.

**Migration note:** `onchange` now fires immediately after the native change event arrives, forwarding the raw, pre-veto `checked` value—before `onValueChangeRequest`, `onValueChange`, or the DOM re-sync run. If your `onchange` handler relied on the DOM already reflecting a vetoed/committed value, switch to `onValueChange` (fires with the committed value) or `onValueChangeRequest` (can inspect/veto the proposed value) instead.
