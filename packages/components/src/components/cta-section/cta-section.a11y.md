# CtaSection · accessibility

## Pattern

CtaSection is a conversion-focused section with one primary button and an optional secondary button.

## Keyboard and focus

- Both actions are native buttons and must stay keyboard-operable with Enter/Space.
- Keep focus indicators visible on both actions in all themes.

## Names, roles, and state

- `title` should clearly describe the next action.
- Button labels must be specific (avoid vague text like “Click here”).
- If extra legal or pricing context is required, include it via `children`.

## Verification

- Navigate to each button with Tab and activate via keyboard.
- Confirm button labels are announced correctly by a screen reader.

Related components: `button`, `hero-section`, `newsletter-section`.
