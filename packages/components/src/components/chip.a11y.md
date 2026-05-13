# Chip Accessibility

## Three render modes and their DOM shapes

### Display (`mode="display"` or default)

```html
<span class="cinder-chip" data-cinder-mode="display" ...>
  <!-- optional icon -->
  <span class="cinder-chip__icon" aria-hidden="true">...</span>
  <span class="cinder-chip__label">Label text</span>
</span>
```

Non-interactive. No role or aria attributes needed — the span carries only visual meaning.

### Toggle (`mode="toggle"`)

```html
<button type="button" class="cinder-chip" data-cinder-mode="toggle" aria-pressed="false" ...>
  <span class="cinder-chip__icon" aria-hidden="true">...</span>
  <span class="cinder-chip__label">Label text</span>
</button>
```

Root is a native `<button>`. `aria-pressed` reflects the current toggled state (`"true"` or `"false"`). Keyboard: activatable via Space or Enter (native button behavior).

### Removable (`mode="removable"`)

```html
<span class="cinder-chip" data-cinder-mode="removable" ...>
  <span class="cinder-chip__icon" aria-hidden="true">...</span>
  <span class="cinder-chip__label">Label text</span>
  <button type="button" class="cinder-chip__remove" aria-label="Remove Label text">
    <span aria-hidden="true">×</span>
  </button>
</span>
```

Root is a non-interactive span. The × button carries the accessible name.

## Accessible name for the remove button

Default: `"Remove {label}"` — automatically derived from the `label` prop.

Override: pass `removeAriaLabel` for cases where the label alone is ambiguous (e.g., short abbreviations, non-English labels, or empty label). When `label` is empty, **always set `removeAriaLabel`** explicitly to avoid `aria-label="Remove "`.

## aria-pressed on toggle chips

`aria-pressed` must always be a string boolean (`"true"` or `"false"`), never absent. The `pressed` prop is required for `mode="toggle"` — TypeScript enforces this at compile time.

## Click-handler ordering

1. Consumer `onclick` fires first (receives the native `MouseEvent`).
2. If `event.defaultPrevented` is set (by calling `e.preventDefault()` in `onclick`), `onpressedchange` is **not** called.
3. Otherwise `onpressedchange` is called with the toggled boolean value.

This lets consumers intercept the action (e.g., show a confirmation dialog) without preventing the click event from bubbling.

## Touch target strategy

The remove button (`.cinder-chip__remove`) has a visual size of 1rem × 1rem but a 44 × 44 CSS-pixel hit area achieved via asymmetric `padding` (right-heavy, never encroaching into the chip label area) and negative `margin-block` / `margin-inline-end` to prevent the padding from expanding the chip's layout.

## leadingIcon is decorative

The icon slot wrapper (`.cinder-chip__icon`) carries `aria-hidden="true"`. The chip's accessible name comes from the `label` text, so icon content must not carry meaning that isn't also present in the label.

## Disabled state

Native `disabled` attribute on `<button>` elements. Not `aria-disabled`. This ensures the browser automatically blocks all pointer and keyboard events, and assistive technology announces the disabled state correctly. Disabled chips should not be focusable.

## Empty label guidance

When `label` is an empty string:

- Display and toggle chips will render with no visible text (consider providing `aria-label` via the toggle chip's `aria-label` prop).
- Removable chips will default `aria-label` to `"Remove "` — always set `removeAriaLabel` explicitly when `label` is empty.
