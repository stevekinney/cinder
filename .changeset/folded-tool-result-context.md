---
'@lostgradient/chat': minor
---

Pass a shared `ChatRowContext` to the `row`, `messageActions`, and `messageStatus` snippets. Paired tool results are folded into the visible tool-call row's context, so consumers can inspect the resolved `ToolCallPair` without rendering a duplicate result row or maintaining an external message lookup.
