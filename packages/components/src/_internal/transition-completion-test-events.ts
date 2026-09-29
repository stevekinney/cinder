export function createTransitionEndEvent(propertyName: string): Event {
  const event = new Event('transitionend');
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  return event;
}

export function createTransitionCancelEvent(propertyName: string, bubbles = false): Event {
  const event = new Event('transitioncancel', { bubbles });
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  return event;
}
