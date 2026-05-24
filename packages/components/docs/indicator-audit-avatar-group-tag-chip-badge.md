# Indicator audit: AvatarGroup, Tag, Chip, and Badge

Decision: Tag is display-mode Chip

Tag does not need a third public primitive in this branch. The existing Chip already owns tag-like tokens through `mode="display"`, `mode="toggle"`, and `mode="removable"`; the gap was documentation clarity, not runtime behavior. Badge remains the compact annotation for counts, statuses, and short categories attached to another element.

| Dimension                | Badge                                                            | Chip                                                                           | Tag conclusion                                                      |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Primary job              | Annotate a nearby value with compact status, count, or category. | Represent a standalone token such as a label, filter, selected entity, or tag. | Tag maps to Chip because the token is the object being shown.       |
| Interactivity            | Non-interactive.                                                 | Display, toggle, or removable depending on mode.                               | Static tags use display-mode Chip; selectable tags use toggle Chip. |
| Removability             | Not removable.                                                   | Removable mode includes a remove button.                                       | Removable tags already fit Chip.                                    |
| Status/count semantics   | First-class use case.                                            | Possible through variants, but not the main count/status annotation primitive. | Status pills and notification counts stay Badge.                    |
| Metadata-label semantics | Secondary fit only when annotating another element.              | First-class fit for issue labels and free-form metadata.                       | Metadata labels should use display-mode Chip.                       |
| Recommended component    | `Badge`                                                          | `Chip mode="display"` by default                                               | No new `Tag` component.                                             |

| Use case            | Use this                                        | Do not use this when                                                   |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Issue labels        | `Chip mode="display"`                           | The label is a count or status attached to another heading; use Badge. |
| Notification counts | `Badge`                                         | The count is a removable or selectable filter token.                   |
| Status pills        | `Badge`                                         | The status is one of many selectable filter values; use toggle Chip.   |
| Filters             | `Chip mode="toggle"` or `Chip mode="removable"` | The token is purely a numeric count.                                   |
| Selected entities   | `Chip`                                          | You need a person image stack; use AvatarGroup.                        |
| Removable tags      | `Chip mode="removable"`                         | The tag is a static display label; use display-mode Chip.              |

AvatarGroup remains a separate component because overlapping collaborator identity stacks have layout, overflow, tooltip, and focus-discovery behavior that Avatar alone does not own.
