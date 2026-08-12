---
'@lostgradient/chat': patch
---

Fix a transcript that froze at whatever it first rendered.

A keyed `{#each}` whose body starts with a conditional renders its initial items
and then never inserts or removes another one (Svelte 5.56.4). The static row
list's body is `{@render renderChatRow(row)}`, and that snippet opens with
`{#if renderRow.type === 'date'}` — so once a non-virtualized `Chat` had
rendered, its rows were fixed.

Messages appended to `conversation` never appeared. Messages removed from it
never left. Setting `hidden: true` on a message left it on screen, which is the
opposite of what hiding is for: a redaction or moderation flow kept displaying
the content it had just retracted. Message _content_ updates worked the whole
time, which is what made this hard to see, and `messages` and `renderRows` both
held the correct values throughout - only the DOM was stale.

Anything derived from the rendered set drifted with it: virtualizer
measurements, unread bookkeeping, and jump-to-latest were all working from a row
list that no longer matched the conversation.

A static element in the each body restores reconciliation. Nothing else does: an
inline conditional, a per-branch snippet, and a component whose own root is
conditional all reproduce it. The virtualized path was never affected, because
its rows are already wrapped in `.chat-virtual-row`.
