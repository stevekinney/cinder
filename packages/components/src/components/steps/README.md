# Steps

A Steps component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Steps from 'cinder/steps';
</script>

<Steps />
```

## Interactive steps

A step is static text by default. Give a `StepItem` an `href` or an `onclick`
and its body (label + description) becomes a focusable control — an `<a>` for
`href`, a `<button>` for `onclick`. The marker circle and the connector line
stay decorative, so only the body region is clickable and the marker never
joins the accessible name.

```svelte
const steps = [
  { id: 'account', label: 'Account', href: '#account' },
  { id: 'profile', label: 'Profile', onclick: () => goToProfile() },
  { id: 'review', label: 'Review' }, // plain, non-interactive
];
```

When a step has both `href` and `onclick`, it renders as a link and still runs
the callback on click — the consumer decides whether to `preventDefault` (for
SPA routing interception, analytics, or confirmation). For the current step,
`aria-current="step"` moves onto the interactive element; static steps keep it
on the list item.

## Props

<!-- generated:props:start -->

| Prop             | Type                           | Required | Default | Description                                                                                                                                                      |
| ---------------- | ------------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`          | `string`                       | no       | —       | Additional class names merged with `.cinder-steps`.                                                                                                              |
| `completedLabel` | `string`                       | no       | —       | Visually-hidden text prepended to completed steps so screen readers announce state + label. Defaults to 'Completed'.                                             |
| `currentStep`    | `number`                       | yes      | —       | Zero-based index of the active step. Steps with index < currentStep are "completed". Pass `steps.length` to mark every step as complete (terminal "done" state). |
| `label`          | `string`                       | no       | —       | Accessible name for the wrapping nav landmark. Defaults to 'Progress'.                                                                                           |
| `orientation`    | `"horizontal"` \| `"vertical"` | no       | —       | Layout direction. Defaults to 'horizontal'.                                                                                                                      |
| `steps`          | `(opaque)`                     | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
