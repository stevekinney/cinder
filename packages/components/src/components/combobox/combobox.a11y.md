# Combobox · accessibility

## Pattern

[WAI-ARIA Authoring Practices: Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — single-select, "list autocomplete with manual selection" variant. The input drives both filtering and the open/close state of the listbox.

## Roles, names, states

- The text input carries `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` (pointing at the listbox), and `aria-activedescendant` (pointing at the visually-active option, if any).
- The listbox carries `role="listbox"`. Each option is a `<li>` with `role="option"`, `aria-selected` reflecting whether it matches the current value, and `aria-disabled` when the option is non-selectable.
- The visible label rendered by the `label` prop sits in a `<label for={id}>`. Consumers without a visible label should pass `aria-label` via consumer composition (defer until consumer demand).
- `description` and `error` are wired via the shared `field-control.ts` contract: the input carries `aria-describedby` pointing at the rendered helper paragraph(s), and `aria-invalid="true"` when `error` is set.

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

## Rich option content

Options can carry optional `description` and `avatar` fields to render richer rows.

**Accessible name composition.** When an option has a `description`, the `<li role="option">` carries an explicit `aria-label` composed as `"${label}, ${description}"`. This guarantees screen readers announce both lines regardless of how the assistive technology handles `aria-activedescendant` text composition from multi-element children. Options without a description omit `aria-label` so the accessible name derives from the visible label text — no behavior change for plain options.

**Avatar is decorative.** The avatar `<img>` carries `alt=""` explicitly. The image conveys no information beyond what the label already provides, so empty alt is correct per WAI's decorative-image guidance. Consumers needing a meaningful avatar description should pre-format that text into the `label` or `description` field.

**Broken avatar URLs.** The component does not intercept broken image URLs. A bad `src` renders the browser's default broken-image indicator. Consumers are responsible for supplying valid URLs. Whitespace-only avatar strings are treated the same as a missing avatar — no `<img>` element is rendered.

**Default filter matches description.** Typing a substring that appears in an option's `description` (case-insensitive) keeps that option visible, matching the visual affordance. Consumers who want label-only matching pass a custom `filter` prop.

**Selection from a rich option.** Selecting a rich option sets `value` to `option.value` and `inputValue` to `option.label` — the description is not appended to the text input.

## Hard scope caps (v1)

These are deliberate non-goals for the first version. Consumers who need them should compose their own combobox or open an issue tracking demand.

- **Single-select only.** No multi-select, no token chips.
- **Synchronous local filtering only.** Pass `filter` for custom logic, but don't expect debounced fetches or async loading.
- **No virtualization.** Visible option count is capped at `maxVisibleOptions` (default 200). Larger lists should be paginated or pre-filtered.
- **No "create new" / free-text submission.** Typed text that doesn't match an option does not become a value.
- **No custom option renderer.** Rich rows support `description` and `avatar` out of the box. Consumers needing a different layout should open a feature request; a snippet-based renderer is a candidate for a future iteration.
