<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status beta
   * @purpose Rotating content viewport with previous/next controls, picker dots, and optional autoplay.
   * @tag navigation
   * @tag carousel
   * @tag media
   * @useWhen Presenting a finite set of visual highlights with sequential browsing controls.
   * @useWhen Cycling between promotional or tutorial panels inside a single region.
   * @avoidWhen Content should remain simultaneously visible and scannable. | grid
   * @avoidWhen You only need one static hero panel with no sequence controls.
   * @related image, aspect-ratio, masonry
   * @a11yPattern WAI-ARIA Carousel
   * @keyboardShortcut ArrowLeft / ArrowRight / Home / End | Moves between slides.
   * @a11yNote Auto-advance pauses on hover and focus, and is disabled under reduced motion.
   */
  export type {
    CarouselControlLabel,
    CarouselProps,
    CarouselSlide,
    CarouselSlideContent,
  } from './carousel.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import type { CarouselProps } from './carousel.types.ts';

  const reducedMotion = useReducedMotion();
  const descriptionId = $props.id();

  let {
    slides,
    activeIndex = $bindable(0),
    autoplay = false,
    autoplayInterval = 5000,
    label = 'Carousel',
    description,
    controlLabels,
    class: className,
    ...rest
  }: CarouselProps = $props();

  let isHovered = $state(false);
  let hasFocusWithin = $state(false);

  const clampedLength = $derived(slides.length);
  const currentIndex = $derived.by(() => {
    if (clampedLength < 1) return 0;
    return Math.max(0, Math.min(clampedLength - 1, activeIndex));
  });

  $effect(() => {
    if (clampedLength < 1) {
      if (activeIndex !== 0) activeIndex = 0;
      return;
    }
    const normalizedIndex = Math.max(0, Math.min(clampedLength - 1, activeIndex));
    if (activeIndex !== normalizedIndex) activeIndex = normalizedIndex;
  });

  const shouldAutoplay = $derived(
    autoplay &&
      clampedLength > 1 &&
      autoplayInterval > 0 &&
      !reducedMotion.current &&
      !isHovered &&
      !hasFocusWithin,
  );
  const liveAnnouncement = $derived.by(() => {
    if (!slides[currentIndex]) return '';
    return `Slide ${currentIndex + 1} of ${clampedLength}: ${slides[currentIndex].label}`;
  });

  $effect(() => {
    if (!shouldAutoplay) return;
    const timer = setInterval(() => {
      if (clampedLength < 2) return;
      activeIndex = (currentIndex + 1) % clampedLength;
    }, autoplayInterval);
    return () => clearInterval(timer);
  });

  function goTo(index: number) {
    if (clampedLength < 1) return;
    activeIndex = ((index % clampedLength) + clampedLength) % clampedLength;
  }

  function goPrevious() {
    goTo(currentIndex - 1);
  }

  function goNext() {
    goTo(currentIndex + 1);
  }

  function onKeydown(event: KeyboardEvent) {
    if (clampedLength < 2) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrevious();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext();
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      goTo(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      goTo(clampedLength - 1);
    }
  }

  function onFocusOut(event: FocusEvent) {
    const nextFocus = event.relatedTarget;
    if (nextFocus instanceof Node && event.currentTarget instanceof HTMLElement) {
      if (event.currentTarget.contains(nextFocus)) return;
    }
    hasFocusWithin = false;
  }
</script>

<section
  {...rest}
  class={classNames('cinder-carousel', className)}
  role="region"
  aria-roledescription="carousel"
  aria-label={label}
  aria-describedby={description ? descriptionId : undefined}
  tabindex="0"
  onkeydown={onKeydown}
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  onfocusin={() => (hasFocusWithin = true)}
  onfocusout={onFocusOut}
>
  {#if description}
    <p id={descriptionId} class="cinder-carousel__sr-only">{description}</p>
  {/if}
  <p class="cinder-carousel__sr-only" aria-live="polite" aria-atomic="true">{liveAnnouncement}</p>

  <div class="cinder-carousel__viewport">
    {#if slides.length > 0}
      {#each slides as slide, index (slide.id)}
        {#if index === currentIndex}
          <article
            class="cinder-carousel__slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}: ${slide.label}`}
          >
            {#if slide.imageSrc}
              <img
                class="cinder-carousel__image"
                src={slide.imageSrc}
                alt={slide.imageAlt ?? slide.title ?? slide.label}
              />
            {/if}

            {#if slide.href}
              <a href={slide.href}>
                {#if slide.title}
                  <h3 class="cinder-carousel__title">{slide.title}</h3>
                {/if}
                {#if slide.description}
                  <p class="cinder-carousel__description">{slide.description}</p>
                {/if}
              </a>
            {:else}
              {#if slide.title}
                <h3 class="cinder-carousel__title">{slide.title}</h3>
              {/if}
              {#if slide.description}
                <p class="cinder-carousel__description">{slide.description}</p>
              {/if}
            {/if}
          </article>
        {/if}
      {/each}
    {/if}
  </div>

  <div class="cinder-carousel__controls">
    <div class="cinder-carousel__nav">
      <button
        type="button"
        class="cinder-carousel__control"
        onclick={goPrevious}
        disabled={slides.length < 2}
      >
        {controlLabels?.previous ?? 'Previous'}
      </button>
      <button
        type="button"
        class="cinder-carousel__control"
        onclick={goNext}
        disabled={slides.length < 2}
      >
        {controlLabels?.next ?? 'Next'}
      </button>
    </div>

    <div class="cinder-carousel__dots" aria-label={controlLabels?.picker ?? 'Choose slide'}>
      {#each slides as slide, index (slide.id)}
        <button
          type="button"
          class="cinder-carousel__dot"
          aria-label={`Go to ${slide.label}`}
          aria-current={index === currentIndex ? 'true' : undefined}
          onclick={() => goTo(index)}
        ></button>
      {/each}
    </div>
  </div>
</section>
