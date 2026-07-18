import type { Attachment } from 'svelte/attachments';

export type IntersectionCallback = (entry: IntersectionObserverEntry) => void;

export type UseIntersectionOptions = {
  /** Static root element. If null/undefined, observes against the viewport. */
  root?: Element | Document | null;
  /** CSS margin string captured when the attachment mounts. Defaults to "0px". */
  rootMargin?: string;
  /** Threshold(s) captured when the attachment mounts. Defaults to 0. */
  threshold?: number | number[];
  /** Getter for whether observation is enabled. Defaults to `() => true`. */
  enabled?: () => boolean;
};

export type IntersectionAttachment = Attachment<HTMLElement>;
