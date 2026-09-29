/**
 * Test-only helpers for MarkdownEditor's preview and mode tests (COR-525).
 *
 * `createReactiveProps` builds the props object a parent's `bind:` would
 * pass: every key is a getter over reactive state, so the test can replace a
 * prop after mount, and a setter, so the component's writes to a bindable
 * prop (`value`, `mode`) arrive in `writes` exactly as a parent binding would
 * receive them. `@testing-library/svelte` cannot do this (see
 * `markdown-editor-bindable-harness.svelte`).
 */

class Cell {
  current = $state.raw<unknown>();

  constructor(initial: unknown) {
    this.current = initial;
  }
}

export interface ReactiveProps {
  /** Pass to `mount`/`hydrate`, asserted to the component's props type. */
  readonly props: Record<string, unknown>;
  /** Every write the component made to a prop, in order. */
  readonly writes: [key: string, value: unknown][];
  /** Replace a prop as the parent would; not recorded in `writes`. */
  set(key: string, value: unknown): void;
  /**
   * Veto the component's writes to `key`, as a parent binding whose setter
   * keeps its own value does. Vetoed writes are still recorded.
   */
  rejectWrites(key: string): void;
}

/** Every key the test may change later must be present in `initial`, even as `undefined`. */
export function createReactiveProps(initial: Record<string, unknown>): ReactiveProps {
  const cells = new Map<string, Cell>();
  const writes: [string, unknown][] = [];
  const rejected = new Set<string>();
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(initial)) {
    const cell = new Cell(value);
    cells.set(key, cell);
    Object.defineProperty(props, key, {
      enumerable: true,
      get: () => cell.current,
      set: (next: unknown) => {
        writes.push([key, next]);
        if (!rejected.has(key)) cell.current = next;
      },
    });
  }
  return {
    props,
    writes,
    set(key, value) {
      const cell = cells.get(key);
      if (!cell) throw new Error(`createReactiveProps: "${key}" was not declared`);
      cell.current = value;
    },
    rejectWrites(key) {
      rejected.add(key);
    },
  };
}

/** Run `setup` inside an effect root, as a component's initialization would. */
export function createEffectRoot<T extends object>(
  setup: () => T,
): { value: T; destroy: () => void } {
  const results: T[] = [];
  const destroy = $effect.root(() => {
    results.push(setup());
  });
  const value = results.at(0);
  if (value === undefined) throw new Error('createEffectRoot: setup did not run');
  return { value, destroy };
}
