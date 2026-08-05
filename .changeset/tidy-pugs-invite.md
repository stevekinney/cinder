---
'@lostgradient/markdown': minor
---

Render GitHub alert blockquotes (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) as Cinder Callout markup, and stop emitting a phantom blank line under every highlighted code fence.

- New `remarkGithubCallouts` plugin, registered after `remark-gfm` in both the sync and math-aware pipelines. GitHub alerts are a GitHub extension rather than part of GFM, so `remark-gfm` left the marker in the output as literal text. Blockquotes that open with a marker now become `<div role="note" data-cinder-variant="…" class="cinder-callout …">`, which picks up `callout.css` from `@lostgradient/cinder`. Text after the marker on the same line becomes the callout title; without it, the alert type supplies the title. Blockquotes with no marker are untouched.
- The sanitize schema now allows `role` (value-restricted to `note`), `data-cinder-variant` (restricted to the four Cinder variants), and `aria-label` on `div`. The schema's `'*': ['className']` entry replaces `hast-util-sanitize`'s default wildcard allowlist, so without this the callout attributes were silently stripped. Scoped to `div` with value allowlists rather than widened globally, so no document can put an arbitrary `role` on an arbitrary element.
- `rehype-shiki-sync` now strips the single trailing newline `mdast-util-to-hast` appends to every fence before handing the code to Shiki. Shiki was treating it as the start of another line and emitting a trailing empty `<span class="line">`. Exactly one newline is removed, so fences that deliberately end in blank lines keep them.
- `renderMarkdown` / `renderMarkdownWithMath` now run the processor's mdast transformers (`runSync`) in addition to parsing. Previously only `parse()` ran, which was invisible while every registered remark plugin contributed micromark extensions only.
