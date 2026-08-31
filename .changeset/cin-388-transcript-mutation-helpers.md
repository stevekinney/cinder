---
'@lostgradient/chat': minor
---

Re-export Conversationalist's canonical transcript mutation helpers—`updateMessage`, `removeMessage`, `setMessageHidden`, and `replaceToolResult`—along with the `MessageUpdate` type, so consumers no longer need to import `conversationalist` directly or hand-walk transcript internals for these common mutations. Unknown message or tool-call identifiers are no-ops.

Root-export the existing `getMessages` query helper, and add two new typed query helpers: `getUnresolvedToolApprovals` (finds every `tool-result` message still parked on `action_required` with a pending action) and `findToolResultMessage` (locates a `tool-result` message by tool-call identifier).

Bumps the `conversationalist` dependency to `^1.0.0`.

Adds a provider-neutral streaming session controller and newline-delimited stream codec with injected transport, immutable conversation accessors, retry, edit-and-rewind, cancellation, delivery failure, bounded tool continuation, and application-owned approval hooks.
