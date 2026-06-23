# LoadMore Accessibility

- `LoadMore` marks its own wrapper `aria-busy` while `loading` is true. The list
  container itself is still the caller's responsibility; bind the same
  `loading` state to the list so assistive technology can associate the busy
  state with the results being appended.
- The sentinel is rendered as an `aria-hidden="true"` element. It exists only to
  trigger loading and should never contribute to the accessibility tree.
- The component includes a polite live region that announces `endOfListMessage`
  only when `hasMore` transitions from `true` to `false`. It clears again if
  `hasMore` flips back to `true`, so later end-of-list transitions can be
  announced cleanly.
- The manual button remains available whenever `hasMore` is true. After
  `onloadmore` rejects, the label switches to `retryLabel` and the button
  becomes the recovery path.
- The built-in spinner animation is disabled automatically for users who prefer
  reduced motion. Any item entrance animation in the caller's list is outside
  this component's scope and should follow the same preference.
- The sentinel auto-load path disables itself after `maxRetries` consecutive
  requests. The button still works after that cap, which keeps the control
  recoverable without a hidden background loop.
- Without JavaScript, Svelte event handlers do not run. If you need a real
  server-rendered fallback, wrap the list in your own `<form>` and place a
  normal submit button beside `LoadMore`.
