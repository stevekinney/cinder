import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type FeedProps = Omit<HTMLAttributes<HTMLOListElement>, 'children' | 'class'> & {
  /** Additional class merged onto the `.cinder-feed` root element. */
  class?: string;
  /**
   * When true, the wrapper becomes an ARIA live region: `aria-live="polite"`
   * and `aria-atomic="false"`. Use for feeds that mutate while the user is
   * on the page (streaming notifications, log tails, chat-like activity).
   * Defaults to false — a polite live region on a static feed is noise.
   */
  live?: boolean;
  /** Feed events (typically `<FeedEvent>` children). */
  children: Snippet;
};
