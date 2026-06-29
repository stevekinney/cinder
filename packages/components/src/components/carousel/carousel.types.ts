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
  /** Required alt text whenever `imageSrc` is provided. */
  imageAlt?: string;
  /** Optional destination URL for the slide body. */
  href?: string;
};

export type CarouselSlide = CarouselSlideContent;

export type CarouselControlLabel = {
  previous?: string;
  next?: string;
  picker?: string;
};

export type CarouselProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Ordered list of slides. */
  slides: CarouselSlide[];
  /** Zero-based active index (bindable). */
  activeIndex?: number;
  /** Enables interval-based auto-advance. */
  autoplay?: boolean;
  /** Milliseconds between auto-advance ticks. */
  autoplayInterval?: number;
  /** Accessible name for the carousel region. */
  label?: string;
  /** Optional accessible description linked to the region. */
  description?: string;
  /** Override labels for controls and picker. */
  controlLabels?: CarouselControlLabel;
  /** Additional classes merged onto the root element. */
  class?: string;
};
