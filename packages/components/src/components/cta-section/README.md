# CtaSection

Renders a focused call-to-action section with a primary button and optional secondary action.

## Usage

```svelte
<script lang="ts">
  import CtaSection from '@lostgradient/cinder/cta-section';
</script>

<CtaSection title="Ready to get started?" primaryActionLabel="Start free trial" />
```

## Props

<!-- generated:props:start -->

| Prop                   | Type                                            | Required | Default     | Description                                                                                                                    |
| ---------------------- | ----------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `align`                | `"start"` \| `"center"`                         | no       | `"center"`  | Content alignment.                                                                                                             |
| `as`                   | `"section"` \| `"div"`                          | no       | `"section"` | Wrapper element tag.                                                                                                           |
| `class`                | `string`                                        | no       | —           | Custom class merged with `.cinder-cta-section`.                                                                                |
| `description`          | `string`                                        | no       | —           | Optional supporting copy.                                                                                                      |
| `maxWidth`             | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"` | no       | `"wide"`    | Max width token forwarded to Container.                                                                                        |
| `primaryActionLabel`   | `string`                                        | yes      | —           | Label for the primary call-to-action button.                                                                                   |
| `secondaryActionLabel` | `string`                                        | no       | —           | Optional label for a secondary action button.                                                                                  |
| `title`                | `string`                                        | yes      | —           | Main CTA title.                                                                                                                |
| `tone`                 | `"default"` \| `"accent"`                       | no       | `"default"` | Visual tone.                                                                                                                   |
| `children`             | `(opaque)`                                      | no       | —           | Optional supplemental content below action buttons. Not expressible in JSON Schema; see the component types for the signature. |
| `onPrimaryClick`       | `(opaque)`                                      | no       | —           | Primary action click callback. Not expressible in JSON Schema; see the component types for the signature.                      |
| `onSecondaryClick`     | `(opaque)`                                      | no       | —           | Secondary action click callback. Not expressible in JSON Schema; see the component types for the signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
