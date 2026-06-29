# TeamSection · accessibility

## Pattern

TeamSection lists people with avatars, roles, and optional profile links.

## Keyboard and focus

- Profile links must be reachable by keyboard.
- AvatarGroup summary (when shown) should remain non-blocking for keyboard flow.

## Names, roles, and state

- Always provide `name` and `role` for each member.
- If profile links are used, link text/context should make destination clear.

## Verification

- Tab through profile links and verify visible focus.
- Confirm member name/role pairing is announced correctly.

Related components: `avatar`, `avatar-group`, `testimonial-section`, `logo-cloud`.
