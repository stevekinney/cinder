# @lostgradient/editor

`@lostgradient/editor` is Cinder's Svelte 5 markdown editing, review, and diffing surface —
`MarkdownEditor` (Milkdown/ProseMirror-based rich editing), `ReviewEditor` (threaded comments,
front matter, export), and `DiffViewer` (word-level Markdown diffing) — packaged separately so
applications that only render buttons and tables do not install milkdown, prosemirror, or their
own copy of `@lostgradient/markdown`.

## Install

Install the package and its peer dependencies together:

```bash
bun add @lostgradient/cinder @lostgradient/editor @lostgradient/markdown @milkdown/ctx @milkdown/kit @milkdown/prose prosemirror-inputrules prosemirror-model prosemirror-state prosemirror-view svelte
```

The supported Svelte peer range is `>=5.56.0 <6`; this package is developed against Svelte
`5.56.0`. `@lostgradient/cinder`, `@lostgradient/markdown`, `svelte`, and the milkdown/prosemirror
packages are all peer dependencies — your application supplies a single copy of each.

Import Cinder's global styles once in your application, then import a component from its own
subpath:

```ts
import '@lostgradient/cinder/styles';
import MarkdownEditor from '@lostgradient/editor/markdown-editor';
```

```svelte
<MarkdownEditor value={source} onchange={(next) => (source = next)} />
```

Each component ships its own stylesheet, included by the component entry. Applications that need
a component's stylesheet as a standalone asset can import its `/styles` subpath, e.g.
`@lostgradient/editor/markdown-editor/styles`.

## Components

- `@lostgradient/editor/markdown-editor` — the rich Markdown editing surface.
- `@lostgradient/editor/review-editor` — threaded review comments, front matter, and export,
  composing `MarkdownEditor` and `DiffViewer`.
- `@lostgradient/editor/diff-viewer` — word-level Markdown diffing with front-matter and revert
  affordances.

Each component subpath also exposes `/schema`, `/variables`, `/styles`, and `/examples`.

## Why a separate package

`@lostgradient/cinder` used to carry milkdown, prosemirror, and this package's headless runtime as
`peerDependencies` for exactly these three components. Installing Cinder for a `<Button>` asked
your package manager to satisfy a full ProseMirror editor stack. See
[`docs/decisions/package-boundaries.md`](../../docs/decisions/package-boundaries.md) for the full
rationale — this package is Phase 3 of that plan.
