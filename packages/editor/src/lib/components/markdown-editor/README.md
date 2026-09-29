# MarkdownEditor

Rich Markdown editing surface bundling a Milkdown-powered ProseMirror editor, toolbar, and mark or block introspection helpers.

## Usage

```svelte
<script lang="ts">
  import { MarkdownEditor } from '@lostgradient/editor';
</script>
```

## Workspace dependencies

Declare `"@lostgradient/editor": "workspace:*"` in the consuming workspace and run `bun install --frozen-lockfile` from the Corvidae root. The Editor workspace owns its Milkdown, ProseMirror, Markdown pipeline, and Cinder dependencies. Consumers import `MarkdownEditor` through `@lostgradient/editor`; they do not install the internal packages from a registry or duplicate the editor's dependency list.

## Guidance

### Use When

- Composing or editing Markdown documents and wanting the bundled toolbar, link-aware selection, and source or WYSIWYG mode toggle.
- Building writing surfaces that need an editor handle for programmatic mark or block manipulation as part of the heavyweight suite.

### Avoid When

- Authoring a simple plain-text note — a textarea is dramatically lighter than the Milkdown bundle.
- The surface needs inline review threads on top of the editor — use review-editor for that composition.

## Props

<!-- generated:props:start -->

| Prop                             | Type                                     | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                          | `string`                                 | no       | —       | Additional CSS classes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `id`                             | `string`                                 | yes      | —       | Unique identifier for accessibility (required)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `label`                          | `string`                                 | no       | —       | Accessible label for the editor (required for screen readers)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `mode`                           | `"wysiwyg"` \| `"source"` \| `"preview"` | no       | —       | Editor display mode (two-way bindable). An invalid value keeps the last valid mode (`'wysiwyg'` on mount) and reports `invalid_option` at `mode`.                                                                                                                                                                                                                                                                                                                                                                                            |
| `modeLabel`                      | `string`                                 | no       | —       | Accessible label for the mode toggle (visually hidden)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `modeToggleVisible`              | `boolean`                                | no       | —       | Show the built-in mode control for switching between the rich editor, raw Markdown and preview. It renders whenever this is true, including with a custom `toolbar`, `toolbarEnabled={false}` or `readonly`.                                                                                                                                                                                                                                                                                                                                 |
| `placeholder`                    | `string`                                 | no       | —       | Hint text shown while the editor is empty. Unrelated to `{{path}}` template placeholders, which `placeholderDefinitions` configures.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `readonly`                       | `boolean`                                | no       | —       | Read-only mode                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `snapshotMode`                   | `boolean`                                | no       | —       | Snapshot mode for visual regression testing. When `true`: - Applies `caret-color: transparent` and `user-select: none` to the editor root via a `data-snapshot-mode` attribute, producing a stable visual state (no blinking cursor, no selection highlights). - Blurs any focused element inside the component on mount so the initial screenshot does not capture a focused ring or active caret. This is a purely visual / CSS concern. It does NOT affect editability, ProseMirror state, or any prop controlled by `readonly` / `mode`. |
| `toolbarEnabled`                 | `boolean`                                | no       | —       | Show formatting toolbar (DEP-37)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `value`                          | `string`                                 | no       | —       | Current markdown content (two-way bindable)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `onCommentShortcut`              | `(opaque)`                               | no       | —       | Called when comment shortcut (Ctrl-Alt-c) is pressed (DEP-47) Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `onModeChange`                   | `(opaque)`                               | no       | —       | Called when editor mode changes Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `onPlaceholderDiagnosticsChange` | `(opaque)`                               | no       | —       | Called with the ordered placeholder diagnostics whenever that list changes. Token ranges index the Markdown `value`. Called with `[]` only to clear earlier diagnostics. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                          |
| `onReady`                        | `(opaque)`                               | no       | —       | Called when the editor is ready (Milkdown initialized) Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `onSelectionChange`              | `(opaque)`                               | no       | —       | Called when selection changes (stub for DEP-39) Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `onToolbarContextChange`         | `(opaque)`                               | no       | —       | Notified whenever the toolbar context changes. Use this to host the formatting controls somewhere this component does not render — for example folding them into a surrounding application toolbar so the editor does not stack a second bar of its own. Pair it with `toolbarEnabled={false}`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                   |
| `onValueChange`                  | `(opaque)`                               | no       | —       | Called when content changes Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `placeholderCompletion`          | `(opaque)`                               | no       | —       | Placeholder completion configuration (DEP-583). When provided, enables inline suggestion menu for {{…}} tokens in WYSIWYG mode. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                   |
| `placeholderDecoration`          | `(opaque)`                               | no       | —       | Placeholder decoration configuration (DEP-583). When provided, decorates invalid {{…}} tokens with CSS class and data attributes. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                 |
| `placeholderDefinitions`         | `(opaque)`                               | no       | —       | Allowed placeholders, as a JSON Schema or explicit candidates. Drives completion, invalid-token decoration and diagnostics from one catalog. Replacing the object updates the live editor without recreating it. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                  |
| `placeholderValueMode`           | `(opaque)`                               | no       | —       | How preview inserts string placeholder values: `'text'` (the default) renders them as literal text, `'markdown'` lets them contribute Markdown formatting. Other values render as literal JSON either way. An invalid string reports `invalid_option` at `placeholderValueMode` and disables fill. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                |
| `placeholderValues`              | `(opaque)`                               | no       | —       | Placeholder values for filled preview. Never used for completion, and never included in a diagnostic. Supplying values without `placeholderDefinitions`, or values that are not a plain JSON object, reports a configuration diagnostic. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                          |
| `plugins`                        | `(opaque)`                               | no       | —       | Additional Milkdown plugins to load. Used for comment anchoring (DEP-39), decorations, and other extensions. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                      |
| `toolbar`                        | `(opaque)`                               | no       | —       | Custom toolbar content. When provided, replaces default toolbar. Receives ToolbarContext for building custom toolbar UI. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                          |
| `toolbarActions`                 | `(opaque)`                               | no       | —       | Additional toolbar actions (appended to default toolbar). Use this for adding buttons without replacing the entire toolbar. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                       |
| `toolbarLeading`                 | `(opaque)`                               | no       | —       | Leading toolbar content (prepended before default toolbar items). Useful for adding undo/redo or other leading actions. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                           |

<!-- generated:props:end -->

## Modes

`mode` (bindable) is `'wysiwyg'` (the rich editor), `'source'` (raw Markdown in a code textarea) or `'preview'` (rendered, read-only output). An invalid `mode` keeps the last valid mode, `'wysiwyg'` on mount, reports `invalid_option` at `mode` through `onPlaceholderDiagnosticsChange`, and is never written back. `onModeChange` fires once for each real change, after any content the switch publishes.

`modeToggleVisible` renders the one built-in mode control, a segmented control with Rich editor, Raw Markdown and Preview options. It sits in the default toolbar row when that renders, and in its own row otherwise, so a custom `toolbar` snippet, `toolbarEnabled={false}` and `readonly` never hide it. Without it, set `mode` yourself or call `ToolbarContext.onModeChange`.

`ToolbarContext` carries `mode`, `canEdit` (the rich editor is showing and ready, and the editor is not readonly) and `onModeChange(nextMode)`, which ignores invalid modes. In source and preview mode the formatting fields are inactive: `editorContext` is `null`, `canUndo` and `canRedo` are `false`, no marks are active, the block is a paragraph, the link popover is closed and the formatting handlers do nothing. `readonly` always reports your flag. A custom `toolbar` still mounts only while `toolbarEnabled` is true and the editor is not readonly; `onToolbarContextChange` receives every context either way.

### Preview

Preview renders a copy of the template through the same sanitized Markdown pipeline and `.cinder-markdown-content` styles. It never changes the template: `value`, `bind:value`, `onValueChange`, `getMarkdown()` and `setMarkdown()` keep the `{{path}}` tokens, and rendering never fires `onValueChange`. The labeled region has the ID `${id}-preview` and is always read-only.

- With no `placeholderDefinitions`, preview is ordinary Markdown, labeled "Preview".
- With definitions and no `placeholderValues` (omitted or `undefined`), it is the unfilled template, labeled "Unfilled template preview", with the authoring diagnostics.
- With definitions and a plain values object, including `{}`, it fills through the shared resolver with `unresolved: 'preserve'`, labeled "Preview". Unresolved tokens stay visible, and `missing_value`, `invalid_value` and `type_mismatch` join the diagnostics while preview shows. Diagnostics never contain values.
- Values that are `null`, an array or not a plain object report `invalid_values` and preview the unfilled template. Values without definitions report `invalid_definitions` at `placeholderDefinitions` and are not interpolated; preview shows the template labeled "Unfilled template preview" until the values are removed too. An invalid `placeholderValueMode` reports `invalid_option` and disables fill.

`placeholderValueMode="text"` (the default) renders string values as literal text; `'markdown'` lets them add Markdown structure, which the sanitizer still filters. Preview updates when the values, definitions, template or value mode change. Values are never copied, persisted or logged.

Entering preview publishes a pending rich-editor edit once, then renders it. If the parent replaces `value` (or calls `setMarkdown()`) in the same update that selects preview, that replacement wins and the pending edit is dropped without an `onValueChange`. The editing surface you left (rich editor or textarea) stays mounted, hidden and inert, behind preview, so returning to it restores its selection and undo history. A `value` or `setMarkdown()` replacement during preview instead becomes that surface's new baseline: its history is cleared and the caret moves to the end. Definition and value changes do not clear it. Switching between the rich editor and source keeps its existing behavior.

The renderer loads after the component mounts on the client: server rendering and the first hydration pass show the same inert "Loading preview" region. A mount that starts in preview never initializes the rich editor (Milkdown's editor is not created); selecting it later does. The component still imports its editor modules, including Milkdown, statically, so a preview-only mount does not avoid loading that code; making that import lazy is tracked separately in COR-1322. Choosing a mode with the built-in control or `ToolbarContext.onModeChange` moves focus to the preview region or back to the editing surface; changing the `mode` prop never moves focus.

## Template placeholders

`placeholderDefinitions` is the recommended way to enable `{{path}}` placeholders. Pass either `{ schema }` (a JSON Schema object) or `{ candidates }`. The editor normalizes each definitions object once and uses that one catalog for completion, invalid-token decoration and diagnostics. Replace the object to change the allowed paths: the live editor updates through a metadata-only transaction, so the document, undo history, selection and `onValueChange` are untouched and the editor is never recreated.

`placeholderCompletion` and `placeholderDecoration` remain available as the low-level alternative, including async lookup, `minimumQueryLength` and `lookupDebounceMs`, and are now reactive too. They cannot be combined with `placeholderDefinitions`: the prop types reject the mix, and at runtime the editor reports `conflicting_configuration` at `placeholderDefinitions`, turns placeholder completion and decoration off, keeps editing, and resumes as soon as the conflict is removed. With no placeholder props at all, nothing is scanned, decorated or reported.

### Template placeholders and the `placeholder` prop

The `placeholder` prop is unrelated: it is the hint text an empty editor shows, and it is never scanned, completed or filled. Template placeholders are the `{{path}}` tokens inside `value`, governed only by `placeholderDefinitions` (or the low-level `placeholderCompletion` and `placeholderDecoration`), with `placeholderValues` and `placeholderValueMode` read only by preview.

### Example

`placeholderDefinitions`, `placeholderValues` and `placeholderValueMode` are ordinary props; replacing any of them updates the mounted editor. `@lostgradient/editor` exports `MarkdownEditor`, `EditorMode` and `MarkdownEditorProps`; the placeholder data types (`PlaceholderDefinitions`, `PlaceholderDiagnostic`, `JsonObject` and the rest) come from the root of `@lostgradient/markdown`, so declare `"@lostgradient/markdown": "workspace:*"` as well to import them by name, or type through `MarkdownEditorProps` as below. The headless utilities, diagnostic codes and security boundary are documented in `packages/markdown/README.md`. The `markdown-editor.examples.json` entry `template-placeholders` is this example in full, and the `markdown-editor-template-placeholders` browser-fixture route (`bun run dev:browser-fixtures`) is its interactive version.

```svelte
<script lang="ts">
  import type { PlaceholderDiagnostic } from '@lostgradient/markdown';
  import { MarkdownEditor, type MarkdownEditorProps } from '@lostgradient/editor';

  const definitions: MarkdownEditorProps['placeholderDefinitions'] = {
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name' },
        count: { type: 'integer' },
        user: { type: 'object', properties: { name: { type: 'string' } } },
      },
    },
  };
  const values: MarkdownEditorProps['placeholderValues'] = {
    name: 'Alice',
    count: 42,
    user: { name: 'Ada' },
  };

  let value = $state('Hello {{name}}, you have {{count}} messages from {{user.name}}.');
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

### Completion

Typing `{{` in eligible text opens completion at zero query characters, in the rich editor and in raw Markdown (source) mode alike (the low-level path keeps its own `minimumQueryLength`). Filtering is a case-insensitive path prefix; insertion is always the canonical, case-sensitive path. Every match is listed in code-unit path order, eight rows are visible at a time, and the rest scroll. Each row shows the path, the declared types joined with `|` (or `unknown`) and the description, never a value.

A token must sit in one contiguous run of text with the same formatting. Code blocks, inline code and non-collapsed selections never open completion, a token never spans a formatting boundary, and link labels are eligible while link targets are not. Readonly editors show no completion.

In source mode the textarea's Markdown is scanned with `parseMarkdownPlaceholderTokens`, so front matter, code, math, raw HTML, link and image destinations, and escaped braces never open completion. A backslash-escaped path such as `{{user\_name}}` (the form the rich editor serializes) filters and replaces like `{{user_name}}`. The listbox renders in the top layer with Cinder's floating-surface styling, anchored at the caret: it follows wrapping, textarea scrolling and viewport changes, hides while the caret is scrolled out of the textarea's visible area, stays inside the viewport with an 8 px margin, and opening it never scrolls the textarea. Switching modes closes it.

- ArrowDown and ArrowUp move the active option and stop at the ends.
- Enter inserts the active option, never during IME composition.
- Tab dismisses without inserting and is not consumed, so the editor's own Tab handling runs next: in source mode that moves focus, and in the rich editor the editor's Tab binding is meant to indent a list item or move to the next table cell, and otherwise focus moves. Whatever Tab changes does not reopen the list; the dismissal lasts until your next edit. Known defect: in Chromium, plain Tab in a rich-editor list item currently moves focus instead of indenting it (Mod-] indents), with or without placeholders; tracked in COR-1324.
- Escape dismisses and is consumed only while the list is open; a second Escape reaches enclosing handlers. A dismissal lasts until the next edit.
- Clicking or tapping an option inserts it without moving focus out of the editor. A pointer or touch gesture that scrolls the list or is cancelled inserts nothing, and a click from assistive technology with no pointer gesture inserts the option. A pointerdown outside dismisses.

Accepting replaces the whole in-progress token with one `{{path}}` and places the caret after it. The token includes path characters after the caret and, when only path characters (plus spaces or tabs) sit between the caret and it, the closing `}}`; otherwise prose up to a later `}}` is left alone. The acceptance is its own undo step: one undo restores the previous token, even if you kept typing right after it. In source mode an acceptance updates `value` and calls `onValueChange` exactly once.

### Source-mode history

Source mode keeps its own undo history instead of the browser's native textarea stack, from the moment the textarea mounts and whether or not placeholders are configured. Mod-Z undoes; Mod-Shift-Z, and Ctrl-Y on Windows, redo; the browser's own Undo and Redo commands replay the same history. Each input event is one step, one complete IME composition is one step, and one placeholder acceptance is one step. A new edit clears redo. An external `value` change or `setMarkdown()` starts a new history; placeholder configuration changes do not. Each source mount starts fresh, readonly editors leave the shortcuts alone, and the history is never persisted or logged.

### Accessibility

The ProseMirror element keeps `role="textbox"` with `aria-multiline="true"`; the source textarea keeps its implicit textbox role, also with `aria-multiline="true"`. While completion is configured and the editor is not readonly, the editing element in either mode also has `aria-autocomplete="list"` and `aria-haspopup="listbox"`; `aria-controls` names the listbox only while it is visible, and `aria-activedescendant` names the active option. It never gets `aria-expanded`.

| Element                                         | ID                                              |
| ----------------------------------------------- | ----------------------------------------------- |
| Listbox (named "Placeholders"), rich editor     | `${id}-placeholder-listbox-wysiwyg`             |
| Listbox (named "Placeholders"), source mode     | `${id}-placeholder-listbox-source`              |
| Option                                          | the listbox ID, a hyphen and the canonical path |
| Status region (`role="status"`, polite, atomic) | `${id}-placeholder-status`                      |
| Diagnostics summary                             | `${id}-placeholder-diagnostics`                 |
| Instructions (visually hidden)                  | `${id}-placeholder-instructions`                |

The status region is always rendered and announces "N placeholders available", "1 placeholder available", "No matching placeholders", or the active option as "path, types, i of N". The instructions read "Type two opening braces to insert a placeholder. Use arrow keys and Enter to choose; Escape or Tab dismisses." The editor adds the instructions and diagnostics IDs to `aria-describedby` after any IDs you pass.

### Diagnostics

`onPlaceholderDiagnosticsChange` receives the ordered definition, configuration and token diagnostics, and fires only when that list changes (compared by code, path, location and message). It fires with `[]` only to clear diagnostics it reported before. Token ranges are UTF-16 offsets into the Markdown `value`, recomputed when `value` updates. Diagnostics never contain placeholder values. The same list renders as a visible summary below the editor in both modes; source mode adds no overlay or highlighting to the textarea, and the summary is the associated text diagnostic.

Configuration errors use a `configuration` location:

- `conflicting_configuration` at `placeholderDefinitions` when definitions are mixed with the low-level props.
- `invalid_definitions` at `placeholderDefinitions` when `placeholderValues` is supplied without definitions.
- `invalid_values` at `placeholderValues` when values are not a plain JSON object.
- `invalid_option` at `placeholderValueMode` or `mode` when either prop has an unknown value.

Invalid tokens in the WYSIWYG document get the `template-placeholder-invalid` class (or the low-level `invalidClassName`), a wavy underline as the non-color cue, and a `data-placeholder-validation-reason` attribute set to one of `malformed_token`, `invalid_path_format`, `blocked_path` or `unknown_placeholder`.

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
