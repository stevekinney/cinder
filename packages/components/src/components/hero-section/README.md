# HeroSection

Renders a landing-page hero with headline, supporting copy, actions, and optional media.

## Usage

```svelte
<script lang="ts">
  import HeroSection from '@lostgradient/cinder/hero-section';
</script>

<HeroSection
  title="Build better products with Cinder"
  description="Composable sections for modern marketing pages."
/>
```

## Props

<!-- generated:props:start -->

| Prop            | Type                                            | Required | Default     | Description                                                                                                                           |
| --------------- | ----------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `align`         | `"start"` \| `"center"`                         | no       | `"start"`   | Text alignment for heading and body copy.                                                                                             |
| `as`            | `"section"` \| `"div"`                          | no       | `"section"` | Wrapper element tag.                                                                                                                  |
| `class`         | `string`                                        | no       | —           | Custom class merged with `.cinder-hero-section`.                                                                                      |
| `description`   | `string`                                        | no       | —           | Supporting copy shown below the title.                                                                                                |
| `eyebrow`       | `string`                                        | no       | —           | Small uppercase intro label rendered above the title.                                                                                 |
| `maxWidth`      | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"` | no       | `"wide"`    | Max width token forwarded to Container.                                                                                               |
| `mediaPosition` | `"start"` \| `"end"`                            | no       | `"end"`     | Position of the optional media panel on wide layouts.                                                                                 |
| `title`         | `string`                                        | yes      | —           | Main marketing headline.                                                                                                              |
| `actions`       | `(opaque)`                                      | no       | —           | Optional CTA row, usually one or two Button components. Not expressible in JSON Schema; see the component types for the signature.    |
| `children`      | `(opaque)`                                      | no       | —           | Optional extra content rendered below description/actions. Not expressible in JSON Schema; see the component types for the signature. |
| `media`         | `(opaque)`                                      | no       | —           | Optional visual/media block (image, demo, illustration). Not expressible in JSON Schema; see the component types for the signature.   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
