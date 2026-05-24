import type { HTMLAttributes } from 'svelte/elements';
import type { AvatarShape, AvatarSize } from '../avatar/avatar.types.ts';

type AvatarGroupRootAttributes = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

export type AvatarGroupZOrder = 'first-on-top' | 'last-on-top';

/**
 * @schemaObject
 */
export type AvatarGroupItem = {
  /** Stable identifier recommended for dynamic collaborator lists. */
  id?: string;
  /** Display name used for initials, tooltip text, and accessible naming. */
  name: string;
  /** Optional avatar image source. */
  src?: string;
};

export type AvatarGroupProps = AvatarGroupRootAttributes & {
  /** Collaborators to render in the stack. */
  avatars: AvatarGroupItem[];
  /**
   * Maximum visible avatars before overflow.
   * @default 5
   */
  maxVisible?: number;
  /**
   * Positive CSS length for the amount each item overlaps its predecessor.
   * @default "0.75rem"
   */
  overlap?: string;
  /**
   * Stacking order for visible avatars.
   * @default "last-on-top"
   */
  zOrder?: AvatarGroupZOrder;
  /**
   * Size token forwarded to each visible Avatar.
   * @default "md"
   */
  size?: AvatarSize;
  /**
   * Shape forwarded to each visible Avatar.
   * @default "circle"
   */
  shape?: AvatarShape;
  /** Accessible label for the overflow indicator. */
  overflowLabel?: string;
  /** Additional class names merged with `.cinder-avatar-group`. */
  class?: string;
};

/** Cinder-specific props for the AvatarGroup component, used by the schema generator. */
export interface AvatarGroupSchemaProps {
  /** Collaborators to render in the stack. */
  avatars: AvatarGroupItem[];
  /**
   * Maximum visible avatars before overflow.
   * @default 5
   */
  maxVisible?: number;
  /**
   * Positive CSS length for the amount each item overlaps its predecessor.
   * @default "0.75rem"
   */
  overlap?: string;
  /**
   * Stacking order for visible avatars.
   * @default "last-on-top"
   */
  zOrder?: AvatarGroupZOrder;
  /**
   * Size token forwarded to each visible Avatar.
   * @default "md"
   */
  size?: AvatarSize;
  /**
   * Shape forwarded to each visible Avatar.
   * @default "circle"
   */
  shape?: AvatarShape;
  /** Accessible label for the overflow indicator. */
  overflowLabel?: string;
  /** Additional class names merged with `.cinder-avatar-group`. */
  class?: string;
}
