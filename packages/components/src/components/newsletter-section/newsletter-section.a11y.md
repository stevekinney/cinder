# NewsletterSection · accessibility

## Pattern

NewsletterSection captures an email address with a labeled input and submit action.

## Keyboard and focus

- Email field and submit button are keyboard operable by default.
- Keep visible focus styles on both controls.

## Names, roles, and state

- `emailLabel` should stay explicit (avoid placeholder-only labeling).
- `consentText` should communicate privacy expectations when relevant.

## Verification

- Tab to the email field and submit button, then submit with Enter.
- Confirm the input has an accessible name and type `email`.

Related components: `input`, `button`, `cta-section`, `form-section`.
