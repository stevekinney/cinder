---
'@lostgradient/chat': patch
---

Fixed `Chat`'s public wrapper so `bind:atBottom`, `bind:unreadCount`, and `bind:newMessageIndicatorVisible` no longer fail `svelte-check` with "Cannot use 'bind:' with this property. It is declared as non-bindable inside the component." The wrapper previously spread these props through `...rest` instead of declaring them with `$bindable()` and forwarding them to the internal implementation, so the package's emitted type declaration reported them as non-bindable even though `ChatProps` documented them as bindable. All three props now work correctly with `bind:`.
