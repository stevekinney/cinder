<script lang="ts" module>
  export const title = 'Multi-slide peek';
  export const description =
    'slidesPerView shows more than one slide at once; a fractional value peeks the next slide.';
</script>

<script lang="ts">
  import { Carousel } from '@lostgradient/cinder/carousel';

  // Use inline SVG data URIs for deterministic snapshots — no third-party network dependency.
  const placeholder = (hue: number) =>
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='600'%3E%3Crect width='1200' height='600' fill='hsl(${hue}%2C 40%25%2C 60%25)'/%3E%3C/svg%3E`;

  const slides = Array.from({ length: 6 }, (_, index) => ({
    id: `slide-${index}`,
    label: `Slide ${index + 1}`,
    title: `Slide ${index + 1}`,
    description: 'One of several slides visible at once.',
    imageSrc: placeholder(40 + index * 45),
    imageAlt: `Placeholder ${index + 1}`,
  }));
</script>

<Carousel {slides} slidesPerView={1.2} gap="1rem" label="Multi-slide peek carousel" />
