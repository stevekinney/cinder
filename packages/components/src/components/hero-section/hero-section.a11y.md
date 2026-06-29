# HeroSection · accessibility

## Pattern

HeroSection introduces a page with primary messaging, optional actions, and optional media.

## Keyboard and focus

- Action controls passed through `actions` must be keyboard reachable.
- Do not hide focus indicators on action buttons or links.

## Names, roles, and state

- `title` should summarize the page value proposition.
- Use `description` for supporting context, not as the only headline.
- If media is decorative, keep it out of the accessibility tree (empty `alt`).

## Verification

- Confirm heading text is announced in reading order before actions/media.
- Tab through action controls and verify visible focus and activation.

Related components: `cta-section`, `feature-section`, `container`, `button`.
