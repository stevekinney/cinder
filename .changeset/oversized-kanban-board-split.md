---
'@lostgradient/cinder': patch
---

Internal restructuring: move KanbanBoard's pointer hit-testing helpers into `kanban-board-helpers.ts` (parameterized, no closures over component locals) and extract column lift/drop/collapse state into `KanbanBoardColumnReorder`. Also deduplicates the two identical drop-placeholder `<li>` blocks into a shared snippet. No behavior or public API change; markup is unchanged.
