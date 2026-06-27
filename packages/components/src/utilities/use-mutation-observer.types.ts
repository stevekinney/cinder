import type { Attachment } from 'svelte/attachments';

export type MutationCallback = (mutations: MutationRecord[]) => void;

export type UseMutationObserverOptions = {
  /** Whether to observe child node additions and removals. */
  childList?: boolean;
  /** Whether to observe changes to the target's attributes. */
  attributes?: boolean;
  /** Whether to observe changes to the target's character data. */
  characterData?: boolean;
  /** Whether to extend observation to the entire subtree. */
  subtree?: boolean;
  /** Specific attribute names to observe. Only relevant when `attributes` is true. */
  attributeFilter?: string[];
  /** Whether to record the old attribute value before a change. */
  attributeOldValue?: boolean;
  /** Whether to record the old character data before a change. */
  characterDataOldValue?: boolean;
  /** Getter for whether observation is enabled. Defaults to `() => true`. */
  enabled?: () => boolean;
};

export type MutationObserverAttachment = Attachment<HTMLElement>;
