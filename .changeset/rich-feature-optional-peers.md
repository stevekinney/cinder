---
'@lostgradient/cinder': minor
---

Move rich editor, markdown rendering, and syntax-highlighting packages out of the base install path. Styles-only and lightweight component consumers no longer install Milkdown, ProseMirror, Shiki, remark, or rehype trees unless they opt into the rich feature surfaces.

Consumers importing `@lostgradient/cinder/chat` with the default composer, `@lostgradient/cinder/markdown-editor`, `@lostgradient/cinder/review-editor`, `@lostgradient/cinder/markdown`, `@lostgradient/cinder/markdown/*`, `@lostgradient/cinder/editor`, `@lostgradient/cinder/editor/*`, `@lostgradient/cinder/commentary`, `@lostgradient/cinder/commentary/*`, `@lostgradient/cinder/highlighters/shiki`, or relying on `Chat` built-in markdown/tool message rendering or `CodeBlock` automatic highlighting should install the listed optional peer dependencies, including the public markdown AST type packages, for those rich features. `MarkdownEditor` and `ReviewEditor` are now subpath-only imports so the root barrel can stay usable without rich optional peers.
