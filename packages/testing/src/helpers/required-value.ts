/** Require a present fixture or result before making more specific assertions. */
export function requiredValue<Value>(value: Value | null | undefined): Value {
  if (value === undefined || value === null) {
    throw new Error('Expected a present test result or fixture entry');
  }
  return value;
}

/** Validate a fixture's runtime class before using its class-specific API. */
export function requiredInstance<Value>(
  value: unknown,
  constructor: abstract new (...arguments_: never[]) => Value,
): Value {
  if (!(value instanceof constructor)) {
    throw new Error(`Expected an instance of ${constructor.name}`);
  }
  return value;
}
