---
'@lostgradient/cinder': minor
---

`Chat` composer public API: added `clearInput()`, `getComposerValue()`, and an `oncomposerinput` callback prop so consumers can read, clear, and observe the composer's plain-text value without reaching into `.chat-input-editor` DOM directly (useful for building slash-command, mention, or autocomplete UX layered on top of the composer).

Also re-exported the `ChatAttachment` type from the public `@lostgradient/cinder/chat` entry — previously consumers had to derive it from `ChatSubmitEvent['attachments'][number]`.
