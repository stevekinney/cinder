# DiffStatistics

Compact inline display of added, modified, and removed line counts for a file diff.

## Choosing this component

- Showing the line-change summary for a single file or commit in a code review, pull-request list, or activity feed.
- Toolbars and compact layouts — use `density="toolbar"` to snap to the shared control-height tier.
- Suppressing zero-count values cleanly with `hideZero` when a file has only additions or only deletions.

## Choosing something else

- General numeric metrics (revenue, users, errors) — use [`Stat`](../stat/README.md) or [`StatGroup`](../stat-group/README.md) for dashboard figures.
- Full diff rendering (side-by-side or unified views of the actual line changes) — DiffStatistics only summarises counts; use a diff renderer component for the actual content.

## Related components

- [`Stat`](../stat/README.md) — general-purpose metric tile for non-diff numeric values.
- [`StatGroup`](../stat-group/README.md) — grid container for multiple `Stat` tiles.

## Usage

```svelte
<script lang="ts">
  import DiffStatistics from '@lostgradient/cinder/diff-statistics';
</script>

<DiffStatistics />
```

## Props

<!-- generated:props:start -->

| Prop       | Type                       | Required | Default | Description                                                                                                                                          |
| ---------- | -------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `added`    | `number`                   | yes      | —       | Number of added lines.                                                                                                                               |
| `class`    | `string`                   | no       | —       | Additional class names merged with `.cinder-diff-statistics`.                                                                                        |
| `density`  | `"toolbar"`                | no       | —       | Toolbar density opt-in (compact variant only). When set, pills snap to the shared `--cinder-control-height-sm` tier.                                 |
| `hideZero` | `boolean`                  | no       | —       | Hide statistics with a zero value.                                                                                                                   |
| `modified` | `number`                   | yes      | —       | Number of modified lines.                                                                                                                            |
| `removed`  | `number`                   | yes      | —       | Number of removed lines.                                                                                                                             |
| `variant`  | `"default"` \| `"compact"` | no       | —       | Layout variant. `default` shows full statistic markup; `compact` trims it for tight surfaces. Distinct from `density`, which adjusts control height. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
