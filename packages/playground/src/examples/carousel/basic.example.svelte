<script lang="ts" module>
  export const title = 'Basic carousel';
  export const description = 'Prev/next navigation with indicator dots and autoplay support.';
</script>

<script lang="ts">
  import { Carousel } from '@lostgradient/cinder/carousel';

  const autoplayEnabled =
    typeof window === 'undefined'
      ? true
      : new URLSearchParams(window.location.search).get('snapshot') !== '1';

  // Use inline SVG data URIs for deterministic snapshots — no third-party network dependency.
  const placeholder = (hue: number) =>
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='600'%3E%3Crect width='1200' height='600' fill='hsl(${hue}%2C 40%25%2C 60%25)'/%3E%3C/svg%3E`;

  const slides = [
    {
      id: 'intro',
      label: 'Introduction',
      title: 'Welcome to cinder',
      description: 'Start with the core primitives, then compose richer experiences.',
      imageSrc: placeholder(220),
      imageAlt: 'Blue placeholder',
    },
    {
      id: 'patterns',
      label: 'Patterns',
      title: 'Reusable patterns',
      description: 'Build consistent navigation, forms, and data views across your product.',
      imageSrc: placeholder(160),
      imageAlt: 'Green placeholder',
    },
    {
      id: 'shipping',
      label: 'Shipping',
      title: 'Ship faster',
      description: 'Use robust defaults and only customize what your product needs.',
      imageSrc: placeholder(290),
      imageAlt: 'Purple placeholder',
    },
  ];
</script>

<Carousel {slides} autoplay={autoplayEnabled} autoplayInterval={4500} />
