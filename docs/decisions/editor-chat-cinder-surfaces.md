# Editor, diff, message, and chat surface boundaries

Decision: retain both near-neighbour pairs as accepted duplication. The
dependency direction remains editor/chat → Cinder; Cinder does not import either
downstream package.

## Diff viewers

- Editor `diff-viewer` owns the Markdown review surface in the editor package:
  normalization, front-matter handling, hunked and word-level changes, view
  modes, and revert actions. Avoid it for a standalone unified diff in a
  Cinder application.
- Cinder `source-diff-viewer` owns a dependency-light read-only source diff. It
  parses unified-diff text, renders structured file/hunk rows with additions
  and removals, and remains usable without the editor package. Avoid it for
  Markdown review workflows that need normalization or revert actions.

The visual overlap is intentional; their parsers, dependency owners, and
interaction contracts differ. Sharing either implementation would reverse the
package boundary or force editor dependencies into Cinder core.

## Message renderers

- Cinder `Message` owns the domain-neutral message shell: role/name and
  timestamp chrome plus an arbitrary body snippet usable by any Cinder
  consumer. Avoid it when the Chat package's conversation state, transport,
  streaming, or tool-call context is required.
- Chat `ChatMessage` owns Chat-specific message rendering: adapter-provided
  metadata, streaming state, and tool-call presentation. The `Chat` container
  and `ChatAdapter` own conversation state and transport. `ChatMessage` may
  compose Cinder primitives, but Cinder must not depend on Chat. Avoid it for a
  generic standalone message.

These are domain adapters, not duplicate sources of truth. New shared visual
primitives should be added to Cinder only when they have a domain-neutral API;
editor or Chat behavior remains in its owning package. Any future consolidation
must preserve the one-way dependency and add focused import/runtime coverage.
