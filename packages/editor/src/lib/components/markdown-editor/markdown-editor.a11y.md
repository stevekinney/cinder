# MarkdownEditor · accessibility

## Pattern

MarkdownEditor packages a higher-level workflow. Confirm the composed controls, labels, states, and keyboard path match the domain task instead of treating the visual shell as the accessibility contract.

Purpose: Rich Markdown editing surface bundling a Milkdown-powered ProseMirror editor, toolbar, and mark or block introspection helpers.

## Use when

- Composing or editing Markdown documents and wanting the bundled toolbar, link-aware selection, and source or WYSIWYG mode toggle.
- Building writing surfaces that need an editor handle for programmatic mark or block manipulation as part of the heavyweight suite.

## Avoid when

- Authoring a simple plain-text note — a textarea is dramatically lighter than the Milkdown bundle.
- The surface needs inline review threads on top of the editor — use review-editor for that composition.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

The **More formatting** button appears only when the toolbar is too narrow to show every command group inline; at widths where everything fits, there is no overflow trigger and no hidden commands. When it is present, it opens a priority-plus Popover containing whichever groups did not fit. Opening it moves focus to the first enabled formatting action. `Tab` and `Shift+Tab` follow the panel's native button order; each button's existing shortcut remains available while the editor is focused. `Escape` closes the panel and restores focus to More formatting. Activating Insert Link first closes the formatting panel, then opens the link dialog from the same visual anchor so only one floating focus scope is active. The panel is named **More formatting**, its command groups retain their accessible labels, and toggle buttons expose their pressed state without an additional live announcement.

Which commands sit inline versus in the overflow panel is width-driven, but it is deliberately **frozen while focus is inside a group or on the More formatting trigger**. A resize that would otherwise move the focused group across that boundary — or empty the overflow set entirely, unmounting the trigger — is held until focus moves on. Without this, a window resize or a container reflow silently relocates the control under the user's cursor, or drops keyboard focus to `<body>`. Two consequences worth knowing when reviewing: the trigger can remain present at a width where everything would otherwise fit, and a command can remain in the panel for the same reason. Both resolve as soon as focus leaves.

Keep focus indicators visible. If you wrap or restyle MarkdownEditor, verify the focused element remains visually apparent in default and forced-colors modes.

**Resizing while a formatting group is focused never relocates it.** The priority-plus split re-evaluates continuously as the toolbar is resized, and a resize can, in principle, land exactly when focus is inside one of the four movable groups (Text formatting, Links, Lists, Block operations). Relocating a group across a resize means unmounting its buttons at one render site (the inline row or the popover panel) and mounting new ones at the other — Svelte does not move DOM across `{#if}` branches, it destroys and recreates — so an unguarded move drops focus to `<body>`, a keyboard trap-adjacent failure.

The chosen behavior: whichever side a group is on at the moment it receives focus — inline or inside the popover — is frozen there until focus leaves that group, regardless of what the fit calculation recomputes to while focus remains. This is symmetric: a focused inline group is kept inline even if a narrowing resize says it should overflow, and a focused _popover_ group is kept in the popover even if a widening resize says it would now fit inline (moving it back inline while focused would unmount-and-remount it out from under the user exactly the same way). Focus moving within the same group (e.g. Bold → Italic) does not release the freeze; focus moving to a different group, to a non-movable control (History, Block type, the popover trigger), or out of the toolbar entirely does. The alternative considered — always moving focus to the "More formatting" trigger the instant a focused group would relocate — was rejected because it does the same "yank focus while the user is mid-interaction" thing, just to a different, less predictable place; freezing the group in place is the less surprising outcome and keeps focus exactly where the user left it. The tradeoff: the frozen group's own width is not released from the fit budget it would otherwise reclaim (or is not squeezed out of a budget it would otherwise exceed) until focus moves on, so the toolbar can briefly be a little more (or less) full than the ideal split — the same `overflow-x: auto` fallback that covers pre-measurement windows absorbs that overage. The "More formatting" popover itself will not auto-close while it holds a frozen, currently-focused group, even if every other group would otherwise let it close.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When MarkdownEditor accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render MarkdownEditor in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Accessibility review outcome: the priority-plus overflow is accepted because its trigger is named, opening enters the portaled command surface, Escape restores the trigger, commands retain native keyboard order and state, and the nested link flow closes the first Popover before opening the dialog.

Related components: `review-editor`, `code-block`.
