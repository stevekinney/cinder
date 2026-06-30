/**
 * Generic undo/redo history for JSON-compatible values.
 *
 * The history maintains a committed stack and a `current` value that may be
 * ahead of the stack via {@link UseHistory.set}. Equality decisions for
 * "did anything change?" are made against the committed stack top, never
 * against the transient `current`, so a `set()` followed by a `commit()` of
 * the same value still pushes when the value differs from the committed top.
 *
 * Defaults (`structuredClone` for cloning, stable JSON serialise for equality)
 * cover plain JSON-shaped data: objects, arrays, primitives, and nested
 * combinations of those. Callers using `Map`, `Set`, `Date`, `BigInt`, cyclic
 * graphs, or other non-JSON-cloneable values must supply their own `clone`
 * and `equals` strategies.
 */

function defaultClone<T>(value: T): T {
  // First unwrap any Svelte $state proxies via $state.snapshot, which yields
  // a plain object graph. Then run structuredClone to enforce our cloneable
  // contract — structuredClone throws on functions/symbols/etc. ($state.snapshot
  // only warns and silently includes originals).
  // The Snapshot<T> type is structurally compatible with T at runtime; the
  // assertion is needed because Svelte deep-marks the snapshot as readonly.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const snapshot = $state.snapshot(value) as T;
  return structuredClone(snapshot);
}

function isPlainObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Stable JSON serialisation with sorted object keys — used for equality checks. */
export function stableSerialise(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (!isPlainObjectRecord(val)) return val;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(val).toSorted()) {
      sorted[k] = val[k];
    }
    return sorted;
  });
}

function defaultEquals<T>(a: T, b: T): boolean {
  if (a === b) {
    // Reference identity is a sufficient *positive* signal only for primitives
    // — for objects, the caller may have mutated in place, so we still need to
    // serialise and compare. (Two primitives that are === are definitely equal.)
    if (a === null || typeof a !== 'object') return true;
  }
  return stableSerialise(a) === stableSerialise(b);
}

export function useHistory<T>(
  options: import('./use-history.types.ts').UseHistoryOptions<T>,
): import('./use-history.types.ts').UseHistory<T> {
  const { initial, coalesceMs = 300, clone = defaultClone, equals = defaultEquals } = options;

  // Clamp maxDepth to at least 1 so the stack always has a committed entry.
  const maxDepth = Math.max(1, options.maxDepth ?? 100);

  type Entry = {
    value: T;
    label?: string | undefined;
    coalesceKey?: string | undefined;
    committedAt: number;
  };

  // Use separate clones for the committed stack and the transient `current`
  // so direct mutation of `current` (via Svelte's deep reactivity) cannot
  // corrupt the committed baseline.
  const seed: Entry = { value: clone(initial), committedAt: 0 };
  let stack = $state<Entry[]>([seed]);
  let pointer = $state(0);
  let current = $state<T>(clone(initial));

  // Invariant: stack always contains at least one entry and pointer is always
  // a valid index. Calls to this helper express that intent so we don't
  // litter the implementation with `!` non-null assertions.
  function entryAt(index: number): Entry {
    const entry = stack[index];
    if (!entry) {
      throw new Error(`useHistory: stack index ${index} out of range (size ${stack.length})`);
    }
    return entry;
  }

  function evictIfNeeded() {
    while (stack.length > maxDepth) {
      stack.shift();
      pointer = Math.max(0, pointer - 1);
    }
  }

  function snapshotEntry(entry: Entry): import('./use-history.types.ts').UseHistoryEntry<T> {
    // Clone on read so a caller mutating the returned value cannot corrupt
    // committed history.
    return { value: clone(entry.value), label: entry.label };
  }

  return {
    get current() {
      return current;
    },
    get committedEntry(): import('./use-history.types.ts').UseHistoryEntry<T> {
      return snapshotEntry(entryAt(pointer));
    },
    get canUndo() {
      return pointer > 0;
    },
    get canRedo() {
      return pointer < stack.length - 1;
    },
    get size() {
      return stack.length;
    },
    get index() {
      return pointer;
    },

    set(next: T) {
      current = next;
    },

    commit(next: T, commitOptions?: import('./use-history.types.ts').UseHistoryCommitOptions) {
      const top = entryAt(pointer);

      // Clone before any decision so cloneable contract is enforced even when
      // the value happens to be equal to the committed top.
      const cloned = clone(next);

      if (equals(next, top.value)) {
        // Sync `current` to the committed value (caller may have drifted via
        // set()). Use a fresh clone so consumers can't mutate stack state.
        current = clone(top.value);
        return;
      }

      const now = Date.now();
      const coalesceKey = commitOptions?.coalesceKey;
      const label = commitOptions?.label;

      const canCoalesce =
        coalesceKey !== undefined &&
        top.coalesceKey === coalesceKey &&
        now - top.committedAt <= coalesceMs &&
        pointer === stack.length - 1;

      if (canCoalesce) {
        stack[pointer] = {
          value: cloned,
          label: label ?? top.label,
          coalesceKey,
          committedAt: now,
        };
      } else {
        if (pointer < stack.length - 1) {
          stack = stack.slice(0, pointer + 1);
        }
        stack.push({ value: cloned, label, coalesceKey, committedAt: now });
        pointer = stack.length - 1;
        evictIfNeeded();
      }

      current = clone(entryAt(pointer).value);
    },

    undo() {
      if (pointer === 0) return null;
      const left = entryAt(pointer);
      pointer -= 1;
      current = clone(entryAt(pointer).value);
      return snapshotEntry(left);
    },

    redo() {
      if (pointer >= stack.length - 1) return null;
      pointer += 1;
      const moved = entryAt(pointer);
      current = clone(moved.value);
      return snapshotEntry(moved);
    },

    reset(value: T, label?: string) {
      stack = [{ value: clone(value), label, committedAt: Date.now() }];
      pointer = 0;
      current = clone(value);
    },
  };
}
