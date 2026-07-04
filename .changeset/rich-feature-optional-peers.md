---
'@lostgradient/cinder': patch
---

Move rich editor, markdown rendering, and syntax-highlighting packages out of the base install path. Styles-only and lightweight component consumers no longer install Milkdown, ProseMirror, Shiki, remark, or rehype trees unless they opt into the rich feature surfaces.

Consumers importing `@lostgradient/cinder/markdown-editor`, `@lostgradient/cinder/review-editor`, `@lostgradient/cinder/markdown/*`, or `@lostgradient/cinder/highlighters/shiki` should install the listed optional peer dependencies for those rich features.
