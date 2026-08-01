# Editor, diff, message, and chat surface boundaries

Decision: retain both near-neighbour pairs as accepted duplication. The
dependency direction remains editor/chat → Cinder; Cinder does not import either
downstream package.

## Diff viewers

- Editor `diff-viewer` owns review-editor presentation and editor-runtime
  integration: ProseMirror/Milkdown context, commentary, editable review
  workflows, and editor-specific actions. Avoid it for a standalone unified
  diff in a Cinder application.
- Cinder `source-diff-viewer` owns a dependency-light read-only source diff. It
  parses unified-diff text, renders syntax-oriented additions/deletions, and
  remains usable without the editor package. Avoid it for editable review or
  commentary workflows.

The visual overlap is intentional; their parsers, dependency owners, and
interaction contracts differ. Sharing either implementation would reverse the
package boundary or force editor dependencies into Cinder core.

## Message renderers

- Cinder `Message` owns the core chat message surface: role/content layout,
  markdown-safe rendering hooks, status states, and action affordances usable by
  any Cinder consumer. Avoid it when the Chat package's conversation state and
  transport context are required.
- Chat's message renderer owns Chat-specific conversation state, streaming and
  tool-call presentation, transport metadata, and package-level composition. It
  may compose Cinder primitives, but Cinder must not depend on Chat. Avoid it
  for a generic standalone message.

These are domain adapters, not duplicate sources of truth. New shared visual
primitives should be added to Cinder only when they have a domain-neutral API;
editor or Chat behavior remains in its owning package. Any future consolidation
must preserve the one-way dependency and add focused import/runtime coverage.
