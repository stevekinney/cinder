<script lang="ts">
  import Carousel from '../../components/carousel/carousel.svelte';
  import type { CarouselSlide } from '../../components/carousel/carousel.types.ts';

  type Props = {
    slides: CarouselSlide[];
  };

  let { slides }: Props = $props();
</script>

<Carousel {slides}>
  {#snippet slide(item, { index, active })}
    <p class="carousel-slide-snippet-fixture__body" data-testid={`custom-slide-${index}`}>
      {item.label} ({active ? 'active' : 'inactive'})
    </p>
  {/snippet}
</Carousel>
