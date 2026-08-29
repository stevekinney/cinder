# KeyValueEditor Accessibility

## Pattern

KeyValueEditor is a compact editor for an ordered list of string key/value pairs. It owns row mutation, stable per-row control ids, and the policy that selected keys may render through `SecretValueField` instead of a plain value input.

Purpose: Edit request headers, environment variables, and other configuration pairs while keeping secret values masked.

## Design review

Nearest neighbours: `Input`, `SecretValueField`, and `DataTable`. DataTable is appropriate for read-only structured data; KeyValueEditor is admitted because it owns pair editing, add/remove behavior, and secret-cell routing that a Table composition does not provide.

Visual outcome: two aligned fields per row with a clearly labelled remove action and an add action after the list. The component composes the existing Input and SecretValueField primitives rather than recreating their form and security behavior.

## Keyboard and focus

Rows use `role="list"` and `role="listitem"`; the key input, value input or secret copy/reveal controls, remove button, and add button remain in native document tab order. Enter and Space retain native button behavior for add/remove. No arrow-key or roving-focus model is introduced, so users can move through fields with Tab and Shift+Tab predictably.

## Names, roles, and state

Each Input has a programmatic label (`Key` or `Value`) and a unique id derived from its row index. Remove buttons use `removeLabel(key)` so the action identifies its row. When `secret(key)` returns true, the value cell is a SecretValueField: the value is masked by default and is not copied into passive attributes or the editor's visible text. Consumers should provide meaningful keys because those keys become the secret field's accessible label.

## Verification

- Render empty, single-row, and multi-row states in a focused fixture.
- Navigate all controls with keyboard only and verify add/remove actions preserve focus order.
- Inspect labels, list semantics, button names, and masked secret output in browser accessibility tools.
- Check forced-colors mode and narrow layouts for visible focus indicators and usable row controls.

Related components: `input`, `secret-value-field`, `data-table`, `table`.
