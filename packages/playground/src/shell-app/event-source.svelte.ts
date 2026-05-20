/**
 * Attachment factory for an EventSource bound to a reactive URL getter.
 *
 * Per Commit 5 / C5: opens an EventSource when `getUrl()` returns a non-empty
 * string, closes the previous connection when the URL changes, and cleans up
 * on element detach. The inner `$effect` reads the getter so any reactive
 * state the getter touches drives close+reopen automatically.
 *
 * Usage:
 *   <div {@attach createEventSource(() => streamUrl, { onmessage, onerror })}>
 *
 * Listener handlers map: `onmessage` and `onerror` are the default
 * `EventSource` handler slots. For named events (`addEventListener('reload', …)`),
 * pass an `events` map keyed by event name.
 */
import type { Attachment } from 'svelte/attachments';

export type EventSourceHandlers = {
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: Event) => void;
  events?: Record<string, (event: MessageEvent) => void>;
};

export function createEventSource(
  getUrl: () => string | null,
  handlers: EventSourceHandlers,
): Attachment<HTMLElement> {
  return (_node) => {
    let source: EventSource | null = null;

    const cleanupEffect = $effect.root(() => {
      $effect(() => {
        const url = getUrl();
        // Close any prior connection before opening a new one so URL changes
        // never leak a stale EventSource.
        source?.close();
        source = null;
        if (!url) return;
        source = new EventSource(url);
        if (handlers.onmessage) source.onmessage = handlers.onmessage;
        if (handlers.onerror) source.onerror = handlers.onerror;
        if (handlers.events) {
          for (const [name, handler] of Object.entries(handlers.events)) {
            source.addEventListener(name, handler as EventListener);
          }
        }
      });
    });

    return () => {
      cleanupEffect();
      source?.close();
      source = null;
    };
  };
}
