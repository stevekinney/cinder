# MultiSelect · accessibility

## Pattern

MultiSelect uses an anchored picker surface with a listbox (`aria-multiselectable="true"`) and option rows that expose `aria-selected`.

## Roles, names, states

- Trigger is a native button with `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls`.
- Options are rendered as `role="option"` and expose `aria-selected` and `aria-disabled`.
- The listbox exposes `aria-multiselectable="true"` so assistive tech announces multi-selection behavior.
- `description`, `warning`, and `error` are composed into `aria-describedby`.
- `error` sets `aria-invalid="true"` on the component root.

## Keyboard

| Key                  | Behavior                                        |
| -------------------- | ----------------------------------------------- |
| Enter / Space        | Open the menu from the trigger.                 |
| ArrowDown / ArrowUp  | Open and move active option.                    |
| Home / End           | Jump to first/last enabled option.              |
| Enter / Space (list) | Toggle the active option (non-filterable mode). |
| Space (filter input) | Insert a literal space in the query.            |
| Escape               | Close the menu and return focus to the trigger. |

## Notes

- Disabled options remain visible but are not toggleable.
- Readonly mode keeps content perceivable but blocks selection changes.
- Required mode uses a hidden validity proxy so native form validation can enforce at least one selected value.
