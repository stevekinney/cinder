# FormSection

A FormSection component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import FormSection from 'cinder/form-section';
</script>

<FormSection />
```

## Props

<!-- generated:props:start -->

| Prop           | Type                            | Required | Default | Description                                                                                                                |
| -------------- | ------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `as`           | `"section"` \| `"fieldset"`     | no       | —       | Wrapper element. Default.                                                                                                  |
| `class`        | `string`                        | no       | —       | Additional class merged with `.cinder-form-section`.                                                                       |
| `columns`      | `2` \| `3` \| `4` \| `1`        | no       | —       | Column ceiling. Container queries pick the actual rendered count. Default 2.                                               |
| `description`  | `string`                        | no       | —       | Optional descriptive paragraph rendered under the heading/legend.                                                          |
| `heading`      | `string`                        | no       | —       | Heading text rendered as `<h{level}>`.                                                                                     |
| `headingLevel` | `2` \| `3` \| `4` \| `5` \| `6` | no       | —       | Heading level. Default 2.                                                                                                  |
| `children`     | `(opaque)`                      | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
