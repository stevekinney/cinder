---
'cinder': minor
---

Promote a batch of beta and experimental components to stable.

**Beta → stable (13 components):** collapsible, container, autocomplete, command-menu, load-more, selection-popover, menu-bar, resizable-panels, time-picker, kanban-board, area-chart, bar-chart, line-chart. Each passed the stable-promotion gate (`bun run components:promotion-check`).

**Experimental → stable, with new import paths (5 components):** connection-indicator, json-viewer, message, timeline, timeline-item moved out of `src/components/experimental/` into the main tree. They are now imported from `cinder/<name>` (for example `cinder/timeline`) instead of `cinder/experimental/<name>`.

The old `cinder/experimental/<name>` import paths still resolve as **deprecated aliases** that re-export the promoted component. Importing an alias logs a one-time deprecation warning in development pointing at the new path. The alias paths — `cinder/experimental/<name>` plus their `/schema`, `/variables`, `/styles`, and `/examples` subpaths — will be removed in the next major version. Migrate to `cinder/<name>` at your convenience.

No runtime behavior changed for any promoted component; this is a status and import-path change.
