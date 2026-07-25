export type ValueChangeNotification<T> = (next: T) => void;
export type ValueChangeRequestHandler<T> = (next: T) => T | void;

export function commitValue<T>(
  proposed: T,
  onValueChangeRequest: ValueChangeRequestHandler<T> | undefined,
  setValue: (next: T) => void,
  onValueChange?: ValueChangeNotification<T>,
): T {
  const requested = onValueChangeRequest?.(proposed);
  const committed = requested === undefined ? proposed : requested;
  setValue(committed);
  onValueChange?.(committed);
  return committed;
}
