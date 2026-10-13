---
'@lostgradient/editor': patch
---

Document `MarkdownEditor`'s template placeholders and preview on the npm README: `placeholderDefinitions`, completion, `placeholderValues` and `placeholderValueMode` in preview, `modeToggleVisible`, `onPlaceholderDiagnosticsChange`, and the conflict with the low-level `placeholderCompletion` and `placeholderDecoration` props. These need `@lostgradient/markdown` 0.6.0 or later.

Restating the 0.15.0 breaking changes, which its release notes omitted: `placeholderCompletion` and `placeholderDecoration` are reactive and cannot be combined with `placeholderDefinitions`; the completion popup's rows, ordering, keyboard and pointer handling, undo step, replacement range and token scanning changed; `EditorConfig.placeholders` replaces `placeholderCompletion`/`placeholderDecoration` and the template plugins take new arguments; popup styles moved into `prosemirror.css`; `EditorMode` adds `'preview'`, the mode toggle renders outside the default toolbar and `onModeChange` fires after the flushed value; `ToolbarContext` adds `mode`, `canEdit` and `onModeChange`; `EditorState` implementations must add `flushPendingChange()` and `resetDocument(content)`; and source mode keeps its own undo history.
