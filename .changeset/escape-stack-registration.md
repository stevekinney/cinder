---
'@lostgradient/cinder': patch
---

Command Menu, Selection Popover, DropdownMenu (and its Context Menu, Menu Bar, and
modern Dropdown consumers), Speed Dial, the NavigationBar mobile panel, and
MultiSelect now register on the shared escape stack (`pushEscapeHandler` in
`src/_internal/overlay.ts`) instead of handling Escape only from their own
element-scoped `onkeydown` listener.

The shared LIFO stack now correctly arbitrates Escape between these overlays and
any other stacked overlay (Modal, Drawer, Popover, Combobox, and so on): the
top-most open overlay consumes the key and swallows it with `preventDefault()` +
`stopPropagation()`; a lower overlay never reacts to the same keystroke. Each of
these components also now dismisses on Escape with focus anywhere on the page, not
just while focus sits inside its own DOM tree — the previous anchor/target-scoped
listeners missed that case.

Command Menu's ghost-text-first two-stage Escape semantics are unchanged, now
routed through a single shared internal function called by both the anchor
listener and the stack registration. Dropdown's legacy `usesLegacySnippetApi`
branch splits by sub-branch: the non-popover fallback registers directly and
dismisses, while the native `supportsPopover` branch registers without calling
`preventDefault()` so the browser's own `popover="auto"` light-dismiss keeps
working — it only occupies the stack slot so a lower overlay doesn't react first.
DropdownMenu's registration is keyed per open instance, so Menu Bar's staged
submenu-then-menubar close falls out of LIFO ordering with no target-scoping
needed; Menu Bar's own Escape branch gained a `defaultPrevented` guard as
defense-in-depth. MultiSelect already registered via
`commandList.bindDismissal`; its stack handler now also calls
`stopPropagation()`, and its bubbling `onEscape` fallback gained the same
`defaultPrevented` guard used elsewhere.
