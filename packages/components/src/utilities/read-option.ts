function isOptionGetter<T>(value: T | (() => T)): value is () => T {
  return typeof value === 'function';
}

export function readOption<T>(value: T | (() => T)): T {
  return isOptionGetter(value) ? value() : value;
}
