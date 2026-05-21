/// <reference lib="dom" />

/**
 * Shared focus-restore helper used by overlay components (Modal, Sheet,
 * Popover) when returning focus on close. The candidate list is kept local
 * to each component — this helper enforces a uniform per-candidate safety
 * check and refuses to fall back to `document.body`.
 *
 * The check matches Popover's pre-existing strictness: the target must be
 * non-null, currently connected to the active document, and owned by that
 * document. When the candidate fails the check the helper no-ops and returns
 * `false` so callers can try the next candidate.
 */

/**
 * Attempt to focus `target`. Returns `true` when focus was moved, `false`
 * when the target failed the connection/ownership check or was null. Never
 * falls back to `document.body`.
 *
 * Usage (typical candidate iteration):
 *
 * ```ts
 * const candidates = [triggerRef, capturedFocus];
 * for (const candidate of candidates) {
 *   if (restoreFocusTo(candidate)) break;
 * }
 * ```
 */
export function restoreFocusTo(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (typeof document === 'undefined') return false;
  if (!target.isConnected) return false;
  if (target.ownerDocument !== document) return false;
  try {
    target.focus();
  } catch {
    // happy-dom + jsdom can throw on focus() for exotic elements; treat as
    // a failed candidate so the caller can fall through to the next one.
    return false;
  }
  return true;
}
