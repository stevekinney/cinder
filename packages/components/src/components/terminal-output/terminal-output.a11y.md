# TerminalOutput design and accessibility review

## Design review (required)

- Reviewer: Cinder maintainers
- Review outcome: Approved. The read-only surface stays visually subordinate to interactive terminal shells and preserves terminal color without recreating terminal chrome. The keyboard-scrollable log viewport uses a visible focus treatment.
- Nearest neighbours: CodeBlock, Feed, TerminalFrame.
- Why this component exists: CodeBlock renders static source and Feed renders structured events; neither interprets ANSI styling or carriage-return line rewrites.
- Findings and resolutions: The implementation supports only the documented SGR palette and line controls, uses the shared terminal token ramp, and leaves unsupported escape sequences inert.

## Novel interaction accessibility review

- Applies: No—the component is a read-only log with no component-owned interaction.
- Reviewer: Cinder maintainers
- Review outcome: Approved. Native text selection remains available and the keyboard-scrollable log viewport has a focus target for users who need to inspect a long stream.

### Focus management

TerminalOutput never moves focus. Its own scrollable `role="log"` viewport is keyboard focusable and exposes a visible focus indicator.

### Keyboard matrix

| Key or gesture | Context     | Expected behavior                           |
| -------------- | ----------- | ------------------------------------------- |
| Text selection | Output text | Browser-native text selection is preserved. |

### Assistive-technology announcements

The root exposes `role="log"` with polite live behavior. Consumers provide an accessible name through `aria-label` or `aria-labelledby`. ANSI color is decorative and never the only carrier of meaning; carriage-return rewrites expose only the resulting line content.
