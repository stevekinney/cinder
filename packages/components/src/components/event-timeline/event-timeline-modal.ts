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
