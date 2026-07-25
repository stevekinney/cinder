---
'@lostgradient/cinder': minor
'@lostgradient/chat': minor
'@lostgradient/editor': minor
---

Standardize component prop API vocabulary across handlers, bindable values,
boolean props, polymorphic `as` props, and component names. This removes
`defaultValue` public props in favor of bindable `value`, splits value
interceptors to `onValueChangeRequest`, renames lowercase custom callbacks to
camelCase notification props, and adds an AST guard that prevents these
conventions from drifting.
