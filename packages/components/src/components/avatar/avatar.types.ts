import type { HTMLAttributes } from 'svelte/elements';
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'square';
/**
 * Props for the Avatar component.
 *
 * Renders an image when `src` is supplied; falls back to initials computed
 * from `name` when the image is missing or fails to load. The `name` prop
 * is also used for the accessible name when no `alt` is supplied.
 *
 * When neither `src` nor `name` is provided, a decorative placeholder
 * (`aria-hidden`) renders and the avatar has no accessible name. If such a
 * placeholder-only avatar still needs to be announced (e.g. an "unassigned"
 * slot), supply an `aria-label` via the forwarded rest props — it lands on
 * the root element and names the avatar.
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
