# Cinder Responsive Layout Policy

Component-owned responsive behavior should use container queries. If a component
changes because its own inline size is constrained, the stylesheet should set
`container-type: inline-size` on the component root and query that container.

Viewport queries are reserved for viewport-owned behavior: app shells, drawers,
and modality switches where the viewport itself is the constraint. Sidebar's
mobile Drawer switch is the current documented exception.

Quality checks for responsive components should include both cases:

- a narrow component container inside a wide viewport
- a wide component container inside a narrow viewport
