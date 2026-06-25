export type ValueChangeHandler<T> = (next: T) => T | void;

export function commitValue<T>(
  proposed: T,
  onValueChange: ValueChangeHandler<T> | undefined,
  setValue: (next: T) => void,
): void {
  setValue(onValueChange?.(proposed) ?? proposed);
}
