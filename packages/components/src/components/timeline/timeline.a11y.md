# Timeline · accessibility

## Pattern

Timeline presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Timestamp-first event rail that renders workflow, audit, or run-history entries with grouping, tone markers, and connector continuity.

## Use when

- Visualizing an ordered sequence of dated events with a temporal rail, timestamp labels, grouping headers, and marker tones.
- Displaying workflow steps, audit logs, or run histories where each entry needs connector continuity or gap breaks.

## Avoid when

- Surfacing a real-time social or activity stream — feed is the higher-affordance composition.
- Guiding users through a numbered procedural flow — steps conveys progress more clearly.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Timeline, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Timeline accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Timeline in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `feed`, `steps`.
