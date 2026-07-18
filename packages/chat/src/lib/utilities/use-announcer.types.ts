export type AnnouncerOptions = {
  /**
   * Delay before clearing the message (ms).
   * This should be long enough for screen readers to read the message.
   * Default: 1000
   */
  clearDelay?: number;

  /**
   * Debounce delay before announcing (ms).
   * Use when announcements may fire rapidly (e.g., typing indicators).
   * Default: 0 (no debounce)
   */
  debounceMs?: number;
};

export type Announcer = {
  /** The current message to display in the live region */
  readonly message: string;
  /** Announce a message to screen readers */
  announce(text: string): void;
  /** Clear any pending announcement and reset message */
  clear(): void;
  /** Cleanup resources - call via onDestroy() if needed before component unmount */
  destroy(): void;
};
