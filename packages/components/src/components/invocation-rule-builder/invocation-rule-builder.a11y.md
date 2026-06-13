# InvocationRuleBuilder accessibility

## Pattern

No single ARIA Authoring Practices pattern covers a multi-row rule builder directly. The component composes the form pattern (labeled selects and inputs) with the toolbar button pattern (icon buttons for add, remove, and reorder) inside a labeled region. Each condition and action list is a semantic `role="list"` with `aria-labelledby` pointing to the visible "Conditions" or "Actions" section heading.

## Roles names states

The root element is a `<section>` with `aria-label` (defaults to "Invocation rules"; consumer-overridable via the `label` prop). This establishes a named landmark region.

Condition and action lists use `role="list"` with `aria-labelledby` referencing the visible "Conditions" or "Actions" heading rendered by the containing rule card. Each row is `role="listitem"`.

All interactive controls carry explicit `aria-label` attributes that identify the condition number, rule name, and action — for example:

- "Field for condition 2 of PR Review Rule"
- "Operator for condition 2 of PR Review Rule"
- "Value for condition 2 of PR Review Rule"
- "Remove condition 2 of PR Review Rule"
- "Action 1 target for PR Review Rule"
- "Remove action 1 of PR Review Rule"
- "Move PR Review Rule up"
- "Move PR Review Rule down"
- "Remove PR Review Rule"
- "Add condition to PR Review Rule"
- "Add action to PR Review Rule"

Reorder buttons use `disabled` (not `aria-disabled`) when movement in the requested direction is not possible (e.g. "Move up" on the first rule).

A `role="status"` / `aria-live="polite"` / `aria-atomic="true"` live region announces add, remove, and move events. It remains in the DOM at all times; visibility is toggled via CSS rather than `{#if}` so repeated identical announcements re-trigger correctly.

SVG icons inside buttons are `aria-hidden="true"` because the button's `aria-label` provides the accessible name.

## Keyboard

| Key            | Action                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Tab            | Move focus between the component's controls in document order.                                 |
| Shift+Tab      | Move focus backwards in document order.                                                        |
| Space or Enter | Activate the focused button (add rule, add condition, add action, remove, move up, move down). |
| Arrow keys     | Not intercepted; native select behavior applies inside field, operator, and target selects.    |

## Mouse / pointer

Clicking any button triggers its action (add, remove, or reorder). Clicking inside a `select` or `input` opens native OS controls. No custom pointer capture or drag behavior is present.

## Hard scope caps

- **Boolean grouping and OR logic are out of scope.** Conditions within a rule are treated as an implicit AND. Nested condition trees and OR branches are not rendered or managed by this component.
- **No autofocus on mount.** The component does not move focus when it first renders.
- **No inline validation UI.** Cinder does not own validation; no error states, error messages, or `aria-invalid` are set automatically. Consumers that need validation feedback must render their own messages adjacent to the component.
- **Readonly mode is fully non-interactive.** In readonly mode all controls are replaced by text; no keyboard interaction is possible beyond normal document-order Tab navigation.
