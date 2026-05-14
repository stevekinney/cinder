# SearchField—Accessibility Notes

## Native `<input type="search">`

The field uses `<input type="search">`, which has built-in `role="searchbox"`. Do **not** add an explicit `role="searchbox"`—per the [ARIA spec](https://www.w3.org/TR/wai-aria-1.2/#searchbox) it is redundant on the native element and adds no semantic value.

The native WebKit clear button is suppressed via CSS (`::-webkit-search-cancel-button { display: none }`) so the rendered clear button is the single, predictable control across browsers.

## Leading icon

The search icon is wrapped in `aria-hidden="true"`. The icon is decorative—the field's role and placeholder already convey purpose, and a sighted-only icon does not need to be announced again.

## Clear button

- **Accessible name:** `aria-label="Clear search"` (the button has no visible text—it shows an `aria-hidden` X icon).
- **Form safety:** `type="button"` prevents accidental form submission.
- **Tab order:** `tabindex="0"` when the field has a value, `tabindex="-1"` when empty. The button is also rendered with the `hidden` attribute when empty, so it is removed from the accessibility tree entirely until there is something to clear.
- **Focus return:** After clearing, focus is moved back to the input. This matches the user's mental model—they were in the search field, the clear action does not change where they are.

## Shortcut hint

When the `shortcut` prop is provided, a trailing `<kbd aria-hidden="true">` badge renders the hint text (e.g. `⌘K`). The badge is **decorative**—it is `aria-hidden` because the shortcut itself is the consumer's responsibility to wire globally, and announcing it alongside the field would be misleading if no handler is bound.

If you want the shortcut announced to assistive technology, set the field's accessible name via `aria-label` or a `FormField` description that includes the shortcut text—but the visual badge does not duplicate it.

## Form-field integration

When wrapped in `<FormField>`, the `SearchField` reads the field's `id`, `aria-describedby` (description and error), `aria-invalid`, `required`, and `disabled` from context. Set the same `id` on both `FormField` and `SearchField` (or omit `id` on `SearchField` to inherit the context's `controlId`).

## Wrapping `<search>` / `<form role="search">`

The component does **not** wrap itself in `<search>` or `<form role="search">`. That is appropriate when the field performs a site-wide search, and the surrounding landmark belongs to the consumer's page layout, not to the primitive.
