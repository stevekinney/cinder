# Steps

A Steps component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Steps from 'cinder/steps';
</script>

<Steps />
```

## Props

<!-- generated:props:start -->

| Prop             | Type                                                        | Required | Default | Description                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`          | `string`                                                    | no       | —       | Additional class names merged with `.cinder-steps`.                                                                                                              |
| `completedLabel` | `string`                                                    | no       | —       | Visually-hidden text prepended to completed steps so screen readers announce state + label. Defaults to 'Completed'.                                             |
| `currentStep`    | `number`                                                    | yes      | —       | Zero-based index of the active step. Steps with index < currentStep are "completed". Pass `steps.length` to mark every step as complete (terminal "done" state). |
| `label`          | `string`                                                    | no       | —       | Accessible name for the wrapping nav landmark. Defaults to 'Progress'.                                                                                           |
| `orientation`    | `"horizontal"` \| `"vertical"`                              | no       | —       | Layout direction. Defaults to 'horizontal'.                                                                                                                      |
| `steps`          | { description?: `string`; id: `string`; label: `string` }[] | yes      | —       | Ordered list of step entries from first to last.                                                                                                                 |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
