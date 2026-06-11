# ChoiceGrid

Responsive grid of large selectable choices with roving keyboard focus, selection state, and optional correct/incorrect/pending feedback for quiz and assessment surfaces.

## Usage

```svelte
<script lang="ts">
  import { ChoiceGrid } from '@lostgradient/cinder/choice-grid';

  let selected = $state<string | null>(null);
</script>

<ChoiceGrid ariaLabel="Choose a difficulty" bind:value={selected}>
  <ChoiceGrid.Item value="easy">Easy</ChoiceGrid.Item>
  <ChoiceGrid.Item value="medium">Medium</ChoiceGrid.Item>
  <ChoiceGrid.Item value="hard">Hard</ChoiceGrid.Item>
</ChoiceGrid>
```

## Guidance

### Use When

- Presenting a small fixed set of large selectable answers where all options should stay visible (quiz or assessment surfaces).
- Building a touch-friendly selector grid with stable cell dimensions that must not shift when feedback states are applied.

### Avoid When

- Selecting from a long dynamic list — use combobox or select instead.
- Choosing one of two to five short values in a compact inline context — use segmented-control instead.

## Props

<!-- generated:props:start -->

| Prop             | Type                                       | Required | Default | Description                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------ | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel`      | `string`                                   | no       | —       | Accessible label for the grid (required unless `ariaLabelledby` is set).                                                                                                                                                      |
| `ariaLabelledby` | `string`                                   | no       | —       | Id of an external element that labels this grid.                                                                                                                                                                              |
| `columns`        | `"responsive"` \| `1` \| `2` \| `3` \| `4` | no       | —       | Column layout. - `'responsive'` — `auto-fill` at a minimum cell width (default). - `1 \| 2 \| 3 \| 4` — fixed number of columns.                                                                                              |
| `disabled`       | `boolean`                                  | no       | —       | Disables all items in the grid.                                                                                                                                                                                               |
| `minColumnWidth` | `string`                                   | no       | —       | Minimum cell width for `columns="responsive"`. Accepts any CSS `<length>` (e.g. `"12rem"`, `"200px"`). Default: `"10rem"`.                                                                                                    |
| `multiple`       | `boolean`                                  | no       | —       | When true the grid allows multiple simultaneous selections and reads/writes `values` instead of `value`. The ARIA role switches to `group` (items become `checkbox`); single-select uses `radiogroup` (items become `radio`). |
| `value`          | `string` \| `null`                         | no       | —       | The currently selected value (single-select mode). Bindable. Pass `null` or omit to start with no selection.                                                                                                                  |
| `values`         | `string`[]                                 | no       | —       | Currently selected values (multi-select mode). Bindable. Only used when `multiple` is `true` — set `multiple` explicitly to switch modes; binding `values` alone does NOT enable multi-select.                                |
| `children`       | `(opaque)`                                 | yes      | —       | `ChoiceGridItem` children. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                         |
| `class`          | `(opaque)`                                 | no       | —       | Additional class names merged with `.cinder-choice-grid`. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
