# SectionHeading

Styled heading element that visually separates and titles a content section.

## Usage

```svelte
<script lang="ts">
  import SectionHeading from '@lostgradient/cinder/section-heading';
</script>

<SectionHeading />
```

## Props

<!-- generated:props:start -->

| Prop          | Type              | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ----------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`          | no       | —       | Additional class names merged onto the root `<div>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `description` | `string`          | no       | —       | Optional supporting description. Supplementary body text, not a heading subtitle — rendered after the heading but outside `<hgroup>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `level`       | `2` \| `3` \| `4` | no       | —       | Heading level for the title element. Defaults to `2`. The correct level relative to the surrounding document outline is the consumer's responsibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `title`       | `string`          | yes      | —       | Section title text. Rendered inside the dynamic heading element.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `actions`     | `(opaque)`        | no       | —       | Optional trailing actions (buttons, menus). Rendered on the same row as the title at wide viewports. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `label`       | `(opaque)`        | no       | —       | Optional small uppercase "eyebrow" label. When present, the label is rendered as a `<p>` inside an `<hgroup>` that also contains the heading. The `<hgroup>` content model only permits `<p>` elements plus one heading element, so the snippet **must render phrasing content only** — plain text, `<span>`, `<strong>`, `<em>`, `<a>`, icons, etc. Do not render block elements (`<div>`, `<nav>`, `<button>` wrappers, additional headings) into this snippet; doing so produces invalid HTML inside `<hgroup>`. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `tabs`        | `(opaque)`        | no       | —       | Optional tablist. When both `actions` and `tabs` are present, `tabs` sits on a second row inside the shared root container. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
