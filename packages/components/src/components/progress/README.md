# Progress

Visual indicator of task completion as a filled bar or percentage readout.

## Usage

```svelte
<script lang="ts">
  import Progress from '@lostgradient/cinder/progress';
</script>

<Progress />
```

## Props

<!-- generated:props:start -->

| Prop             | Type                       | Required | Default | Description                                                                                                                                                                        |
| ---------------- | -------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel`      | `string`                   | no       | —       | Accessible name applied directly to the progressbar element when no visible label element is present in the page. Required unless `ariaLabelledby` is supplied.                    |
| `ariaLabelledby` | `string`                   | no       | —       | Id of a visible element that serves as the accessible name for the progressbar. Prefer this over `ariaLabel` when a visible label exists. Required unless `ariaLabel` is supplied. |
| `class`          | `string`                   | no       | —       | Additional class names merged with `.cinder-progress`.                                                                                                                             |
| `label`          | `string`                   | no       | —       | Human-readable status, exposed as `aria-valuetext`. NOT the accessible name — supply `ariaLabel` or `ariaLabelledby` for that.                                                     |
| `max`            | `number`                   | no       | —       | Maximum value. Defaults to 100.                                                                                                                                                    |
| `size`           | `"sm"` \| `"md"` \| `"lg"` | no       | —       | Size token. Default `md`.                                                                                                                                                          |
| `value`          | `number`                   | no       | —       | Current progress value. Omit for indeterminate.                                                                                                                                    |
| `variant`        | `"bar"` \| `"ring"`        | no       | —       | Visual variant. Default `bar`.                                                                                                                                                     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
