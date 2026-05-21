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
 *   <div {@attach createEventSource(() => streamUrl, { onmessage, onerror })}>
 *
 * For named events (`addEventListener('reload', …)`), pass an `events` map
 * keyed by event name.
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
      // Inner cleanup runs on URL change (before re-running) and on
      // attachment detach (Svelte tears the effect down).
      return () => {
        source?.close();
        source = null;
      };
    });
  };
}
