# Progress

A Progress component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Progress from 'cinder/progress';
</script>

<Progress />
```

## Props

<!-- generated:props:start -->

| Prop      | Type                       | Required | Default | Description                                            |
| --------- | -------------------------- | -------- | ------- | ------------------------------------------------------ |
| `class`   | `string`                   | no       | —       | Additional class names merged with `.cinder-progress`. |
| `label`   | `string`                   | no       | —       | Human-readable status, exposed as `aria-valuetext`.    |
| `max`     | `number`                   | no       | —       | Maximum value. Defaults to 100.                        |
| `size`    | `"sm"` \| `"md"` \| `"lg"` | no       | —       | Size token. Default `md`.                              |
| `value`   | `number`                   | no       | —       | Current progress value. Omit for indeterminate.        |
| `variant` | `"bar"` \| `"ring"`        | no       | —       | Visual variant. Default `bar`.                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
