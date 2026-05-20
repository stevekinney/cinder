import type { Snippet } from 'svelte';
import type { HTMLImgAttributes } from 'svelte/elements';
/**
 * Props for the Image component.
 *
 * A general-purpose `<img>` wrapper with `loading="lazy"` and `decoding="async"`
 * defaults, an aspect-ratio container, a blur-up placeholder for progressive
 * loading, and a fallback snippet rendered when the image errors. Distinct
 * from `Avatar`: this component does not render initials and has no concept
 * of a person's identity.
 *
 * `alt` is required with no default — consumers must make the
 * decorative-vs-meaningful choice explicitly. Pass `alt=""` for decorative
 * images.
 *
 * For above-the-fold hero images, override `loading="eager"` and pass
 * `fetchpriority="high"` (forwarded via rest props) so the browser
 * prioritizes the Largest Contentful Paint resource.
 */
export type ImageProps = Omit<
  HTMLImgAttributes,
  'alt' | 'src' | 'width' | 'height' | 'loading' | 'decoding' | 'onload' | 'onerror'
> & {
  /** Image source URL. */
  src: string;
  /**
   * Alternative text. Required with no default — pass `alt=""` explicitly for
   * decorative images so the choice is intentional, not silent.
   */
  alt: string;
  /** Native pixel width. */
  width?: number;
  /** Native pixel height. */
  height?: number;
  /**
   * CSS aspect-ratio applied to the wrapper (e.g. `'16 / 9'`) so layout is
   * stable while the image loads.
   */
  ratio?: string;
  /** Loading strategy. Default `lazy`. Override to `eager` for above-the-fold images. */
  loading?: 'lazy' | 'eager';
  /** Decoding hint. Default `async`. */
  decoding?: 'async' | 'sync' | 'auto';
  /**
   * Low-resolution image source (typically a base64 data URI) shown as a
   * pixelated background while the main image loads. Fades out once the
   * `<img>` fires `load`.
   */
  placeholder?: string;
  /** Additional class names merged with `.cinder-image`. */
  class?: string;
  /** Rendered in place of the `<img>` when it fails to load. */
  fallback?: Snippet;
  /** Forwarded after internal state updates. */
  onload?: (event: Event) => void;
  /** Forwarded after internal state updates. */
  onerror?: (event: Event) => void;
};
