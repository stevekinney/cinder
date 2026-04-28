/**
 * Validation script for the cinder component playground server.
 *
 * Starts the playground server in-process by calling main() from server.ts
 * (guarded by import.meta.main so importing it here does not auto-start it),
 * crawls every /c/<name> route for all discovered components, validates HTTP
 * status codes and page content, and tests the SSE reload path.
 *
 * Usage:
 *   bun run scripts/playground/validate-playground.ts
 *
 * Exit 0 on success, non-zero with a descriptive error on failure.
 */

import { discoverComponents } from './discover.ts';
import { PORT, startServer, triggerReload } from './server.ts';

class PlaygroundValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaygroundValidationError';
  }
}

function fail(message: string): never {
  throw new PlaygroundValidationError(message);
}

/** Minimum number of public components expected in src/components/. */
const MINIMUM_COMPONENT_COUNT = 21;

const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Wait for the server to become ready by polling /ping. */
async function waitForPing(timeoutMs: number): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/ping`, { signal: AbortSignal.timeout(500) });
      if (response.status === 200) return;
    } catch {
      // Not ready yet.
    }
    await Bun.sleep(100);
  }
  fail(`playground server did not respond on port ${PORT} within ${timeoutMs}ms`);
}

/**
 * Validate that every /c/<name> route returns HTTP 200 and renders an HTML page
 * with the expected <nav> shell element.
 */
async function validateComponentRoutes(baseUrl: string, components: string[]): Promise<void> {
  process.stdout.write(`[validate:playground] crawling ${components.length} component routes…\n`);

  for (const name of components) {
    const url = `${baseUrl}/c/${name}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      fail(`fetch ${url} threw: ${String(error)}`);
    }

    if (response.status !== 200) {
      fail(`GET ${url} returned ${response.status}, expected 200`);
    }

    const body = await response.text();
    if (!body.includes('<!DOCTYPE html>')) {
      fail(`GET ${url} did not return HTML (missing DOCTYPE)`);
    }

    if (!body.includes('<nav>')) {
      fail(`GET ${url} HTML is missing the expected <nav> shell element`);
    }
  }

  process.stdout.write(
    `[validate:playground] all ${components.length} component routes returned 200.\n`,
  );
}

/**
 * Validate the SSE reload path:
 *   1. Connect to /events and wait for the ': connected' handshake.
 *   2. Call `triggerReload()` once the connection is confirmed.
 *   3. Assert a `reload` event arrives within 1 000 ms.
 */
async function validateSseReload(baseUrl: string): Promise<void> {
  process.stdout.write('[validate:playground] testing SSE reload path…\n');

  const reloadReceived = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new PlaygroundValidationError('SSE reload event not received within 1000ms'));
    }, 1_000);

    // Use a manual fetch + ReadableStream reader instead of EventSource so we
    // can control the abort and avoid browser-only API assumptions.
    const abortController = new AbortController();

    const ssePromise = fetch(`${baseUrl}/events`, {
      signal: abortController.signal,
      headers: { Accept: 'text/event-stream' },
    })
      .then(async (response) => {
        if (!response.body) {
          clearTimeout(timeout);
          abortController.abort();
          reject(new PlaygroundValidationError('/events response has no body'));
          return null;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let connected = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            // Wait for the server's initial handshake comment before triggering
            // reload — this guarantees the controller is registered in sseClients.
            if (!connected && chunk.includes(': connected')) {
              connected = true;
              triggerReload();
              continue;
            }

            if (chunk.includes('event: reload')) {
              clearTimeout(timeout);
              abortController.abort();
              resolve();
              return null;
            }
          }
        } catch (error) {
          // AbortError is expected when we abort after receiving the event.
          if (error instanceof Error && error.name === 'AbortError') return null;
          clearTimeout(timeout);
          reject(error);
        }
        return null;
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return null;
        clearTimeout(timeout);
        reject(error);
        return null;
      });

    void ssePromise;
  });

  await reloadReceived;
  process.stdout.write('[validate:playground] SSE reload event received.\n');
}

let server: ReturnType<typeof startServer> | undefined;

try {
  server = startServer(PORT);
  process.stdout.write(`[validate:playground] waiting for playground server on port ${PORT}…\n`);
  await waitForPing(10_000);
  process.stdout.write(`[validate:playground] server ready at ${BASE_URL}\n`);

  const components = await discoverComponents();
  if (components.length < MINIMUM_COMPONENT_COUNT) {
    fail(
      `expected at least ${MINIMUM_COMPONENT_COUNT} components but discoverComponents returned ${components.length}`,
    );
  }

  await validateComponentRoutes(BASE_URL, components);
  await validateSseReload(BASE_URL);

  process.stdout.write('[validate:playground] all checks passed.\n');
  void server.stop(true);
  process.exit(0);
} catch (error) {
  void server?.stop(true);
  if (error instanceof PlaygroundValidationError) {
    process.stderr.write(`[validate:playground] FAILED: ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
