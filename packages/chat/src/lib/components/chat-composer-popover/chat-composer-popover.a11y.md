# ChatComposerPopover accessibility

ChatComposerPopover implements the WAI-ARIA combobox with listbox popup pattern for ChatInput composition.

The composer receives `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant` through ChatInput's composer overlay props. The popup itself is the existing CommandMenu listbox, and each row is a CommandItem with `role="option"` and `aria-selected` for the active descendant.

Keyboard behavior:

- ArrowUp and ArrowDown move the active suggestion.
- Enter selects the active suggestion and returns focus to the composer.
- Escape dismisses the popup and clears the composer listbox ARIA.

Command definitions stay in application code. Consumers should provide labels that identify the inserted command or mention, and descriptions only when the extra text helps distinguish similar options.
