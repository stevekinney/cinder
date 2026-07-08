# ApprovalCard Accessibility

## Pattern

Repeatable approval unit rendered as an `<article>` with native button
controls. The component is presentational: it never executes the operation and
only calls `onresolve` when the user activates an explicit action. Nested
content uses plain headings instead of labelled sections, so a queue of many
approval cards adds no landmarks to the page.

## Roles names states

| Element                   | Role                  | Accessible name                                                | State                                                                     |
| ------------------------- | --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Root `<article>`          | `article`             | Heading text, for example `Approval required for deploy-cloud` | `data-cinder-state`, `data-cinder-risk`                                   |
| Header status             | text + `StatusDot`    | State label such as `Pending` or `Expired`                     | —                                                                         |
| Risk icon                 | `img`, `tabindex="0"` | Risk label, e.g. `Medium risk` (via `aria-label`)              | Bar count scales with risk; `Tooltip` shows the same label on hover/focus |
| Action group              | `group`               | `Approval actions`                                             | Rendered only while actionable and `onresolve` is wired                   |
| Action buttons            | button                | Visible button text                                            | `Approve with edits` is a disclosure with `aria-expanded`                 |
| Edited arguments textarea | textbox               | `Edited arguments JSON`                                        | `aria-invalid` and `role="alert"` error text when JSON is invalid         |
| Details                   | button + panel        | `Details`                                                      | Collapsed by default; holds sandbox, environment, and request metadata    |

## Keyboard

All approval actions are native buttons and follow browser keyboard behavior.
Activating `Approve with edits` reveals the JSON editor and moves focus into
the textarea; the button reflects the panel with `aria-expanded`. The
component does not add roving focus, global shortcuts, or key handlers.

## Heading structure

The card title renders at `headingLevel` (default `3`) and section headings
one level deeper, so hosts can slot the card into an existing document
outline without skipped levels.

## State communication

Risk and approval state are communicated with more than color. The status dot
is accompanied by its visible text label. The risk indicator is a stacked-bar
signal icon whose bar count differs by level (low/medium/high), so shape
carries the distinction independent of color; its `aria-label` and `Tooltip`
both surface the same `Low risk` / `Medium risk` / `High risk` text for
anyone who needs it named explicitly.

When `expiresAt` passes, the effective state becomes `expired` and the action
buttons are removed. Expiration never fires `onresolve`; the host remains the
source of truth for persisted state.

## Security boundary

`env` accepts environment variable names only. If a caller accidentally
passes a `NAME=value` string, the component renders only the name before `=`
and never renders the value. Names render as plain text chips — no masked
placeholders that would imply secret material is present in the DOM. The
list carries an `aria-label` stating that values are never shown, for anyone
using a screen reader.
