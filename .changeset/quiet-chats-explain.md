---
'@lostgradient/chat': patch
---

Clarify that defined `typingParticipants` and `readReceipts` props determine visible state, including empty arrays and maps, while adapter events and derived state continue behind them. Both props now explicitly accept `undefined` so consumers using `exactOptionalPropertyTypes` can return visible state to the adapter path.
