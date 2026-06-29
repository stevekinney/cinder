# PricingSection

TODO: one-line purpose statement for PricingSection.

## Usage

```svelte
<script lang="ts">
  import PricingSection from '@lostgradient/cinder/pricing-section';
</script>

<PricingSection>Content</PricingSection>
```

## Props

<!-- generated:props:start -->

| Prop           | Type                                                                                                                | Required | Default     | Description                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `as`           | `"section"` \| `"div"`                                                                                              | no       | `"section"` | Wrapper element tag.                                                                                                  |
| `class`        | `string`                                                                                                            | no       | —           | Custom class merged with `.cinder-pricing-section`.                                                                   |
| `columns`      | `1` \| `2` \| `3` \| `4`                                                                                            | no       | `3`         | Grid column count.                                                                                                    |
| `description`  | `string`                                                                                                            | no       | —           | Optional section description.                                                                                         |
| `maxWidth`     | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"`                                                                     | no       | `"wide"`    | Max width token forwarded to Container.                                                                               |
| `plans`        | { caveat?: `string`; cta: `string`; features: `string`[]; name: `string`; price: `string`; selected?: `boolean` }[] | yes      | —           | Plans rendered as PricingCard components.                                                                             |
| `title`        | `string`                                                                                                            | no       | —           | Optional section title.                                                                                               |
| `onPlanSelect` | `(opaque)`                                                                                                          | no       | —           | Callback fired when a plan CTA is clicked. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
