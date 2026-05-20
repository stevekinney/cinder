# DiffStatistics

A DiffStatistics component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import DiffStatistics from 'cinder/diff-statistics';
</script>

<DiffStatistics />
```

## Props

<!-- generated:props:start -->

| Prop       | Type                       | Required | Default | Description                                                                                                          |
| ---------- | -------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `added`    | `number`                   | yes      | —       | Number of added lines.                                                                                               |
| `class`    | `string`                   | no       | —       | Additional class names merged with `.cinder-diff-statistics`.                                                        |
| `density`  | `"toolbar"`                | no       | —       | Toolbar density opt-in (compact variant only). When set, pills snap to the shared `--cinder-control-height-sm` tier. |
| `hideZero` | `boolean`                  | no       | —       | Hide statistics with a zero value.                                                                                   |
| `modified` | `number`                   | yes      | —       | Number of modified lines.                                                                                            |
| `removed`  | `number`                   | yes      | —       | Number of removed lines.                                                                                             |
| `variant`  | `"default"` \| `"compact"` | no       | —       | Visual density.                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
