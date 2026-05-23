# SectionHeading

A SectionHeading component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import SectionHeading from 'cinder/section-heading';
</script>

<SectionHeading />
```

## Props

<!-- generated:props:start -->

| Prop          | Type              | Required | Default | Description                                                                                                                                            |
| ------------- | ----------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`       | `string`          | no       | —       | Additional class names merged onto the root `<div>`.                                                                                                   |
| `description` | `string`          | no       | —       | Optional supporting description. Supplementary body text, not a heading subtitle — rendered after the heading but outside `<hgroup>`.                  |
| `level`       | `2` \| `3` \| `4` | no       | —       | Heading level for the title element. Defaults to `2`. The correct level relative to the surrounding document outline is the consumer's responsibility. |
| `title`       | `string`          | yes      | —       | Section title text. Rendered inside the dynamic heading element.                                                                                       |
| `actions`     | `(opaque)`        | —        | —       | function-or-snippet                                                                                                                                    |
| `label`       | `(opaque)`        | —        | —       | function-or-snippet                                                                                                                                    |
| `tabs`        | `(opaque)`        | —        | —       | function-or-snippet                                                                                                                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
