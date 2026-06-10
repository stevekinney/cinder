import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** An action to include in the share card. */
export type ShareCardAction = {
  /** Unique key for this action. */
  key: string;
  /** Visible label for the action button. */
  label: string;
  /** Text to copy when this action is triggered (used for copy-link/copy-text). */
  copyValue?: string;
  /** Called when this action button is clicked. */
  onClick?: () => void;
  /** Whether to use navigator.share for this action. */
  useNativeShare?: boolean;
};

/** Props for the ShareCard component. */
export type ShareCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> & {
  /** The URL or text to share/copy. */
  value: string;
  /** Human-readable title for the share card. */
  title?: string;
  /** Additional descriptive text below the title. */
  description?: string;
  /** Explicit actions to show. When omitted, default copy-link and native-share actions are rendered. */
  actions?: ShareCardAction[];
  /** Label for the copy-link button. @default "Copy link" */
  copyLinkLabel?: string;
  /** Label shown after a successful copy. @default "Copied!" */
  copiedLabel?: string;
  /** Label for the native-share button. Only shown when navigator.share is available. @default "Share" */
  shareLabel?: string;
  /** Duration in ms to show the copied confirmation state. @default 2000 */
  confirmDuration?: number;
  /** Preview content slot rendered above the actions. */
  preview?: Snippet;
  /** Additional class names merged with `.cinder-share-card`. */
  class?: string;
};

/**
 * Cinder-specific props for ShareCard, used by the schema generator.
 */
export interface ShareCardSchemaProps {
  /** The URL or text to share/copy. */
  value: string;
  /** Human-readable title for the share card. */
  title?: string;
  /** Additional descriptive text. */
  description?: string;
  /** Label for the copy-link button. */
  copyLinkLabel?: string;
  /** Label shown after a successful copy. */
  copiedLabel?: string;
  /** Label for the native-share button. */
  shareLabel?: string;
  /**
   * Duration in ms to show the copied confirmation state.
   * @default 2000
   */
  confirmDuration?: number;
  /** Additional class names merged with `.cinder-share-card`. */
  class?: string;
}
