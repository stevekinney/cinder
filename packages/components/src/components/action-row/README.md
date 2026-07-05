# ActionRow

Full-width button row for selectable sidebars, timelines, and master-detail lists.

Use `ActionRow` when each item in a list should behave like a full-width button with
selection state and optional leading, description, metadata, and trailing regions.

Use the default `selectedState="pressed"` for in-page selection, such as a session
list that swaps the detail panel without navigating. Use `selectedState="current"`
when the row represents the current step, edge, page, or location in a larger set;
set `currentValue` to the matching `aria-current` value.

ActionRow owns the interactive target. Do not put it on an interactive list-item
root or nest secondary buttons inside the row. If the row navigates to a URL, use
`StackedListItem` with `href` or `NavigationItem` instead. If the content is static,
use `DataList` and `StackedListItem`.
