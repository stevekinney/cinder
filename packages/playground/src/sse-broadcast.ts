/** Set of active SSE stream controllers. */
export const sseClients = new Set<ReadableStreamDefaultController<string>>();

/**
 * Send a named SSE event to every connected client.
 *
 * - `reload` (default) → shell SPA reloads only the iframe, preserving any
 *   in-shell state (sidebar scroll, future top-bar state). Used when
 *   preview-source files change.
 * - `shell-reload` → shell SPA performs a full `location.reload()` because
 *   the shell bundle itself changed. Used when files under `shell-app/` or
 *   `render-shell.ts` change.
 */
export function triggerReload(eventType: 'reload' | 'shell-reload' = 'reload'): void {
  const message = `event: ${eventType}\ndata: {}\n\n`;
  const dead: ReadableStreamDefaultController<string>[] = [];
  for (const controller of sseClients) {
    try {
      controller.enqueue(message);
    } catch {
      // Client already closed — collect for removal after iteration.
      dead.push(controller);
    }
  }
  for (const controller of dead) {
    sseClients.delete(controller);
  }
}

/** GET /events — Server-Sent Events stream for live reload. */
export function handleEventsRoute(): Response {
  let controller: ReadableStreamDefaultController<string> | undefined;
  const stream = new ReadableStream<string>({
    start(c) {
      controller = c;
      sseClients.add(c);
      // Send an initial comment to establish the connection.
      c.enqueue(': connected\n\n');
    },
    cancel() {
      if (controller) sseClients.delete(controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
