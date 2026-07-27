const defaultModalPredicate = (element: HTMLElement): boolean => {
  try {
    return element.matches(':modal');
  } catch {
    return false;
  }
};
let modalPredicate: (element: HTMLElement) => boolean = defaultModalPredicate;

export function setEventTimelineModalPredicate(predicate: (element: HTMLElement) => boolean): void {
  modalPredicate = predicate;
}

export function resetEventTimelineModalPredicate(): void {
  modalPredicate = defaultModalPredicate;
}

export function isEventTimelineModal(element: HTMLElement): boolean {
  return modalPredicate(element);
}

function createsContainingBlock(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== 'none';
}

function hasContainingBlockStyle(style: CSSStyleDeclaration): boolean {
  return (
    createsContainingBlock(style.transform) ||
    createsContainingBlock(style.translate) ||
    createsContainingBlock(style.scale) ||
    createsContainingBlock(style.rotate) ||
    createsContainingBlock(style.filter) ||
    createsContainingBlock(style.contain)
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
