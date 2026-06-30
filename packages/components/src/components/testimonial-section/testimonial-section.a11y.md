# TestimonialSection · accessibility

## Pattern

TestimonialSection presents quoted feedback with clear author attribution.

## Keyboard and focus

- Section is non-interactive unless consumer content adds links.
- Any added links/buttons inside quotes must preserve focus visibility.

## Names, roles, and state

- Each testimonial should include a real `name` for attribution.
- Use `role`/`company` fields to provide meaningful context, not visual-only decoration.

## Verification

- Read through testimonials with a screen reader to confirm quote → author order.
- Ensure attribution remains understandable without avatar images.

Related components: `avatar`, `feature-section`, `team-section`.
