# Accessibility Notes: VisuallyHidden

## Purpose

`<VisuallyHidden>` hides content **visually** while keeping it in the accessibility tree. Screen readers and other assistive technology announce the text; sighted users do not see it.

This is the opposite of `aria-hidden="true"`, which removes content from the accessibility tree but leaves it visible.

## When to use this vs `aria-label` / `aria-labelledby`

Prefer ARIA attributes when the visible UI already names the element:

```svelte
<!-- Good: the button's visible label is already descriptive -->
<button>Save document</button>

<!-- Good: use aria-label when no visible label exists -->
<button aria-label="Close dialog">✕</button>
```

Use `<VisuallyHidden>` when you need additional context only assistive technology should announce, or when the announcement is a phrase that does not fit cleanly in a single attribute:

```svelte
<!-- Icon-only button with supplemental label -->
<button>
  <CopyIcon aria-hidden="true" />
  <VisuallyHidden>Copy code to clipboard</VisuallyHidden>
</button>

<!-- Status announcement not tied to a specific element -->
<VisuallyHidden role="status">3 new messages</VisuallyHidden>
```

## When NOT to use this

- **Not a replacement for `aria-hidden`.** `<VisuallyHidden>` keeps content in the accessibility tree. To hide decorative content from assistive technology, use `aria-hidden="true"`.
- **Not for hiding from everyone.** If content should be hidden from both sighted users and assistive technology, use `display: none` or the `hidden` attribute.
- **Not for decorative images.** Decorative images should have `alt=""` and optionally `aria-hidden="true"`.

## Skip-link recipe

A skip link lets keyboard users jump past repeated navigation to the main content. The `focusable` prop reveals the element when focused.

```svelte
<!-- Place as the very first focusable element in your app shell -->
<VisuallyHidden as="a" href="#main-content" focusable>Skip to main content</VisuallyHidden>

<!-- ... navigation, header, etc. ... -->

<main id="main-content" tabindex="-1">
  <!-- page content -->
</main>
```

Key points:

- Use `as="a"` with `href` so the anchor is natively focusable and activatable.
- The target (`#main-content`) should have `tabindex="-1"` if it would not otherwise receive focus — this ensures browsers move focus to the landmark on activation, not just scroll to it.
- This primitive does **not** move focus programmatically. Activation of the anchor relies on the browser's default in-page navigation behavior.
- Using `tabindex={0}` on a non-interactive element (e.g., `as="div"`) creates a keyboard stop with no action. If you must do it, add a valid interactive `role` and keyboard handlers — that is outside this primitive's scope.

See also: [`docs/recipes/skip-link.md`](../../../../docs/recipes/skip-link.md) for the full skip-link recipe — placement guidance, multiple-skip-link patterns, and common pitfalls.

## Styling the focused state

The default `.cinder-sr-only-focusable` rule pins the element to the top-left of the viewport with a positioned chip when focused. This is the canonical skip-link placement.

To override placement or appearance, target the focus selectors with a more specific selector:

```css
/* Example: pin to top-center instead */
.my-skip-link.cinder-sr-only-focusable:focus,
.my-skip-link.cinder-sr-only-focusable:focus-visible {
  left: 50%;
  transform: translateX(-50%);
}
```

All values in the default rule are concrete (not `revert`), so you only need to override the specific properties you want to change.

## Testing your usage

A `<VisuallyHidden>` element must be queryable by text in unit tests:

```ts
const { getByText } = render(MyComponent);
expect(getByText('Copy code to clipboard')).toBeDefined();
```

If `getByText` returns nothing, the primitive has been broken or the content has been removed from the accessibility tree.
