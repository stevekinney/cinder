# ChatComposerPopover accessibility

ChatComposerPopover implements the WAI-ARIA combobox with listbox popup pattern for ChatInput composition.

The composer receives `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant` through ChatInput's composer overlay props. The popup itself is the existing CommandMenu listbox, and each row is a CommandItem with `role="option"` and `aria-selected` for the active descendant.

Keyboard behavior:

- ArrowUp and ArrowDown move the active suggestion.
- Enter selects the active suggestion and returns focus to the composer.
- Tab selects the active suggestion and keeps focus in the composer. Shift+Tab and modified Tab combinations retain native focus navigation.
- Escape dismisses the popup and clears the composer listbox ARIA.

Command definitions stay in application code. Consumers should provide labels that identify the inserted command or mention, and descriptions only when the extra text helps distinguish similar options. Typed asynchronous sources render as named visual groups, and their group name prefixes each option's accessible label so the grouping is preserved for screen readers without adding non-option rows to the listbox.

Design review: the widened surface remains a caret-anchored CommandMenu rather than introducing a second popover pattern. It preserves the existing row density and floating-surface treatment while allowing file names, people, and descriptions to remain distinguishable at typical composer widths.
