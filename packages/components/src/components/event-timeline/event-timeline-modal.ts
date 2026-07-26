let modalPredicate: (element: HTMLElement) => boolean = (element) => {
  try {
    return element.matches(':modal');
  } catch {
    return false;
  }
};

export function setEventTimelineModalPredicate(predicate: (element: HTMLElement) => boolean): void {
  modalPredicate = predicate;
}

export function isEventTimelineModal(element: HTMLElement): boolean {
  return modalPredicate(element);
}

function hasContainingBlockStyle(style: CSSStyleDeclaration): boolean {
  return (
    style.transform !== 'none' ||
    style.translate !== 'none' ||
    style.scale !== 'none' ||
    style.rotate !== 'none' ||
    style.filter !== 'none' ||
    style.contain !== 'none'
  );
}

export function hasFixedPositionContainingBlock(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (hasContainingBlockStyle(getComputedStyle(current))) return true;
  }
  return false;
}

export function observeEventTimelineDirection(node: HTMLElement, callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  const options: MutationObserverInit = {
    attributes: true,
    attributeFilter: ['class', 'dir', 'style'],
  };
  for (let current: HTMLElement | null = node; current; current = current.parentElement) {
    observer.observe(current, options);
  }
  return () => observer.disconnect();
}
