# Button—Accessibility Notes

## Icon-only buttons

Use `iconOnly={true}` for square buttons that show only an icon. The button **must** have an accessible name—either via `aria-label`, `aria-labelledby`, or a non-empty `label` prop (which renders as visually-hidden text).

The dev-mode guard warns when:

- `iconOnly={true}` with no `aria-label`, `aria-labelledby`, or non-empty `label` (no accessible name).
- `iconOnly={true}` with no `leadingIcon`, `trailingIcon`, or `children` (blank square—real UI failure).

`children` is **not** a valid accessible-name source for icon-only buttons because children may be a non-text SVG or other non-text markup. Use `aria-label` or `label` for the name; use `leadingIcon`, `trailingIcon`, or `children` for the visual.

### Accessible-name precedence

1. If `aria-label` (non-empty) or `aria-labelledby` (non-empty) is provided, it becomes the accessible name per the ARIA spec ([accessible name computation](https://www.w3.org/TR/accname-1.2/)). Text content—including a sr-only span—is not considered. Rendering a redundant sr-only span alongside `aria-label` adds invisible DOM noise with no accessible benefit, so the component suppresses it.
2. Otherwise, if `label` is a non-empty string, it is rendered inside a `<span class="cinder-sr-only">`—visually hidden but in the DOM as the accessible name via text content.
3. If neither is present, the dev guard warns; production renders silently (we don't crash apps over a label mistake).

### Icon slots are decorative

`leadingIcon` and `trailingIcon` render inside `<span aria-hidden="true">`. The meaning belongs in the button's accessible name. If an icon must convey meaning (e.g., external-link indicator), put that meaning in `label` or `aria-label` instead.

When `iconOnly={true}`, `children` is also wrapped in an `aria-hidden` span and treated as the visual icon—it is never a name source in this mode.

## Touch targets

Button sizes intentionally follow a compact visual ladder:

- `xs`: 24px
- `sm`: 28px
- `md` (default): 32px
- `lg`: 36px
- `xl`: 40px

These are visual component sizes, not guaranteed touch-target sizes. Use spacing around the button, a larger containing row, or an app-level hit target pattern when a touch-first surface needs to satisfy [WCAG 2.5.5 AAA target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).

### Follow-up

A [Playwright](https://playwright.dev/) check for rendered `md`/`lg`/`xl` heights is tracked as a future task once the playground has browser coverage.

## Loading state

The spinner is a CSS `::after` pseudo-element—not a DOM node. Pseudo-elements are excluded from the accessibility tree per the ARIA specification, so no explicit `aria-hidden` is needed on a spinner element.

The button's label text (`label` prop or `children`) remains in the DOM throughout the loading state and continues to serve as the accessible name. `aria-busy="true"` communicates the loading state to assistive technology. `aria-disabled="true"` signals that the button is not interactive during loading.

## Forced-colors ([Windows High Contrast](https://learn.microsoft.com/en-us/windows/apps/design/accessibility/high-contrast-themes))

The focus ring uses `outline: var(--cinder-ring-width) solid ButtonText` under `@media (forced-colors: active)`—guaranteed to contrast against the button surface.

`soft` and `soft-danger` variants add `border: 1px solid ButtonBorder` under forced-colors so they remain visually distinct. Verify in Windows High Contrast emulator before shipping.

## Soft variant contrast

`soft` and `soft-danger` use `color-mix(in oklch, var(--cinder-accent|danger), transparent 88%)` as the background. Contrast ratios must be verified mechanically before shipping: compute the resolved hex values via browser devtools Computed panel for both light and dark themes, then run through the [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/). Record the numeric ratios in the PR description. If either theme falls below 4.5:1 for normal text, introduce per-theme `--cinder-color-accent-soft-bg`/`-fg` tokens with explicit values that meet the threshold.

## Variant guidance

- `primary`: high-emphasis action. One per region.
- `secondary`: medium-emphasis, outline-flavored (surface fill + border).
- `soft`: medium-emphasis, tinted fill, no border. Good for secondary actions in colored contexts.
- `soft-danger`: same as soft but uses danger tint. For destructive secondary actions.
- `danger`: high-emphasis destructive action.
- `ghost`: low-emphasis, transparent background.
- `ghost-danger`: low-emphasis destructive action.
