---
'@lostgradient/chat': patch
---

Cap the grouped tool-call transcript row (`ToolCallTimeline`'s `.chat-tool-call-timeline`) to the same shared readability max-width every other row respects, via the new `--cinder-chat-message-max-width` token. Previously this row — the one carrying the widest content in the transcript, serialized JSON arguments and results — had no inline-size constraint of its own and stretched to the full timeline width on wide viewports. Also fix a grid track sizing issue that let an expanded tool-call group's long, unbroken payload blow out past that cap instead of scrolling within its own code block.
