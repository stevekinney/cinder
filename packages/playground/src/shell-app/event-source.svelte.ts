/**
 * Attachment factory for an EventSource bound to a reactive URL getter.
 *
 * Opens an EventSource when `getUrl()` returns a non-empty string, closes the
 * previous connection when the URL changes, and cleans up on element detach.
 * The `$effect` inside reads the getter so any reactive state the getter
 * touches drives close+reopen automatically — attachments run inside a Svelte
 * effect scope, so a nested `$effect` here participates in that scope and is
 * torn down with the element.
 *
 * Handlers are captured once when the attachment runs. If the handler
 * functions need to change at runtime, pass closures that read live
 * `$state` values rather than expecting Svelte to re-bind them.
 *
 * Usage:
 *   <div {@attach createEventSource(() => streamUrl, { onmessage, onError })}>
 *
 * For named events (`addEventListener('reload', …)`), pass an `events` map
 * keyed by event name.
 */
import type { Attachment } from 'svelte/attachments';

export type EventSourceHandlers = {
  onmessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  events?: Record<string, (event: MessageEvent) => void>;
  /** Collapse bursts of server events into one callback. */
  debounceMs?: number;
};

export function createEventSource(
  getUrl: () => string | null,
  handlers: EventSourceHandlers,
): Attachment<HTMLElement> {
  return (_node) => {
    let source: EventSource | null = null;
    // Keyed per listener (`message`, `error`, or a named event) so unrelated
    // event types debounce independently — a shared timer would let one
    // event type's arrival cancel another's already-pending callback.
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    function clearDebounceTimers(): void {
      for (const timer of debounceTimers.values()) clearTimeout(timer);
      debounceTimers.clear();
    }

    $effect(() => {
      const url = getUrl();
      // Close any prior connection before opening a new one so URL changes
      // never leak a stale EventSource.
      source?.close();
      source = null;
      clearDebounceTimers();
      if (!url) return;
      source = new EventSource(url);
      const { onmessage, onError, debounceMs } = handlers;
      const wrap = <T extends Event>(
        key: string,
        handler: (event: T) => void,
      ): ((event: T) => void) => {
        if (!debounceMs || debounceMs <= 0) return handler;
        return (event) => {
          const pending = debounceTimers.get(key);
          if (pending !== undefined) clearTimeout(pending);
          debounceTimers.set(
            key,
            setTimeout(() => {
              debounceTimers.delete(key);
              handler(event);
            }, debounceMs),
          );
        };
      };
      if (onmessage) {
        source.addEventListener('message', wrap('message', onmessage));
      }
      if (onError) {
        source.addEventListener('error', wrap('error', onError));
      }
      if (handlers.events) {
        for (const [name, handler] of Object.entries(handlers.events)) {
          // EventSource named events are always MessageEvent at runtime.
          // eslint-disable-next-line no-unsafe-type-assertion -- EventSource dispatches named events as MessageEvent; the handler contract is correct.
          source.addEventListener(name, wrap(name, handler) as EventListener);
        }
      }
      // Inner cleanup runs on URL change (before re-running) and on
      // attachment detach (Svelte tears the effect down).
      return () => {
        source?.close();
        source = null;
        clearDebounceTimers();
      };
    });
  };
}
