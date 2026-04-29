# Combobox · accessibility

## Pattern

[WAI-ARIA Authoring Practices: Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — single-select, "list autocomplete with manual selection" variant. The input drives both filtering and the open/close state of the listbox.

## Roles, names, states

- The text input carries `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` (pointing at the listbox), and `aria-activedescendant` (pointing at the visually-active option, if any).
- The listbox carries `role="listbox"`. Each option is a `<li>` with `role="option"`, `aria-selected` reflecting whether it matches the current value, and `aria-disabled` when the option is non-selectable.
- The visible label rendered by the `label` prop sits in a `<label for={id}>`. Consumers without a visible label should pass `aria-label` via consumer composition (defer until consumer demand).

## Keyboard

| Key       | Behavior                                                            |
| --------- | ------------------------------------------------------------------- |
| ArrowDown | Open the listbox (if closed); move active option to next; wraps     |
| ArrowUp   | Open the listbox (if closed); move active option to previous; wraps |
| Home      | Move active option to first (when listbox is open)                  |
| End       | Move active option to last (when listbox is open)                   |
| Enter     | Select the active option (when listbox is open)                     |
| Escape    | Close the listbox without selecting                                 |
| Type      | Filter the option list and reset active to first match              |

The active option is **visually highlighted but not focused** — focus stays on the input throughout. Mouse hover updates the active index for keyboard parity.

## Mouse / pointer

Options select on `mousedown` rather than `click` so the selection completes before the input's `blur` handler closes the listbox. Mouse hover updates the active index but does not select.

## Hard scope caps (v1)

These are deliberate non-goals for the first version. Consumers who need them should compose their own combobox or open an issue tracking demand.

- **Single-select only.** No multi-select, no token chips.
- **Synchronous local filtering only.** Pass `filter` for custom logic, but don't expect debounced fetches or async loading.
- **No virtualization.** Visible option count is capped at `maxVisibleOptions` (default 200). Larger lists should be paginated or pre-filtered.
- **No "create new" / free-text submission.** Typed text that doesn't match an option does not become a value.
