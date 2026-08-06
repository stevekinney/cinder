<script lang="ts">
  import Carousel from '../../components/carousel/carousel.svelte';
  import type { CarouselSlide } from '../../components/carousel/carousel.types.ts';

  type Props = {
    slides: CarouselSlide[];
    slidesPerView?: number | 'auto';
  };

  let { slides, slidesPerView = 1 }: Props = $props();
</script>

<Carousel {slides} {slidesPerView}>
  {#snippet slide(item, { index, active })}
    <p class="carousel-slide-snippet-fixture__body" data-testid={`custom-slide-${index}`}>
      {item.label} ({active ? 'active' : 'inactive'})
    </p>
  {/snippet}
</Carousel>
