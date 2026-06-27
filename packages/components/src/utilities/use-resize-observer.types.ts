import type { Attachment } from 'svelte/attachments';

export type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

export type UseResizeObserverOptions = {
  /** Which box model to observe. Defaults to the ResizeObserver constructor default. */
  box?: ResizeObserverBoxOptions;
  /** Getter for whether observation is enabled. Defaults to `() => true`. */
  enabled?: () => boolean;
};

export type ResizeObserverAttachment = Attachment<HTMLElement>;
