/** Return an element after checking its concrete DOM constructor. */
export function requireElement<T extends Element>(
  value: Element | null | undefined,
  constructor: abstract new (...arguments_: never[]) => T,
): T {
  if (!(value instanceof constructor)) {
    throw new TypeError(
      `Expected ${constructor.name}, received ${value?.constructor.name ?? 'nothing'}`,
    );
  }
  return value;
}
