# FeatureSection · accessibility

## Pattern

FeatureSection exposes a heading plus a list of benefits. Keep each feature title concise and description text readable.

## Keyboard and focus

- FeatureSection itself is non-interactive unless consumer media content adds controls.
- Any interactive content passed via `media` or `children` must remain keyboard accessible.

## Names, roles, and state

- Use a meaningful `title`; this gives the section an accessible name in context.
- Keep decorative `icon` values non-essential (never the only source of meaning).

## Verification

- Read the section with a screen reader and verify feature text order.
- Confirm content remains understandable with icons removed.

Related components: `hero-section`, `testimonial-section`, `team-section`.
