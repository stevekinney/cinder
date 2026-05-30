/**
 * Pure helpers for the component-page example error surfaces.
 *
 * Mount errors (thrown by `mount()` inside the page's `$effect`) and source-fetch
 * failures both render a styled error block in `component-page.svelte`. The
 * formatting/truncation logic lives here, separated from the component, so it can
 * be unit-tested without a DOM and reused by both surfaces.
 */

/** Maximum number of stack characters shown in the error surface before truncation. */
export const MAX_STACK_LENGTH = 1200;

/** A mount failure captured per scenario, ready to render. */
export type MountErrorDetail = {
  /** Human-readable error message (the thrown value coerced to a string). */
  message: string;
  /** Truncated stack trace, or `undefined` when the thrown value carried none. */
  stack?: string;
};

/** A source-fetch failure captured per scenario, ready to render. */
export type SourceErrorDetail = {
  /** The `/example-src/<name>/<scenario>` URL that was requested. */
  url: string;
  /**
   * The HTTP status line (`404 Not Found`) for a response error, or the
   * exception message for a thrown/network error.
   */
  detail: string;
};

/**
 * Coerce an unknown thrown value into a readable message. `Error` instances
 * yield their `message`; everything else is `String()`-ified so a thrown string,
 * number, or object still surfaces something meaningful rather than
 * `[object Object]`-only noise.
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || 'Unknown error';
  }
  if (typeof error === 'string') return error;
  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}

/**
 * Truncate a stack trace to `MAX_STACK_LENGTH` characters, appending an
 * ellipsis marker when content was dropped. Returns `undefined` for an empty or
 * whitespace-only input so the caller can omit the stack block entirely.
 */
export function truncateStack(stack: string | undefined, maxLength = MAX_STACK_LENGTH): string | undefined {
  if (stack === undefined) return undefined;
  const trimmed = stack.trim();
  if (trimmed === '') return undefined;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}\n… (${trimmed.length - maxLength} more characters truncated)`;
}

/**
 * Build a renderable {@link MountErrorDetail} from an unknown thrown value,
 * formatting the message and truncating the stack in one place.
 */
export function toMountErrorDetail(error: unknown): MountErrorDetail {
  const message = formatErrorMessage(error);
  const stack = error instanceof Error ? truncateStack(error.stack) : undefined;
  return stack === undefined ? { message } : { message, stack };
}

/**
 * Compose the multi-line text copied to the clipboard by the "Copy error"
 * button: the message followed by the (already-truncated) stack when present.
 */
export function formatErrorForClipboard(detail: MountErrorDetail): string {
  if (detail.stack === undefined) return detail.message;
  return `${detail.message}\n\n${detail.stack}`;
}
