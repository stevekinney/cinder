# @lostgradient/markdown

`@lostgradient/markdown` is a headless Markdown pipeline: CommonMark + GFM parsing and
deterministic serialization, sanitized HTML rendering (with math and syntax highlighting),
word-level diffing, and placeholder templating. It has no Svelte dependency — use it from a
server, a build script, or any other non-component context.

## Install

```bash
bun add @lostgradient/markdown
```

This package has no peer dependencies. Its runtime dependencies (remark, rehype, unified,
shiki, diff-match-patch, js-yaml, comlink) are installed automatically.

## Usage

````ts
import { parse, serialize } from '@lostgradient/markdown/pipeline';
import { renderMarkdown } from '@lostgradient/markdown/rendering';
import { computeLineDiff } from '@lostgradient/markdown/diff/line-diff';
import { renderTemplate } from '@lostgradient/markdown/templates/template-render';

const parsed = parse('# Hello *world*');
if (parsed.success) serialize(parsed.ast);

const { html } = renderMarkdown('# Hi\n\n```ts\nconst x = 1;\n```');
const diff = computeLineDiff('a\nb', 'a\nc');
const filled = renderTemplate('Hello {{name}}', { name: 'World' });
````

## Subpaths

- `.` / `./pipeline` — parse, serialize, and AST utilities.
- `./diff`, `./diff/line-diff`, `./diff/types` — word- and line-level diffing.
- `./rendering`, `./rendering/types`, `./rendering/highlighter`, `./rendering/mermaid-cache` —
  Markdown-to-sanitized-HTML rendering, syntax highlighting, and Mermaid diagram caching.
- `./templates/*` — placeholder resolution and template rendering (DOM-free).
- `./utilities/safe-url`, `./utilities/sort-keys` — small standalone helpers.

## Provenance

This package absorbed the former workspace-private `@cinder/diff` package (word/line diffing)
and the headless half of `@cinder/editor` (templating) — see
[`docs/decisions/package-boundaries.md`](https://github.com/stevekinney/cinder/blob/main/docs/decisions/package-boundaries.md)
for the extraction history.
