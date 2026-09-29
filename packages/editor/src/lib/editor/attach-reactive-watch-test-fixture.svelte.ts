/** A reactive value for driving attachment getters from plain tests. */
export function createReactiveBox<T>(initial: T) {
  let value = $state.raw(initial);
  return {
    get value() {
      return value;
    },
    set value(next: T) {
      value = next;
    },
  };
}
