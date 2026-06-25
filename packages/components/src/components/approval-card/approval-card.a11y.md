# ApprovalCard Accessibility

## Pattern

Named approval region with native button actions. The component is presentational:
it never executes the operation and only calls callback props when the user
activates an explicit action.

## Roles names states

| Element                   | Role               | Accessible name                                                | State                                                             |
| ------------------------- | ------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Root `<section>`          | `region`           | Heading text, for example `Approval required for deploy-cloud` | `data-cinder-state`, `data-cinder-risk`                           |
| Header status             | text + `StatusDot` | State label such as `Pending` or `Expired`                     | Risk and state are also rendered as text badges                   |
| Action group              | `group`            | `Approval actions`                                             | Only rendered while the effective state is `pending`              |
| Action buttons            | button             | Visible button text                                            | Disabled only when the matching callback is absent                |
| Edited arguments textarea | textbox            | `Edited arguments JSON`                                        | `aria-invalid` and `role="alert"` error text when JSON is invalid |

## Keyboard

All approval actions are native buttons and follow browser keyboard behavior.
The JSON edit field is a native textarea. The component does not add roving
focus, global shortcuts, or key handlers; hosts may render shortcut hints around
the callback actions if they own those bindings.

## State communication

Risk and approval state are communicated with visible text, not color alone. The
status dot is accompanied by its label, and the risk badge renders `Low risk`,
`Medium risk`, or `High risk`.

When `expiresAt` passes, the effective state becomes `expired` and the action
buttons are removed. Expiration does not call `onDeny`, `onCancel`, or any other
callback; the host remains the source of truth for persisted state.

## Security boundary

`env` accepts environment variable names only. If a caller accidentally passes a
`NAME=value` string, the component displays only the name before `=` and never
renders the value. The masked rows use `SecretValueField` with the environment
name as the non-secret value, so the copy action copies the name and no secret
material is present in visible text, attributes, or copyable content.
