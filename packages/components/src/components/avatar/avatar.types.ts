import type { HTMLAttributes } from 'svelte/elements';
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'square';
/**
 * Props for the Avatar component.
 *
 * Renders an image when `src` is supplied; falls back to initials computed
 * from `name` when the image is missing or fails to load. The `name` prop
 * is also used for the accessible name when no `alt` is supplied.
 */
export type AvatarProps = HTMLAttributes<HTMLSpanElement> & {
  /** Image source. When omitted, the initials fallback renders. */
  src?: string;
  /** Alternative text for the image. Defaults to `name` when present. */
  alt?: string;
  /**
   * Display name used to compute initials when no image is available.
   * Also used as the default `alt` for the image.
   */
  name?: string;
  /** Size token. Default `md`. */
  size?: AvatarSize;
  /** Shape. Default `circle`. */
  shape?: AvatarShape;
  /** Additional class names merged with `.cinder-avatar`. */
  class?: string;
};
