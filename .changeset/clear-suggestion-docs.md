---
'@lostgradient/chat': patch
---

Correct the `SuggestionMessagePart` documentation to explain that selecting a suggestion invokes the callback and refocuses the composer without automatically removing the chips, and document returning `[]` from `messageSuggestions` to suppress them.
