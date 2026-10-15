---
'@lostgradient/cinder': minor
---

`CodeBlock` no longer bundles Shiki's full grammar and theme registries. It used to fall back to a lazily imported default highlighter, and that `import()` made every consumer's bundler emit all of Shiki's grammars and themes, even when the consumer passed its own `highlighter`. `CodeBlock` now imports no highlighter: it highlights with its `highlighter` prop, then with a highlighter an ancestor publishes through the new `setCodeHighlighterContext(highlighter)`, and otherwise renders unhighlighted.

To keep automatic highlighting of every language Shiki ships, publish the full-registry highlighter, now exported as `fullShikiHighlighter`, near your application's root with `setCodeHighlighterContext(fullShikiHighlighter())`. An application that knows its languages should build a `shikiHighlighter` with explicit `languageLoaders` and `themeLoaders` instead, so its bundle carries only those grammars and themes. `ApprovalCard` and `RunStepTimeline` highlight through the context highlighter; the JSON Schema editor's JSON view highlights with its own JSON-only highlighter.
