export type ChangeTrackerOptions = {
  /** Debounce delay for semantic comparison (ms). Default: 300 */
  debounceMs?: number;
  /** Whether to include front matter in comparison. Default: false */
  includeFrontMatter?: boolean;
};

export type ChangeTracker = {
  /** Whether content has changed from baseline (fast check + verified result) */
  readonly hasChanges: boolean;
  /** Whether semantic verification is still pending */
  readonly isPending: boolean;
  /** Set the baseline value (e.g., original document) */
  setBaseline(value: string): void;
  /** Set the current value (e.g., edited document) */
  setCurrent(value: string): void;
  /** Force immediate semantic verification (useful for save operations) */
  verifyNow(): boolean;
  /** Cleanup resources (call on component destroy) */
  destroy(): void;
};
