# TransferList Accessibility

TransferList renders one compact `role="listbox"` with
`aria-multiselectable="true"`. Immediate toggling replaces the former dual-list
transfer workflow: each option exposes `aria-selected`, the visible header reports
the selected count, and a dedicated assertive announcer reports additions and
removals without making the count itself live. Disabled unselected items expose
`aria-disabled="true"` and are skipped by keyboard movement. If a disabled item is
already selected, it remains operable for removal; after removal, active-descendant
focus moves to the next selectable option so the announced and activated option
cannot diverge.

Keyboard behavior:

- Tab enters and leaves the single listbox.
- Arrow Up and Arrow Down move the active option within the listbox and wrap at its ends.
- Home and End jump to the first or last enabled option.
- Space toggles the active option.
- Enter also toggles the active option.

Pointer activation immediately toggles an operable option and returns focus to
the listbox. The active option is exposed through `aria-activedescendant`; DOM
focus remains on the listbox itself.

## Review outcome

This single-list interaction was reviewed against CheckboxGroup and the former
dual-list TransferList. CheckboxGroup remains the simpler neighbour for unrelated
independent choices; TransferList remains justified for assignment workflows that
need selected-count language and explicit add/remove announcements. The reviewed
keyboard matrix, disabled-selection removal, active-descendant ownership, and
assertive announcement behavior are recorded above and covered by component tests.
