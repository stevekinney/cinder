export type UseHistoryEntryMetadata = {
  /** Human-readable description of the action that produced this entry. */
  label?: string | undefined;
};

export type UseHistoryCommitOptions = UseHistoryEntryMetadata & {
  /**
   * Caller-provided tag. Two consecutive commits sharing the same key within
   * `coalesceMs` replace the stack top instead of pushing. Pass `undefined`
   * (or omit) for structural actions that should always push.
   */
  coalesceKey?: string | undefined;
};

export type UseHistoryEntry<T> = {
  value: T;
  label?: string | undefined;
};

export type UseHistoryOptions<T> = {
  initial: T;
  /** Maximum number of entries retained in the stack. Default: 100. */
  maxDepth?: number | undefined;
  /** Time window for coalescing rapid commits sharing a key. Default: 300ms. */
  coalesceMs?: number | undefined;
  /** Deep-clone strategy. Default: structuredClone. */
  clone?: ((value: T) => T) | undefined;
  /**
   * Equality predicate used to skip no-op commits. Default: stable JSON
   * serialise comparison (sorted keys). Reference identity is intentionally
   * NOT used as a sufficient signal — callers may mutate-then-commit the
   * same object reference and we should still push a new entry.
   */
  equals?: ((a: T, b: T) => boolean) | undefined;
};

export type UseHistory<T> = {
  /** Current reactive value; may be ahead of the committed stack via {@link UseHistory.set}. */
  readonly current: T;
  /** Top of the committed stack — the entry undo would leave us at. */
  readonly committedEntry: UseHistoryEntry<T>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly size: number;
  readonly index: number;
  /** Replace `current` without touching the committed stack. */
  set(next: T): void;
  /** Push a new entry (subject to coalescing and equality). */
  commit(next: T, options?: UseHistoryCommitOptions): void;
  /** Move back one entry. Returns the entry we left, or null at the bottom. */
  undo(): UseHistoryEntry<T> | null;
  /** Move forward one entry. Returns the entry we moved to, or null at the top. */
  redo(): UseHistoryEntry<T> | null;
  /** Clear history and seed a new baseline. */
  reset(value: T, label?: string): void;
};
