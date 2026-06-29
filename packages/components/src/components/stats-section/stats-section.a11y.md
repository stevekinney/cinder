# StatsSection · accessibility

## Pattern

StatsSection wraps StatGroup/Stat to present key numeric outcomes.

## Keyboard and focus

- StatsSection is informational and non-interactive by default.
- Any interactive content added nearby should keep normal tab order.

## Names, roles, and state

- Provide `label` (or keep default) so the stat group has an accessible group name.
- Include `changeValue` + `changeDirection` together when trend context is needed.

## Verification

- Check stat labels and values read in order with a screen reader.
- Verify trend direction wording remains understandable without color cues.

Related components: `stat-group`, `stat`, `pricing-section`.
