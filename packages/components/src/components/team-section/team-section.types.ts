import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

/** @schemaObject */
export type TeamSectionMember = {
  /** Team member name. */
  name: string;
  /** Team member role. */
  role: string;
  /** Optional short bio. */
  bio?: string;
  /** Optional avatar image source. */
  avatarSrc?: string;
  /** Optional profile link destination. */
  href?: string;
};

/** Props for the TeamSection component. */
export type TeamSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading text. */
  title?: string;
  /** Optional section description text. */
  description?: string;
  /** Team members to render. */
  members: TeamSectionMember[];
  /** Grid column count. @default 3 */
  columns?: 2 | 3 | 4;
  /** Whether to render a compact AvatarGroup summary above the grid. @default false */
  showAvatarGroup?: boolean;
  /** Label for the AvatarGroup summary. @default "Team members" */
  avatarGroupLabel?: string;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-team-section`. */
  class?: string;
};

export interface TeamSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading text. */
  title?: string;
  /** Optional section description text. */
  description?: string;
  /** Team members to render. */
  members: TeamSectionMember[];
  /** Grid column count. @default 3 */
  columns?: 2 | 3 | 4;
  /** Whether to render a compact AvatarGroup summary above the grid. @default false */
  showAvatarGroup?: boolean;
  /** Label for the AvatarGroup summary. @default "Team members" */
  avatarGroupLabel?: string;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-team-section`. */
  class?: string;
}
