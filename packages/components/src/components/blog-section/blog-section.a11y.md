# BlogSection · accessibility

## Pattern

BlogSection presents a list of linked articles with author context. Keep link text descriptive, preserve heading structure, and ensure decorative thumbnails use empty alt text.

## Keyboard and focus

- Every post title link must remain keyboard focusable.
- Do not remove visible focus styles from links.

## Names, roles, and state

- Use meaningful `title` and `description` so the section is understandable out of context.
- Provide `authorName` for each post so attribution is announced.
- Keep `href` destinations valid and unique.

## Verification

- Tab through post links and confirm visible focus.
- Check that each article card exposes readable text order in accessibility tools.

Related components: `card`, `avatar`, `logo-cloud`, `testimonial-section`.
