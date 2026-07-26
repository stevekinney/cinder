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
  import { onDestroy, untrack } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';
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
  let userPaused = $state(false);
  let isInteracting = $state(false);
  let isNativeScrolling = $state(false);
  let viewportElement = $state<HTMLElement | null>(null);
  let programmaticTarget: number | null = null;
  let activePointerId: number | null = null;
  let nativeScrollEndTimer: ReturnType<typeof setTimeout> | null = null;

  const clampedLength = $derived(slides.length);
  const initialSlideId = untrack(
    () => slides[Math.max(0, Math.min(slides.length - 1, activeIndex))]?.id ?? slides[0]?.id,
  );
  const currentIndex = $derived.by(() => {
    if (clampedLength < 1) return 0;
    return Math.max(0, Math.min(clampedLength - 1, activeIndex));
  });
  const slideIdentity = $derived(slides.map((slide) => slide.id).join('\u0000'));

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
      !hasFocusWithin &&
      !isInteracting &&
      !isNativeScrolling &&
      !userPaused,
  );
  const liveAnnouncement = $derived.by(() => {
    if (!slides[currentIndex]) return '';
    return `Slide ${currentIndex + 1} of ${clampedLength}: ${slides[currentIndex].label}`;
  });

  $effect(() => {
    if (!shouldAutoplay) return;
    const timer = setInterval(() => {
      if (clampedLength < 2) return;
      goNext();
    }, autoplayInterval);
    return () => clearInterval(timer);
  });

  function goTo(index: number, immediate = false) {
    if (clampedLength < 1) return;
    const nextIndex = ((index % clampedLength) + clampedLength) % clampedLength;
    const wrapped = index < 0 || index >= clampedLength;
    activeIndex = nextIndex;
    scrollToActiveSlide(immediate || wrapped ? 'auto' : undefined);
  }

  function goPrevious() {
    const nextIndex = (currentIndex - 1 + clampedLength) % clampedLength;
    const physicalDistance = Math.abs(
      initialSlideOrder(nextIndex) - initialSlideOrder(currentIndex),
    );
    goTo(currentIndex - 1, clampedLength > 2 && physicalDistance > 1);
  }

  function goNext() {
    const nextIndex = (currentIndex + 1) % clampedLength;
    const physicalDistance = Math.abs(
      initialSlideOrder(nextIndex) - initialSlideOrder(currentIndex),
    );
    goTo(currentIndex + 1, clampedLength > 2 && physicalDistance > 1);
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

  function initialSlideOrder(index: number): number {
    if (slides.length < 1) return 0;
    const initialSlideIndex = Math.max(
      0,
      slides.findIndex((slide) => slide.id === initialSlideId),
    );
    return (index - initialSlideIndex + slides.length) % slides.length;
  }

  function scrollToActiveSlide(behavior?: ScrollBehavior): void {
    const viewport = viewportElement;
    if (viewport === null) return;
    const slide = viewport?.children[currentIndex];
    if (!(slide instanceof HTMLElement)) return;
    const viewportRect = viewport.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    if (viewportRect.width === 0 || slideRect.width === 0) return;
    if (Math.abs(slideRect.left - viewportRect.left) <= 1) {
      programmaticTarget = null;
      return;
    }
    programmaticTarget = currentIndex;
    if (typeof viewport.scrollTo === 'function') {
      viewport.scrollTo({
        left: slide.offsetLeft,
        behavior: behavior ?? (reducedMotion.current ? 'auto' : 'smooth'),
      });
    } else {
      viewport.scrollLeft = slide.offsetLeft;
    }
  }

  const observeViewport = useResizeObserver((entries) => {
    if (entries[0]?.contentRect.width) scrollToActiveSlide('auto');
  });

  function removePointerEndListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerup', finishPointerInteraction);
    window.removeEventListener('pointercancel', finishPointerInteraction);
  }

  function finishPointerInteraction(event: PointerEvent): void {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    activePointerId = null;
    isInteracting = false;
    removePointerEndListeners();
  }

  function scheduleNativeScrollEnd(): void {
    isNativeScrolling = true;
    if (nativeScrollEndTimer !== null) clearTimeout(nativeScrollEndTimer);
    nativeScrollEndTimer = setTimeout(() => {
      nativeScrollEndTimer = null;
      isNativeScrolling = false;
    }, 100);
  }

  function onPointerDown(event: PointerEvent): void {
    programmaticTarget = null;
    isInteracting = true;
    activePointerId = event.pointerId;
    removePointerEndListeners();
    window.addEventListener('pointerup', finishPointerInteraction);
    window.addEventListener('pointercancel', finishPointerInteraction);
  }

  function onWheel(): void {
    programmaticTarget = null;
  }

  onDestroy(() => {
    removePointerEndListeners();
    if (nativeScrollEndTimer !== null) clearTimeout(nativeScrollEndTimer);
  });

  function onViewportScroll(): void {
    const viewport = viewportElement;
    if (clampedLength < 2 || viewport === null) return;
    scheduleNativeScrollEnd();
    const viewportLeft = viewport.getBoundingClientRect().left;
    const nextIndex = [...viewport.children].reduce((nearestIndex, slide, index) => {
      const nearest = viewport.children[nearestIndex];
      if (!nearest) return index;
      return Math.abs(slide.getBoundingClientRect().left - viewportLeft) <
        Math.abs(nearest.getBoundingClientRect().left - viewportLeft)
        ? index
        : nearestIndex;
    }, 0);
    if (programmaticTarget !== null) {
      if (nextIndex === programmaticTarget) programmaticTarget = null;
      return;
    }
    if (nextIndex !== currentIndex && nextIndex >= 0 && nextIndex < clampedLength) {
      activeIndex = nextIndex;
    }
  }

  $effect(() => {
    if (viewportElement === null || clampedLength < 1) return;
    if (isInteracting || isNativeScrolling) return;
    slideIdentity;
    scrollToActiveSlide();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section
  {...rest}
  class={classNames('cinder-carousel', className)}
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
  <p
    class="cinder-carousel__sr-only"
    aria-live={shouldAutoplay ? 'off' : 'polite'}
    aria-atomic="true"
  >
    {liveAnnouncement}
  </p>

  <div
    class="cinder-carousel__viewport"
    role="group"
    aria-label={`${label} slides`}
    bind:this={viewportElement}
    {@attach observeViewport}
    onscroll={onViewportScroll}
    onpointerdown={onPointerDown}
    onwheel={onWheel}
  >
    {#if slides.length > 0}
      {#each slides as slide, index (slide.id)}
        <article
          class="cinder-carousel__slide"
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${slides.length}: ${slide.label}`}
          aria-hidden={index === currentIndex ? undefined : 'true'}
          inert={index !== currentIndex}
          style:order={initialSlideOrder(index)}
        >
          {#if slide.href}
            <a class="cinder-carousel__link" href={slide.href}>
              {#if slide.imageSrc}
                <img
                  class="cinder-carousel__image"
                  src={slide.imageSrc}
                  alt={slide.imageAlt ?? slide.title ?? slide.label}
                  loading={index === currentIndex ? 'eager' : 'lazy'}
                />
              {/if}
              {#if slide.title}
                <h3 class="cinder-carousel__title">{slide.title}</h3>
              {/if}
              {#if slide.description}
                <p class="cinder-carousel__description">{slide.description}</p>
              {/if}
              {#if !slide.imageSrc && !slide.title && !slide.description}
                <p class="cinder-carousel__description">{slide.label}</p>
              {/if}
            </a>
          {:else}
            {#if slide.imageSrc}
              <img
                class="cinder-carousel__image"
                src={slide.imageSrc}
                alt={slide.imageAlt ?? slide.title ?? slide.label}
                loading={index === currentIndex ? 'eager' : 'lazy'}
              />
            {/if}
            {#if slide.title}
              <h3 class="cinder-carousel__title">{slide.title}</h3>
            {/if}
            {#if slide.description}
              <p class="cinder-carousel__description">{slide.description}</p>
            {/if}
            {#if !slide.imageSrc && !slide.title && !slide.description}
              <p class="cinder-carousel__description">{slide.label}</p>
            {/if}
          {/if}
        </article>
      {/each}
    {/if}
  </div>

  <div class="cinder-carousel__controls" role="group" aria-label={`${label} controls`}>
    <div class="cinder-carousel__nav" role="group" aria-label={`${label} navigation`}>
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

    {#if autoplay && !reducedMotion.current}
      <button
        type="button"
        class="cinder-carousel__control cinder-carousel__control--pause"
        aria-pressed={userPaused}
        onclick={() => (userPaused = !userPaused)}
      >
        {userPaused ? (controlLabels?.play ?? 'Play') : (controlLabels?.pause ?? 'Pause')}
      </button>
    {/if}

    <div
      class="cinder-carousel__dots"
      role="group"
      aria-label={controlLabels?.picker ?? 'Choose slide'}
    >
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
