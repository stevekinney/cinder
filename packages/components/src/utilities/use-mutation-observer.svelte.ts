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

/**
 * Creates an attachment that observes the element with MutationObserver.
 *
 * All MutationObserver init options (`childList`, `attributes`, etc.) are
 * captured for each attachment instance. If the caller needs different values,
 * create a new attachment instance so a new observer is created.
 */
export function useMutationObserver(
  onMutate: MutationCallback,
  options: UseMutationObserverOptions = {},
): Attachment<HTMLElement> {
  const {
    childList,
    attributes,
    characterData,
    subtree,
    attributeFilter,
    attributeOldValue,
    characterDataOldValue,
    enabled = () => true,
  } = options;

  const init: MutationObserverInit = {};
  if (childList !== undefined) init.childList = childList;
  if (attributes !== undefined) init.attributes = attributes;
  if (characterData !== undefined) init.characterData = characterData;
  if (subtree !== undefined) init.subtree = subtree;
  if (attributeFilter !== undefined) init.attributeFilter = attributeFilter;
  if (attributeOldValue !== undefined) init.attributeOldValue = attributeOldValue;
  if (characterDataOldValue !== undefined) init.characterDataOldValue = characterDataOldValue;

  return (node: HTMLElement) => {
    if (typeof MutationObserver === 'undefined') {
      return () => {};
    }

    let observer: MutationObserver | null = null;

    const disconnectObserver = () => {
      observer?.disconnect();
      observer = null;
    };

    $effect(() => {
      if (!enabled()) {
        disconnectObserver();
        return;
      }

      observer = new MutationObserver((mutations) => {
        if (!enabled()) {
          return;
        }

        onMutate(mutations);
      });

      observer.observe(node, init);

      return () => {
        disconnectObserver();
      };
    });

    return () => {
      disconnectObserver();
    };
  };
}
