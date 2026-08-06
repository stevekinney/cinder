import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type CarouselSlideContent = {
  /** Stable key used for keyed rendering and indicator targeting. */
  id: string;
  /** Short visible label announced in the slide picker. */
  label: string;
  /** Optional heading rendered inside the slide body. */
  title?: string;
  /** Optional body text rendered beneath the title. */
  description?: string;
  /** Optional image source rendered at the top of the slide. */
  imageSrc?: string;
  /** Optional alt text; falls back to `title` and then `label` when omitted. */
  imageAlt?: string;
  /** Optional destination URL for the slide body. */
  href?: string;
};

export type CarouselSlide = CarouselSlideContent;

export type CarouselControlLabel = {
  previous?: string;
  next?: string;
  picker?: string;
  pause?: string;
  play?: string;
};

export type CarouselSlideContext = {
  /** Zero-based index of the slide in `slides`. */
  index: number;
  /**
   * Whether this slide is in the currently active (non-inert) range. With
   * `slidesPerView` above `1`, more than one slide can be active at once.
   */
  active: boolean;
};

export type CarouselProps<TSlide extends CarouselSlide = CarouselSlide> = Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'class'
> & {
  /** Ordered list of slides. */
  slides: TSlide[];
  /** Zero-based active index (bindable). */
  activeIndex?: number;
  /** Enables interval-based auto-advance. */
  autoplay?: boolean;
  /** Milliseconds between auto-advance ticks. */
  autoplayInterval?: number;
  /**
   * Wraps navigation past the first/last slide back around. Default `false`:
   * `Previous`/`Next` clamp and disable at the ends instead of wrapping.
   */
  loop?: boolean;
  /** Accessible name for the carousel region. */
  label?: string;
  /** Optional accessible description linked to the region. */
  description?: string;
  /** Override labels for controls and picker. */
  controlLabels?: CarouselControlLabel;
  /**
   * How the slide picker is rendered. `'dots'` below `indicatorLimit`
   * degrades automatically to `'counter'` above it when left unset.
   */
  indicators?: 'dots' | 'counter' | 'none';
  /** Slide count above which the auto-resolved picker switches to a counter. Default `8`. */
  indicatorLimit?: number;
  /**
   * How many slides are visible at once. A fraction (e.g. `1.2`) peeks the
   * next slide. `'auto'` lets each slide size itself via its own CSS.
   * Default `1`. Not supported together with `loop` — `loop` is ignored
   * (with a dev warning) while this is set above `1`.
   */
  slidesPerView?: number | 'auto';
  /** Gap between slides, as a CSS length (e.g. `'1rem'`). Only applied when `slidesPerView` is not `1`. */
  gap?: string;
  /** Snap alignment of the active slide(s) within the viewport. Default `'start'`. */
  align?: 'start' | 'center';
  /** Called after the active slide changes as a result of the carousel's own navigation (never for a parent-driven `activeIndex` update). */
  onSlideChange?: (index: number, slide: TSlide) => void;
  /**
   * Renders inside each slide's `<article>`, replacing the built-in
   * image/title/description/link body. `slides` remains the identity and
   * accessible-labeling source of truth — this only replaces slide content.
   */
  slide?: Snippet<[TSlide, CarouselSlideContext]>;
  /** Additional classes merged onto the root element. */
  class?: string;
};
