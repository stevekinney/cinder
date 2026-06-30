# PricingSection · accessibility

## Pattern

PricingSection compares multiple plans by composing PricingCard entries.

## Keyboard and focus

- Each plan CTA is a keyboard-accessible button.
- Keep focus styles visible across all plan cards.

## Names, roles, and state

- Plan names and prices should be distinct to avoid ambiguous announcements.
- Use `selected` on the recommended/current plan for non-color state signaling.

## Verification

- Navigate all plan CTAs with keyboard and activate each.
- Confirm selected plan state is announced (via card semantics and visible text).

Related components: `pricing-card`, `stats-section`, `cta-section`.
