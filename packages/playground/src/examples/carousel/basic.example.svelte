<script lang="ts" module>
  export const title = 'Basic carousel';
  export const description = 'Prev/next navigation with indicator dots and autoplay support.';
</script>

<script lang="ts">
  import { Carousel } from '@lostgradient/cinder/carousel';

  const slides = [
    {
      id: 'intro',
      label: 'Introduction',
      title: 'Welcome to cinder',
      description: 'Start with the core primitives, then compose richer experiences.',
      imageSrc:
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Laptop on a desk',
    },
    {
      id: 'patterns',
      label: 'Patterns',
      title: 'Reusable patterns',
      description: 'Build consistent navigation, forms, and data views across your product.',
      imageSrc:
        'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Code editor on a monitor',
    },
    {
      id: 'shipping',
      label: 'Shipping',
      title: 'Ship faster',
      description: 'Use robust defaults and only customize what your product needs.',
      imageSrc:
        'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Design board with color swatches',
    },
  ];
</script>

<Carousel {slides} autoplay autoplayInterval={4500} />
