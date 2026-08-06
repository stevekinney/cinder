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
    CarouselSlideContext,
  } from './carousel.types.ts';
</script>

<script lang="ts" generics="TSlide extends CarouselSlide = CarouselSlide">
  import { onDestroy, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

  import { observeTextDirection } from '../../_internal/text-direction.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { useDragScroll } from '../../utilities/use-drag-scroll.svelte.ts';
  import { useFinePointer } from '../../utilities/use-fine-pointer.svelte.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';
  import type { CarouselProps, CarouselSlide } from './carousel.types.ts';

  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const descriptionId = $props.id();

  let {
    slides,
    activeIndex = $bindable(0),
    autoplay = false,
    autoplayInterval = 5000,
    loop = false,
    label = 'Carousel',
    description,
    controlLabels,
    indicators,
    indicatorLimit = 8,
    slidesPerView = 1,
    gap,
    align = 'start',
    onSlideChange,
    slide: slideSnippet,
    class: className,
    onkeydown: consumerOnKeydown,
    onmouseenter: consumerOnMouseEnter,
    onmouseleave: consumerOnMouseLeave,
    onfocusin: consumerOnFocusIn,
    onfocusout: consumerOnFocusOut,
    ...rest
  }: CarouselProps<TSlide> = $props();

  // Replaces six separately-coordinated flags (isInteracting, isNativeScrolling,
  // isAutoplayTransitioning, programmaticTarget, deferredExternalIndex,
  // internalActiveIndexUpdate) with one mutually-exclusive state. 'user' covers
  // touch/wheel input that's actually moving the track (not merely a pointer
  // held down); 'programmatic' covers a scroll this component initiated itself.
  type CarouselMotionSource = 'touch' | 'wheel' | 'drag';
  type CarouselProgrammaticSource = 'keyboard' | 'control' | 'autoplay' | 'external';
  type CarouselMotion =
    | { kind: 'idle' }
    | { kind: 'user'; source: CarouselMotionSource }
    | { kind: 'programmatic'; target: number; source: CarouselProgrammaticSource };

  let isHovered = $state(false);
  let hasFocusWithin = $state(false);
  let userPaused = $state(false);
  let motion = $state<CarouselMotion>({ kind: 'idle' });
  // `motion = {...}` always writes a fresh object, so an unconditional
  // reassignment defeats Svelte's same-value skip (unlike the primitive
  // flags this replaces) and can re-trigger an effect that both reads and
  // writes it every run. Only assign when the value actually changed.
  function setMotion(next: CarouselMotion): void {
    const unchanged =
      motion.kind === next.kind &&
      (motion.kind !== 'programmatic' ||
        (next.kind === 'programmatic' &&
          motion.target === next.target &&
          motion.source === next.source)) &&
      (motion.kind !== 'user' || (next.kind === 'user' && motion.source === next.source));
    if (!unchanged) motion = next;
  }
  let settledIndex = $state(
    untrack(() => (slides.length < 1 ? 0 : Math.max(0, Math.min(slides.length - 1, activeIndex)))),
  );
  // Mirrors the nearest slide on every scroll frame during 'user' motion, for
  // cosmetic dot/aria-current styling only. `activeIndex` itself only writes
  // back once the gesture settles — see `handleSettle`.
  let visualIndex = $state(untrack(() => settledIndex));
  let viewportElement = $state<HTMLElement | null>(null);
  const activePointerIds = new SvelteSet<number>();
  let nativeScrollEndTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollFrame: number | null = null;
  let cachedViewportInlineSize = 0;

  const clampedLength = $derived(slides.length);
  const initialSlideId = untrack(
    () => slides[Math.max(0, Math.min(slides.length - 1, activeIndex))]?.id ?? slides[0]?.id,
  );
  const initialSlideIndex = $derived(
    slides.length < 1
      ? 0
      : Math.max(
          0,
          slides.findIndex((slide) => slide.id === initialSlideId),
        ),
  );
  const currentIndex = $derived.by(() => {
    if (clampedLength < 1) return 0;
    return Math.max(0, Math.min(clampedLength - 1, activeIndex));
  });
  // Snapshotted at the moment a 'user' gesture begins; compared at settle to
  // detect a parent-driven `activeIndex` change that landed mid-gesture, which
  // wins over wherever the finger physically settled (see `handleSettle`).
  let observedActiveIndex = currentIndex;
  const displayIndex = $derived(motion.kind === 'user' ? visualIndex : currentIndex);
  const slideIdentity = $derived(slides.map((slide) => slide.id).join('\u0000'));
  let previousSlideIdentity = untrack(() => slideIdentity);

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
      activePointerIds.size === 0 &&
      motion.kind !== 'user' &&
      !userPaused,
  );
  // `slidesPerView` above 1 makes more than one slide active/interactive at
  // once. The range is index-derived (currentIndex .. currentIndex + n - 1),
  // not measured from real layout — `'auto'` can't be sized in advance, so it
  // behaves like a range of 1 (a single primary slide, e.g. for peek layouts).
  const isMultiView = $derived(slidesPerView !== 1);
  const visibleRangeSize = $derived(
    typeof slidesPerView === 'number' ? Math.max(1, Math.ceil(slidesPerView)) : 1,
  );
  const rangeEnd = $derived(Math.min(clampedLength - 1, currentIndex + visibleRangeSize - 1));
  function isSlideInRange(index: number): boolean {
    return isInRangeOfAnchor(index, currentIndex);
  }
  // slidesPerView > 1 rotates a partial-width slide across the wrap boundary,
  // leaving a visible gap — unsupported in v1 (see the devWarn effect below).
  const effectiveLoop = $derived(loop && !isMultiView);
  const resolvedSlideSize = $derived.by(() => {
    if (!isMultiView) return undefined;
    if (slidesPerView === 'auto') return 'auto';
    return `calc((100% - (${slidesPerView} - 1) * var(--cinder-carousel-gap, var(--cinder-space-3))) / ${slidesPerView})`;
  });

  $effect(() => {
    if (loop && isMultiView) {
      devWarn(
        '[cinder/Carousel] `loop` is not supported with `slidesPerView` greater than 1 yet; `loop` is being ignored.',
      );
    }
  });

  const liveAnnouncement = $derived.by(() => {
    if (!slides[currentIndex]) return '';
    if (rangeEnd > currentIndex) {
      return `Slides ${currentIndex + 1}–${rangeEnd + 1} of ${clampedLength}`;
    }
    return `Slide ${currentIndex + 1} of ${clampedLength}: ${slides[currentIndex].label}`;
  });
  const isAtStart = $derived(!effectiveLoop && currentIndex === 0);
  const isAtEnd = $derived(!effectiveLoop && rangeEnd === clampedLength - 1);
  const resolvedIndicators = $derived(
    indicators ?? (clampedLength > indicatorLimit ? 'counter' : 'dots'),
  );

  $effect(() => {
    if (!shouldAutoplay) return;
    const timer = setInterval(() => {
      if (clampedLength < 2) return;
      goNext('autoplay');
    }, autoplayInterval);
    return () => clearInterval(timer);
  });

  function goTo(index: number, immediate = false, source: CarouselProgrammaticSource = 'control') {
    if (clampedLength < 1) return;
    const nextIndex = effectiveLoop
      ? ((index % clampedLength) + clampedLength) % clampedLength
      : Math.max(0, Math.min(clampedLength - 1, index));
    if (motion.kind === 'programmatic' && viewportElement !== null) {
      settledIndex = nearestVisibleSlideIndex(viewportElement);
    }
    const changed = nextIndex !== activeIndex;
    activeIndex = nextIndex;
    scrollToActiveSlide(immediate ? 'auto' : undefined, source);
    if (changed) {
      const slide = slides[nextIndex];
      if (slide) onSlideChange?.(nextIndex, slide);
    }
  }

  function goPrevious(source: CarouselProgrammaticSource = 'control') {
    const nextIndex = (currentIndex - 1 + clampedLength) % clampedLength;
    const physicalDistance = Math.abs(
      initialSlideOrder(nextIndex) - initialSlideOrder(currentIndex),
    );
    goTo(currentIndex - 1, clampedLength > 2 && physicalDistance > 1, source);
  }

  function goNext(source: CarouselProgrammaticSource = 'control') {
    const nextIndex = (currentIndex + 1) % clampedLength;
    const physicalDistance = Math.abs(
      initialSlideOrder(nextIndex) - initialSlideOrder(currentIndex),
    );
    goTo(currentIndex + 1, clampedLength > 2 && physicalDistance > 1, source);
  }

  function onKeydown(event: KeyboardEvent) {
    consumerOnKeydown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLElement });
    if (event.defaultPrevented) return;
    if (clampedLength < 2) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCarouselRoot(event);
      goPrevious('keyboard');
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusCarouselRoot(event);
      goNext('keyboard');
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusCarouselRoot(event);
      goTo(0, undefined, 'keyboard');
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusCarouselRoot(event);
      goTo(clampedLength - 1, undefined, 'keyboard');
    }
  }

  function focusCarouselRoot(event: KeyboardEvent): void {
    const root = event.currentTarget;
    const target = event.target;
    const activeSlide = viewportElement?.children[currentIndex];
    if (
      root instanceof HTMLElement &&
      target !== root &&
      target instanceof Node &&
      root.contains(target) &&
      activeSlide instanceof HTMLElement &&
      activeSlide.contains(target)
    ) {
      root.focus();
    }
  }

  function onMouseEnter(event: MouseEvent) {
    consumerOnMouseEnter?.(event as MouseEvent & { currentTarget: EventTarget & HTMLElement });
    isHovered = true;
  }

  function onMouseLeave(event: MouseEvent) {
    consumerOnMouseLeave?.(event as MouseEvent & { currentTarget: EventTarget & HTMLElement });
    isHovered = false;
  }

  function onFocusIn(event: FocusEvent) {
    consumerOnFocusIn?.(event as FocusEvent & { currentTarget: EventTarget & HTMLElement });
    hasFocusWithin = true;
  }

  function onFocusOut(event: FocusEvent) {
    consumerOnFocusOut?.(event as FocusEvent & { currentTarget: EventTarget & HTMLElement });
    const nextFocus = event.relatedTarget;
    if (nextFocus instanceof Node && event.currentTarget instanceof HTMLElement) {
      if (event.currentTarget.contains(nextFocus)) return;
    }
    hasFocusWithin = false;
  }

  function initialSlideOrder(index: number): number {
    if (slides.length < 1) return 0;
    return (index - initialSlideIndex + slides.length) % slides.length;
  }

  function isInRangeOfAnchor(index: number, anchor: number): boolean {
    const end = Math.min(clampedLength - 1, anchor + visibleRangeSize - 1);
    return index >= anchor && index <= end;
  }

  function isInteractionLayoutSlide(index: number): boolean {
    if (isInRangeOfAnchor(index, currentIndex) || isInRangeOfAnchor(index, settledIndex))
      return true;
    // Widen the layout window only once a pan or programmatic transition is
    // actually moving the track (motion.kind !== 'idle'), not merely because
    // a touch/pen pointer is down. A tap that never causes a scroll event —
    // including tapping the active slide's own link — must not pop a taller
    // neighbor's height in and back out.
    if (motion.kind === 'idle') return false;
    const currentOrder = initialSlideOrder(currentIndex);
    const settledOrder = initialSlideOrder(settledIndex);
    const lowerBound = Math.max(0, Math.min(currentOrder, settledOrder) - 1);
    const upperBound = Math.min(clampedLength - 1, Math.max(currentOrder, settledOrder) + 1);
    const slideOrder = initialSlideOrder(index);
    return slideOrder >= lowerBound && slideOrder <= upperBound;
  }

  function slideAnchor(rect: { left: number; width: number }): number {
    return align === 'center' ? rect.left + rect.width / 2 : rect.left;
  }

  function scrollToActiveSlide(
    behavior?: ScrollBehavior,
    source: CarouselProgrammaticSource = 'external',
  ): void {
    const viewport = viewportElement;
    if (viewport === null) return;
    const slide = viewport?.children[currentIndex];
    if (!(slide instanceof HTMLElement)) return;
    const viewportRect = viewport.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    if (viewportRect.width === 0 || slideRect.width === 0) return;
    if (Math.abs(slideAnchor(slideRect) - slideAnchor(viewportRect)) <= 1) {
      setMotion({ kind: 'idle' });
      settledIndex = currentIndex;
      return;
    }
    setMotion({ kind: 'programmatic', target: currentIndex, source });
    const direction =
      typeof window !== 'undefined' ? window.getComputedStyle(viewport).direction : 'ltr';
    // RTL is left at its existing left-edge destination — no test coverage to
    // validate a centered RTL destination, matching the snapport-math scoping.
    const centeringOffset =
      align === 'center' && direction !== 'rtl' ? (viewportRect.width - slideRect.width) / 2 : 0;
    const destination =
      direction === 'rtl'
        ? viewport.scrollLeft + slideRect.left - viewportRect.left
        : slide.offsetLeft - centeringOffset;
    if (typeof viewport.scrollTo === 'function') {
      viewport.scrollTo({
        left: destination,
        behavior: behavior ?? (reducedMotion.current ? 'auto' : 'smooth'),
      });
    } else {
      viewport.scrollLeft = destination;
    }
  }

  function nearestVisibleSlideIndex(viewport: HTMLElement): number {
    // The comparison point is the snapport's leading edge (or, with
    // `align: 'center'`, the viewport's center) — not the border-box edge —
    // since a consumer-set `scroll-padding-inline-start` shrinks where a
    // slide reads as "nearest". RTL stays at the border-box edge — no
    // existing consumer sets scroll-padding, and there's no test coverage to
    // validate a physical-side mapping for it yet.
    const viewportRect = viewport.getBoundingClientRect();
    const computed = typeof window !== 'undefined' ? window.getComputedStyle(viewport) : null;
    const scrollPaddingInlineStart = computed
      ? Number.parseFloat(computed.scrollPaddingInlineStart)
      : Number.NaN;
    const referencePoint =
      align === 'center'
        ? viewportRect.left + viewportRect.width / 2
        : computed?.direction !== 'rtl' && Number.isFinite(scrollPaddingInlineStart)
          ? viewportRect.left + scrollPaddingInlineStart
          : viewportRect.left;
    return [...viewport.children].reduce((nearestIndex, slide, index) => {
      const nearest = viewport.children[nearestIndex];
      if (!nearest) return index;
      const slidePoint = slideAnchor(slide.getBoundingClientRect());
      const nearestPoint = slideAnchor(nearest.getBoundingClientRect());
      return Math.abs(slidePoint - referencePoint) < Math.abs(nearestPoint - referencePoint)
        ? index
        : nearestIndex;
    }, 0);
  }

  const observeViewport = useResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const borderBoxSize = Array.isArray(entry.borderBoxSize)
      ? entry.borderBoxSize[0]
      : entry.borderBoxSize;
    const inlineSize = borderBoxSize?.inlineSize ?? entry.contentRect.width;
    if (inlineSize <= 0) {
      cachedViewportInlineSize = inlineSize;
      return;
    }
    if (inlineSize === cachedViewportInlineSize) return;
    cachedViewportInlineSize = inlineSize;
    if (activePointerIds.size === 0 && motion.kind !== 'user') {
      scrollToActiveSlide('auto');
    }
  });

  function getSlideSnapPositions(): number[] {
    const viewport = viewportElement;
    if (viewport === null) return [];
    return [...viewport.children].map((child) => {
      const slide = child as HTMLElement;
      if (align !== 'center') return slide.offsetLeft;
      return slide.offsetLeft - (viewport.clientWidth - slide.offsetWidth) / 2;
    });
  }

  // Fine-pointer (mouse) drag-to-scroll. Touch/pen are unaffected — they
  // already pan the native scroller directly (see `onPointerDown` below).
  // Reduced motion disables the engine entirely rather than just shortening
  // durations: momentum and rubber-band are exactly the inertial motion that
  // preference is about, and native scrolling with CSS snap stays fully
  // usable without it.
  const dragScroll = useDragScroll({
    enabled: () => finePointer.current && !reducedMotion.current,
    getSnapPositions: getSlideSnapPositions,
  });

  function removePointerEndListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerup', finishPointerInteraction);
    window.removeEventListener('pointercancel', finishPointerInteraction);
  }

  function finishPointerInteraction(event: PointerEvent): void {
    if (event.type === 'pointercancel') {
      // A cancelled gesture still needs a settle grace period before autoplay
      // resumes, even if no scroll event ever fired.
      if (motion.kind !== 'user') observedActiveIndex = currentIndex;
      setMotion({ kind: 'user', source: 'touch' });
      scheduleNativeScrollEnd();
    }
    activePointerIds.delete(event.pointerId);
    if (activePointerIds.size > 0) return;
    removePointerEndListeners();
    if (motion.kind === 'user') scheduleNativeScrollEnd();
  }

  function handleSettle(): void {
    if (nativeScrollEndTimer !== null) {
      clearTimeout(nativeScrollEndTimer);
      nativeScrollEndTimer = null;
    }
    if (activePointerIds.size > 0) return;
    if (motion.kind !== 'user') return;
    setMotion({ kind: 'idle' });
    if (viewportElement === null) return;

    if (currentIndex !== observedActiveIndex) {
      // An external `activeIndex` update landed mid-gesture; it wins over
      // wherever the finger physically settled, since it reflects a more
      // recent, deliberate change than the in-flight drag.
      settledIndex = currentIndex;
      visualIndex = currentIndex;
      scrollToActiveSlide('auto');
      return;
    }

    const nextIndex = nearestVisibleSlideIndex(viewportElement);
    settledIndex = nextIndex;
    visualIndex = nextIndex;
    if (nextIndex !== currentIndex && nextIndex >= 0 && nextIndex < clampedLength) {
      transferFocusFromOutgoingSlide();
      activeIndex = nextIndex;
      const slide = slides[nextIndex];
      if (slide) onSlideChange?.(nextIndex, slide);
    }
  }

  // Tier 2 (PLATFORM-POLICY.md): native `scrollend` owns settle detection when
  // the viewport supports it (wired below); this debounce is the required
  // fallback for environments without it (and stays the only path in tests,
  // since happy-dom has no `onscrollend`).
  function scheduleNativeScrollEnd(): void {
    if (viewportElement !== null && 'onscrollend' in viewportElement) return;
    if (nativeScrollEndTimer !== null) clearTimeout(nativeScrollEndTimer);
    nativeScrollEndTimer = setTimeout(handleSettle, 100);
  }

  function onPointerDown(event: PointerEvent): void {
    // Only touch and pen pointers can pan the native scroller. A mouse press
    // on slide content (e.g. a link) has no drag recognizer behind it, so
    // treating it as an interaction would needlessly widen the
    // interaction-layout window and jump the viewport to a neighbor's
    // height for the duration of an ordinary click.
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;

    // A pointer taking over always cancels any in-flight programmatic scroll.
    if (motion.kind === 'programmatic') setMotion({ kind: 'idle' });
    activePointerIds.add(event.pointerId);
    removePointerEndListeners();
    window.addEventListener('pointerup', finishPointerInteraction);
    window.addEventListener('pointercancel', finishPointerInteraction);
  }

  function onWheel(event: WheelEvent): void {
    const isHorizontallyDominant = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const isShiftScroll = event.shiftKey && Math.abs(event.deltaY) > 0;
    if (isHorizontallyDominant || isShiftScroll) {
      if (motion.kind !== 'user') observedActiveIndex = currentIndex;
      setMotion({ kind: 'user', source: 'wheel' });
      scheduleNativeScrollEnd();
    }
  }

  function onWindowBlur(): void {
    const hadPointers = activePointerIds.size > 0;
    const wasUserMotion = motion.kind === 'user';
    activePointerIds.clear();
    removePointerEndListeners();
    if (wasUserMotion) scheduleNativeScrollEnd();
    // Only relinquish programmatic/autoplay ownership if blur is actually
    // ending a tracked pointer interaction. An unrelated blur (e.g. focusing
    // browser chrome while a dot or autoplay transition is animating) must
    // not cancel that in-flight destination, or a subsequent intermediate
    // scroll event gets misread as native input and overwrites activeIndex.
    if (hadPointers && motion.kind === 'programmatic') {
      setMotion({ kind: 'idle' });
    }
  }

  $effect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('blur', onWindowBlur);
    return () => window.removeEventListener('blur', onWindowBlur);
  });

  onDestroy(() => {
    removePointerEndListeners();
    if (nativeScrollEndTimer !== null) clearTimeout(nativeScrollEndTimer);
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
  });

  function onViewportScroll(): void {
    const viewport = viewportElement;
    if (clampedLength < 2 || viewport === null) return;

    if (motion.kind === 'programmatic') {
      // Detect early arrival at the destination — the layout window and
      // motion state can clear as soon as the geometry shows we're there,
      // without waiting for the settle debounce/scrollend.
      if (scrollFrame !== null) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        const nextIndex = nearestVisibleSlideIndex(viewport);
        visualIndex = nextIndex;
        if (motion.kind === 'programmatic' && nextIndex === motion.target) {
          settledIndex = nextIndex;
          setMotion({ kind: 'idle' });
        }
      });
      return;
    }

    if (motion.kind !== 'user') {
      // A native `scroll` event carries no pointer-type info of its own —
      // `useDragScroll` flags an active mouse drag on the node it's attached
      // to, so that's the one case distinguishable from a touch pan here.
      const source: CarouselMotionSource = viewport.hasAttribute('data-cinder-dragging')
        ? 'drag'
        : 'touch';
      setMotion({ kind: 'user', source });
      observedActiveIndex = currentIndex;
    }
    scheduleNativeScrollEnd();
    if (scrollFrame !== null) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      visualIndex = nearestVisibleSlideIndex(viewport);
    });
  }

  function transferFocusFromOutgoingSlide(): void {
    if (typeof document === 'undefined') return;
    const activeElement = document.activeElement;
    const outgoingSlide = viewportElement?.children[currentIndex];
    if (
      activeElement instanceof Node &&
      outgoingSlide instanceof HTMLElement &&
      outgoingSlide.contains(activeElement)
    ) {
      viewportElement?.focus();
    }
  }

  $effect(() => {
    if (viewportElement === null || clampedLength < 1) return;
    if (motion.kind === 'user' || activePointerIds.size > 0) return;
    const identityChanged = slideIdentity !== previousSlideIdentity;
    previousSlideIdentity = slideIdentity;
    if (identityChanged) {
      // The slide at `settledIndex` may no longer be the slide that was
      // physically visible before the reorder, so re-anchor from the DOM
      // instead of trusting the stale numeric index, and jump immediately
      // rather than animating from a now-meaningless "settled" position.
      settledIndex = nearestVisibleSlideIndex(viewportElement);
      scrollToActiveSlide('auto');
      return;
    }
    scrollToActiveSlide();
  });

  $effect(() => {
    const viewport = viewportElement;
    if (viewport === null || !('onscrollend' in viewport)) return;
    viewport.addEventListener('scrollend', handleSettle);
    return () => viewport.removeEventListener('scrollend', handleSettle);
  });

  $effect(() => {
    const viewport = viewportElement;
    if (viewport === null) return;
    return observeTextDirection(viewport, () => {
      if (motion.kind === 'user' || activePointerIds.size > 0) return;
      scrollToActiveSlide('auto');
    });
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
  data-cinder-align={align === 'center' ? 'center' : undefined}
  style:--cinder-carousel-slide-size={resolvedSlideSize}
  style:--cinder-carousel-gap={isMultiView ? gap : undefined}
  onkeydown={onKeydown}
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
  onfocusin={onFocusIn}
  onfocusout={onFocusOut}
>
  {#if description}
    <p id={descriptionId} class="cinder-carousel__sr-only">{description}</p>
  {/if}
  <p
    class="cinder-carousel__sr-only"
    aria-live={shouldAutoplay || (motion.kind === 'programmatic' && motion.source === 'autoplay')
      ? 'off'
      : 'polite'}
    aria-atomic="true"
  >
    {liveAnnouncement}
  </p>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="cinder-carousel__viewport"
    role="group"
    aria-label={`${label} slides`}
    tabindex="0"
    bind:this={viewportElement}
    style:gap={isMultiView ? 'var(--cinder-carousel-gap, var(--cinder-space-3))' : undefined}
    {@attach observeViewport}
    {@attach dragScroll}
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
          aria-hidden={isSlideInRange(index) ? undefined : 'true'}
          inert={!isSlideInRange(index)}
          data-cinder-collapsed={!isInteractionLayoutSlide(index) ? '' : undefined}
          style:order={initialSlideOrder(index)}
        >
          {#if slideSnippet}
            {@render slideSnippet(slide, { index, active: index === currentIndex })}
          {:else if slide.href}
            <a class="cinder-carousel__link" href={slide.href}>
              {#if slide.imageSrc}
                <img
                  class="cinder-carousel__image"
                  src={slide.imageSrc}
                  alt={slide.imageAlt ?? slide.title ?? slide.label}
                  loading={isSlideInRange(index) ? 'eager' : 'lazy'}
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
                loading={isSlideInRange(index) ? 'eager' : 'lazy'}
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
        onclick={() => goPrevious('control')}
        disabled={slides.length < 2 || isAtStart}
      >
        {controlLabels?.previous ?? 'Previous'}
      </button>
      <button
        type="button"
        class="cinder-carousel__control"
        onclick={() => goNext('control')}
        disabled={slides.length < 2 || isAtEnd}
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

    {#if resolvedIndicators === 'dots'}
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
            aria-current={index === displayIndex ? 'true' : undefined}
            onclick={() => goTo(index, undefined, 'control')}
          ></button>
        {/each}
      </div>
    {:else if resolvedIndicators === 'counter'}
      <div class="cinder-carousel__counter" aria-hidden="true">
        {displayIndex + 1} / {clampedLength}
      </div>
    {/if}
  </div>
</section>
