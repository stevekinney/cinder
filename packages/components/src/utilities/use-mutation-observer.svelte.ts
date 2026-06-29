/**
 * Creates an attachment that observes the element with MutationObserver.
 *
 * All MutationObserver init options (`childList`, `attributes`, etc.) are
 * captured for each attachment instance. If the caller needs different values,
 * create a new attachment instance so a new observer is created.
 */
export function useMutationObserver(
  onMutate: import('./use-mutation-observer.types.ts').MutationCallback,
  options: import('./use-mutation-observer.types.ts').UseMutationObserverOptions = {},
): import('./use-mutation-observer.types.ts').MutationObserverAttachment {
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

  // MutationObserver.observe() throws a TypeError unless at least one of childList /
  // attributes / characterData is set. If a caller passed only modifiers (or nothing),
  // default to observing childList so the attachment never throws at runtime.
  if (
    init.childList === undefined &&
    init.attributes === undefined &&
    init.characterData === undefined
  ) {
    init.childList = true;
  }

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
