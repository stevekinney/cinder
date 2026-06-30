# TestimonialSection

Renders customer testimonial quotes in a single-featured or multi-card grid layout.

## Usage

```svelte
<script lang="ts">
  import TestimonialSection from '@lostgradient/cinder/testimonial-section';

  const testimonials = [
    { quote: 'Cinder cut our page build time in half.', name: 'Alex Morgan', role: 'VP Product' },
    { quote: 'We shipped our redesign in two weeks.', name: 'Riley Chen', role: 'Design Lead' },
  ];
</script>

<TestimonialSection title="Loved by product teams" {testimonials} />
```

## Props

<!-- generated:props:start -->

| Prop           | Type                                                                                             | Required | Default     | Description                                             |
| -------------- | ------------------------------------------------------------------------------------------------ | -------- | ----------- | ------------------------------------------------------- |
| `as`           | `"section"` \| `"div"`                                                                           | no       | `"section"` | Wrapper element tag.                                    |
| `class`        | `string`                                                                                         | no       | —           | Custom class merged with `.cinder-testimonial-section`. |
| `columns`      | `2` \| `3`                                                                                       | no       | `3`         | Columns used by grid layout.                            |
| `description`  | `string`                                                                                         | no       | —           | Optional heading description.                           |
| `layout`       | `"single"` \| `"grid"`                                                                           | no       | `"grid"`    | Layout mode.                                            |
| `maxWidth`     | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"`                                                  | no       | `"wide"`    | Max width token forwarded to Container.                 |
| `testimonials` | { avatarSrc?: `string`; company?: `string`; name: `string`; quote: `string`; role?: `string` }[] | yes      | —           | Testimonials to render.                                 |
| `title`        | `string`                                                                                         | no       | —           | Optional section heading.                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
