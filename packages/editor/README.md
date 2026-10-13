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
<MarkdownEditor id="post-body" value={source} onValueChange={(next) => (source = next)} />
```

`id` is required — `MarkdownEditorProps` has no default and the component uses it for the
accessibility identifiers it renders (labels, `aria-*` attributes on the editable surface).

Each component ships its own stylesheet, included by the component entry. `review-editor` also
ships its stylesheet as a standalone asset via `@lostgradient/editor/review-editor/styles`.
`markdown-editor` and `diff-viewer` style entirely through scoped `<style>` blocks compiled inline
by Svelte — there is no separate `/styles` subpath for those two.

## Components

- `@lostgradient/editor/markdown-editor` — the rich Markdown editing surface.
- `@lostgradient/editor/review-editor` — threaded review comments, front matter, and export,
  composing `MarkdownEditor` and `DiffViewer`.
- `@lostgradient/editor/diff-viewer` — word-level Markdown diffing with front-matter and revert
  affordances.

Each component subpath also exposes `/schema`, `/variables`, and `/examples`. Only
`review-editor` additionally exposes `/styles` (see above).

### MarkdownEditor template placeholders and preview

`MarkdownEditor` completes, validates, and previews `{{path}}` template placeholders. This needs
`@lostgradient/markdown` 0.6.x, which is this package's peer range (`^0.6.0`); the
placeholder definitions, values, and diagnostics types come from the root of
`@lostgradient/markdown`, and its README documents the headless resolver, diagnostic codes, and
security boundary.

```svelte
<script lang="ts">
  import type { PlaceholderDiagnostic } from '@lostgradient/markdown';
  import MarkdownEditor, { type MarkdownEditorProps } from '@lostgradient/editor/markdown-editor';

  const definitions: MarkdownEditorProps['placeholderDefinitions'] = {
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name' },
        count: { type: 'integer' },
      },
    },
  };
  const values: MarkdownEditorProps['placeholderValues'] = { name: 'Alice', count: 42 };

  let value = $state('Hello {{name}}, you have {{count}} messages.');
  let diagnostics = $state<readonly PlaceholderDiagnostic[]>([]);
</script>

<MarkdownEditor
  id="welcome-template"
  label="Welcome template"
  bind:value
  modeToggleVisible
  placeholderDefinitions={definitions}
  placeholderValues={values}
  onPlaceholderDiagnosticsChange={(next) => (diagnostics = next)}
/>
<p>{diagnostics.length} placeholder problems</p>
```

- **`placeholderDefinitions`** (`{ schema }` or `{ candidates }`) is the one allowlist used for
  completion, invalid-token decoration, diagnostics, and preview fill. Replacing the object
  updates the live editor without recreating it or touching its document, undo history, or
  selection.
- **Completion.** Typing `{{` opens a listbox in both the rich editor and raw Markdown (source)
  mode. Filtering is a case-insensitive path prefix; each row shows the path, its declared types,
  and its description, never a value. ArrowUp and ArrowDown stop at the ends, Enter or a click
  inserts, Tab and Escape dismiss. Code, inline code, link targets, and readonly editors never
  open completion.
- **Preview.** `mode` accepts `'wysiwyg'`, `'source'`, or `'preview'`, and `modeToggleVisible`
  shows a Rich / Raw / Preview toggle. Preview renders the current value with
  `placeholderValues` filled in, encoded as literal text unless `placeholderValueMode` is
  `'markdown'`.
- **Diagnostics.** `onPlaceholderDiagnosticsChange` receives the current ordered
  `PlaceholderDiagnostic` list (for example `unknown_placeholder` or `malformed_token`) whenever
  it changes.
- **Low-level alternative.** `placeholderCompletion` and `placeholderDecoration` remain available
  for async lookup and custom decoration, and are reactive. They cannot be combined with
  `placeholderDefinitions`: the prop types reject the mix, and at runtime the editor reports
  `conflicting_configuration`, turns placeholder completion and decoration off, keeps editing, and
  resumes when the conflict is removed.
- The `placeholder` prop is unrelated: it is the hint text an empty editor shows and is never
  scanned or filled.

The component's own README, shipped in the package at
`dist/components/markdown-editor/README.md`, covers completion, source-mode history, and preview
in full.

### DiffViewer toolbar override

`DiffViewer`'s `toolbar` snippet prop is **total replacement**, not inversion of control: supplying
it removes the entire built-in toolbar — the view-mode control, stat badges, copy and revert
actions, and change navigation — with whatever the snippet renders instead. Unlike
`@lostgradient/chat`'s `messagePart`/`row` overrides (see the "Overriding built-in rendering"
section of [`@lostgradient/chat`'s README](https://github.com/stevekinney/cinder/blob/main/packages/chat/README.md)),
`toolbar` receives a read-only `DiffToolbarContext` (`hasChanges`, `hunks`, `stats`, `viewMode`) and
no `renderDefault` snippet — there is no way back to the built-in toolbar from inside an override.

This is intentional, not an oversight: a caller embedding a standalone diff view outside a chat or
review context may want a fully custom toolbar with no built-in chrome at all, which total
replacement gives directly. Chat's built-in row and part rendering carries state (streaming,
tool-call presentation, artifact resolution) that most overrides want to keep and only augment —
`DiffViewer`'s toolbar does not carry equivalent state, so replacing it outright is a reasonable
default rather than a gap.

One sharp edge worth knowing: `toolbarActions` — documented as the way to add a button to the
toolbar _without_ replacing it — is only rendered from inside the _built-in_ toolbar. Supplying
both `toolbar` and `toolbarActions` silently drops `toolbarActions`, since the override branch
never renders it. If you need both custom chrome and the extra action, put the action's markup
directly inside your `toolbar` snippet instead of relying on `toolbarActions`.

## Breaking changes in 0.15.0

Version 0.15.0 renamed component props and callbacks to camelCase, removed some re-exports,
shipped template placeholders, preview mode, and source-mode history for `MarkdownEditor`, and
raised the `@lostgradient/markdown` peer floor to `^0.6.0` (whose own placeholder API changed; see
its README).

### Renamed props and callbacks

The old names are no longer in the prop types. Rename them as follows:

| Where                                                                                   | 0.14 name                | 0.15 name                |
| --------------------------------------------------------------------------------------- | ------------------------ | ------------------------ |
| `MarkdownEditorProps`                                                                   | `showModeToggle`         | `modeToggleVisible`      |
| `MarkdownEditorProps`                                                                   | `showToolbar`            | `toolbarEnabled`         |
| `MarkdownEditorProps`, `ReviewEditorProps`                                              | `onchange`               | `onValueChange`          |
| `MarkdownEditorProps`                                                                   | `onready`                | `onReady`                |
| `MarkdownEditorProps`                                                                   | `onmodechange`           | `onModeChange`           |
| `MarkdownEditorProps`                                                                   | `onselectionchange`      | `onSelectionChange`      |
| `MarkdownEditorProps`                                                                   | `ontoolbarcontextchange` | `onToolbarContextChange` |
| `MarkdownEditorProps`, `EditorConfig`, `EditorAttachmentOptions`, `EditorKeymapOptions` | `oncommentshortcut`      | `onCommentShortcut`      |
| `ReviewEditorProps`, `ThreadManagerOptions`, `SelectionPopoverOptions`                  | `onthreadcreate`         | `onThreadCreate`         |
| `ReviewEditorProps`, `ThreadManagerOptions`                                             | `onthreaddelete`         | `onThreadDelete`         |
| `ReviewEditorProps`, `ThreadManagerOptions`                                             | `oncommentcreate`        | `onCommentCreate`        |
| `ReviewEditorProps`, `ThreadManagerOptions`                                             | `oncommentupdate`        | `onCommentUpdate`        |
| `ReviewEditorProps`, `ThreadManagerOptions`                                             | `oncommentdelete`        | `onCommentDelete`        |
| `DiffViewerProps`                                                                       | `onrevertall`            | `onRevertAll`            |
| `DiffViewerProps`                                                                       | `onreverthunk`           | `onRevertHunk`           |

`EditorConfig`, `EditorAttachmentOptions`, and `EditorKeymapOptions` (from `./editor`) renamed
only `oncommentshortcut`; their other callbacks (`onchange`, `onselectionchange`,
`onlinkshortcut`, and `EditorAttachmentOptions.onready`) keep their names.

### Removed and moved exports

- **`EditorHandle`** is no longer exported from `@lostgradient/editor/markdown-editor`. Import it
  from `@lostgradient/editor/editor` or `@lostgradient/editor/editor/component-runtime`, which
  still export it unchanged.
- **Placeholder re-exports**: `@lostgradient/editor/editor` no longer re-exports
  `PlaceholderCandidate`, `PlaceholderToken`, `PlaceholderValidationIssue`,
  `PlaceholderValidationResult`, `PlaceholderValueKind`, `PlaceholderResolutionResult`,
  `PlaceholderCompletionConfiguration`, `PlaceholderDecorationConfiguration`, `RESERVED_SEGMENTS`,
  `buildPlaceholderCandidatesFromJsonSchema`, `isBlockedSegment`, `parsePlaceholderTokens`,
  `resolveTemplatePlaceholders`, or `validatePlaceholderTokens`. Import the ones that still exist
  from `@lostgradient/markdown` (its 0.6.0 removed `PlaceholderValueKind`,
  `PlaceholderValidationIssue`, and `PlaceholderValidationResult`, and changed the others).
  `PlaceholderCompletionConfiguration` and `PlaceholderDecorationConfiguration` are also still
  exported from `@lostgradient/editor/editor/component-runtime`.
- **Anchor plugin**: `@lostgradient/editor/anchor-decorations` no longer exports `AnchorState`,
  `AnchorPluginState`, `AnchorPluginOptions`, `anchorPluginKey`, or `createAnchorPlugin`. Import
  them from the package root, `@lostgradient/editor`.
- **`destroyEditor`** returns `Promise<void>` instead of `void`; await it if code depends on
  teardown having finished.

### MarkdownEditor template placeholders

- **Low-level props are reactive**: `placeholderCompletion` and `placeholderDecoration` used to be
  read once at mount. Replacing either object now updates the live editor. They can no longer be
  combined with `placeholderDefinitions`.
- **Popup rows**: rows used to show the path above one `types — description` line, and only the
  first eight matches existed. Rows now have separate path, types (`|`-joined, or `unknown`) and
  description elements; every match is listed and scrolls with eight visible rows. Matches sort by
  code-unit path order instead of `localeCompare`.
- **Keyboard and pointer**: arrow keys used to wrap; they now stop at the first and last option.
  Tab used to accept; it now dismisses without inserting and is not consumed. Escape is consumed
  only while the list is visible. A `mousedown` on an option used to insert it; a click or tap now
  inserts it, and a scrolling or cancelled pointer gesture inserts nothing.
- **Undo after accepting**: an acceptance used to join the surrounding typing in one undo step; it
  is now its own undo step.
- **Replacement range**: accepting inside a closed token used to replace everything up to the next
  `}}`. When the text between the caret and that `}}` is not a path, only the opener and the path
  characters after the caret are replaced.
- **No matches**: completion used to close silently; it now stays hidden while the status region
  announces "No matching placeholders".
- **Token scanning**: completion and decoration now scan each run of identically formatted text,
  so tokens in inline code or code blocks are never decorated and a token cannot cross a
  formatting boundary. `data-placeholder-validation-reason` can now be `blocked_path`.
- **Editing element attributes**: the ProseMirror element always has `aria-multiline="true"`, and
  a caller's `aria-describedby` is merged with the placeholder instructions and diagnostics IDs.
- **Editor API**: `EditorConfig.placeholderCompletion` and `EditorConfig.placeholderDecoration`
  are replaced by `EditorConfig.placeholders` (`{ definitions?, completion?, decoration?,
valuesStatus? }`), with `placeholderListboxId`, `onPlaceholderStatusChange`, and
  `EditorState.setPlaceholderConfiguration()`. `EditorAttachmentOptions.getPlaceholderCompletion`
  and `getPlaceholderDecoration` are replaced by `getPlaceholderConfiguration`.
  `createTemplateCompletionPlugin(getConfiguration)` is now
  `createTemplateCompletionPlugin({ listboxId?, onStatusChange? })`, and
  `createTemplateInvalidDecorationPlugin(getCandidates, getInvalidClassName?)` is now
  `createTemplateInvalidDecorationPlugin(initialConfiguration)`; both read their configuration from
  `createTemplatePlaceholderConfigurationPlugin()`, which must be installed with them.
- **Styles**: the completion popup and invalid-token styles moved from the component's scoped
  styles into `prosemirror.css`, inside the `cinder.components` layer.

### MarkdownEditor modes and preview

- **`EditorMode` is wider**: `'wysiwyg' | 'source'` is now `'wysiwyg' | 'source' | 'preview'`.
  Exhaustive switches, and code that assumes a non-rich mode is source, must handle `'preview'`.
- **Mode toggle placement**: with `modeToggleVisible`, the toggle used to render only inside the
  default toolbar row. It now renders whenever `modeToggleVisible` is true, in its own row above
  the editing surface when the default toolbar does not render, and gained a Preview option.
- **`onModeChange` timing**: switching between rich and source now calls `onModeChange` after
  publishing the flushed rich-editor content through `onValueChange`, not before.
- **`ToolbarContext`** adds `mode`, `canEdit` and `onModeChange(nextMode)`. Outside the rich
  editor its formatting fields are inactive (`editorContext` is `null`, `canUndo` and `canRedo`
  are `false`, handlers do nothing).
- **Editing surface markup**: the rich editor and the source textarea now sit inside a
  `.markdown-editor-surface` wrapper (`display: contents`), hidden and `inert` during preview.
- **Editor API**: `EditorState` adds `flushPendingChange()`, `resetDocument(content)`, and
  `setPlaceholderConfiguration(configuration)`; objects implementing `EditorState` must provide
  all three.

### MarkdownEditor source-mode history

- **Undo and redo in source mode**: the raw Markdown textarea used to rely on the browser's native
  undo stack, which component-written values could reset or skip. Source mode now keeps its own
  history: Mod-Z undoes; Mod-Shift-Z, and Ctrl-Y on Windows, redo; the browser's Undo and Redo
  commands replay the same history. Each input event, IME composition, or placeholder acceptance
  is one step. An external `value` change or `setMarkdown()` clears the history, and each undo or
  redo calls `onValueChange` once.

## Why a separate package

`@lostgradient/cinder` used to carry milkdown, prosemirror, and this package's headless runtime as
`peerDependencies` for exactly these three components. Installing Cinder for a `<Button>` asked
your package manager to satisfy a full ProseMirror editor stack. See
[`docs/decisions/package-boundaries.md`](../../docs/decisions/package-boundaries.md) for the full
rationale — this package is Phase 3 of that plan.
