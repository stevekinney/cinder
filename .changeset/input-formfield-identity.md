---
'@lostgradient/cinder': minor
---

Input inside a `FormField` keeps its native element when `label`, `description`, or `error` appears or disappears — the common case is validation setting `error` while the user is still in the field. A context-wrapped Input now always renders its own nested `FormFieldFrame`, with `label`/`description`/`error` simply absent when unset, instead of switching between that frame and a bare control render as those props become truthy. One stable code path means the `<input>` never moves between template arms, so focus, the selection range, and IME composition survive the toggle.

DOM contract change for consumers styling or querying the native control from inside a `FormField`-wrapped Input with no `label`, `description`, or `error` of its own: the control is now always inside a nested `.cinder-form-field` frame, where it previously rendered bare. Descendant selectors still match; a direct-child selector onto the bare control needs the frame's control wrapper inserted. `TimeField`'s own control-row sizing was the one in-repo case and is updated.
