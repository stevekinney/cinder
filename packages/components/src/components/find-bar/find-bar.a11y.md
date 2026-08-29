# FindBar design and accessibility review

## Design review (required)

- Reviewer: Implementation review
- Review outcome: Approved. Compact docked control with no overlay or focus trap.
- Nearest neighbours: SearchField, Pagination, FormField.
- Why this component exists: It combines controlled querying, debounced host notification, match navigation, and result announcements.
- Findings and resolutions: Composes FormField, Input, and Button; keeps the backend interchangeable.

## Novel interaction accessibility review

- Applies: Yes—the debounce, held-Enter navigation, and refocus selection rules are component-specific.
- Reviewer: Implementation review
- Review outcome: Approved. Query changes are asynchronous only at the callback boundary; navigation is immediate.

### Focus management

Focus entering the bar refocuses and selects the query only when the last keystroke is older than 400ms. Actions remain ordinary buttons. The host owns dismissal and restoration.

### Keyboard matrix

| Key or gesture  | Context    | Expected behavior                                                  |
| --------------- | ---------- | ------------------------------------------------------------------ |
| Enter           | Find input | Invoke next immediately; repeated keydowns continue advancing.     |
| Shift+Enter     | Find input | Invoke previous immediately; repeated keydowns continue reversing. |
| Tab / Shift+Tab | Bar        | Native focus order through input and actions.                      |
| Space / Enter   | Action     | Native button activation.                                          |

### Assistive-technology announcements

The input is labelled “Find” and described with the minimum query length. A persistent polite `role="status"` announces “No matches” or “N of total”. Actions expose “Previous match”, “Next match”, and “Close find bar”.
