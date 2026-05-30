/**
 * Validation script for the cinder component playground server.
 *
 * Starts the playground server in-process by calling startServer() from server.ts
 * (guarded by import.meta.main so importing it here does not auto-start it),
 * crawls every /c/<name> route for all discovered components, validates HTTP
 * status codes and page content, and tests the SSE reload path.
 *
 * Usage:
 *   bun run scripts/playground/validate-playground.ts
 *
 * Exit 0 on success, non-zero with a descriptive error on failure.
 */

import { join } from 'node:path';

import { discoverComponents } from './discover.ts';
import { type PlaygroundServer, PORT, startServer, triggerReload } from './server.ts';

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
const MINIMUM_COMPONENT_COUNT = 80;

// Title-presence check for `.example.svelte` files. SELF-CONTAINED on purpose:
// this duplicates a tiny title regex rather than importing from
// `example-metadata.ts`/`server.ts` so the build-time gate has no coupling to
// the runtime server module (importing server.ts would also auto-wire its
// import.meta.main guard expectations into this validator's dependency graph).

/** The sentinel a missing title falls back to; an explicit one is rejected too. */
const UNTITLED_SENTINEL = 'Untitled';

// Matches `export const title = '…' | "…" | `…``. Mirrors the runtime extractor:
// a same-quote backreference close and `\\.` to skip escaped quotes inside the
// literal. Interpolated template literals are intentionally not parsed — titles
// must be plain string literals.
const TITLE_PATTERN = /export\s+const\s+title\s*=\s*(['"`])((?:[^\\]|\\.)*?)\1/;

/**
 * Read the `export const title` string literal from example source, or `null`
 * when the file declares no exported title. Pure — no I/O. Exported for tests.
 */
export function readExampleTitle(source: string): string | null {
  const match = source.match(TITLE_PATTERN);
  return match ? (match[2] ?? '') : null;
}

/**
 * Classify an example's title: `'ok'` when a real title is present, `'missing'`
 * when no exported title exists, `'untitled'` when it is the `'Untitled'`
 * sentinel. Pure — no I/O. Exported for tests.
 */
export function classifyExampleTitle(source: string): 'ok' | 'missing' | 'untitled' {
  const title = readExampleTitle(source);
  if (title === null) return 'missing';
  if (title === UNTITLED_SENTINEL) return 'untitled';
  return 'ok';
}

/**
 * Scan every `.example.svelte` file and fail when any is missing a `title`
 * export or uses the `'Untitled'` sentinel. Reports the count of checked files.
 */
async function validateExampleTitles(examplesRoot: string): Promise<void> {
  process.stdout.write('[validate:playground] checking example titles…\n');

  const offenders: string[] = [];
  let checked = 0;
  const glob = new Bun.Glob('**/*.example.svelte');
  for await (const relativePath of glob.scan({ cwd: examplesRoot })) {
    checked += 1;
    const filePath = join(examplesRoot, relativePath);
    const source = await Bun.file(filePath).text();
    const verdict = classifyExampleTitle(source);
    if (verdict === 'missing') {
      offenders.push(`${relativePath} — missing \`export const title\``);
    } else if (verdict === 'untitled') {
      offenders.push(`${relativePath} — title is the \`'Untitled'\` placeholder`);
    }
  }

  if (offenders.length > 0) {
    fail(
      `${offenders.length} of ${checked} example(s) lack a usable title:\n` +
        offenders.map((line) => `  - ${line}`).join('\n'),
    );
  }

  process.stdout.write(`[validate:playground] all ${checked} example titles present.\n`);
}

/** Wait for the server to become ready by polling /ping. */
async function waitForPing(baseUrl: string, timeoutMs: number): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/ping`, { signal: AbortSignal.timeout(500) });
      if (response.status === 200) return;
    } catch {
      // Not ready yet.
    }
    await Bun.sleep(100);
  }
  fail(`playground server did not respond at ${baseUrl} within ${timeoutMs}ms`);
}

/**
 * Validate shell + component page routes for all discovered components:
 *   - /c/:name — shell scaffold with the SPA mount point and initial data island
 *   - /page/:name — standalone component page (the iframe content)
 */
async function validateComponentRoutes(baseUrl: string, components: string[]): Promise<void> {
  process.stdout.write(`[validate:playground] crawling ${components.length} component routes…\n`);

  // The snapshot route (`/page/:name?snapshot=1`) re-renders the same page with
  // snapshot mode enabled, so validating it for every component is redundant.
  // Sample a bounded, deterministic subset (every Nth component) to keep the
  // crawl fast while still exercising the snapshot code path across the set.
  const snapshotSampleStride = Math.max(1, Math.ceil(components.length / 10));
  const snapshotSample = new Set(
    components.filter((_, index) => index % snapshotSampleStride === 0),
  );

  for (const name of components) {
    // Shell route
    const shellUrl = `${baseUrl}/c/${name}`;
    let shellResponse: Response;
    try {
      shellResponse = await fetch(shellUrl, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      fail(`fetch ${shellUrl} threw: ${String(error)}`);
    }
    if (shellResponse.status !== 200) {
      fail(`GET ${shellUrl} returned ${shellResponse.status}, expected 200`);
    }
    const shellBody = await shellResponse.text();
    if (!shellBody.includes('<!DOCTYPE html>')) {
      fail(`GET ${shellUrl} did not return HTML (missing DOCTYPE)`);
    }
    if (!shellBody.includes('id="shell-root"')) {
      fail(`GET ${shellUrl} HTML is missing the expected #shell-root mount point`);
    }
    if (!shellBody.includes('id="cinder-initial"')) {
      fail(`GET ${shellUrl} HTML is missing the expected cinder-initial data island`);
    }
    if (!shellBody.includes('src="/shell-bundle/shell.js"')) {
      fail(`GET ${shellUrl} HTML does not load the shell bundle`);
    }
    if (shellBody.includes(`src="/c/${name}"`)) {
      fail(`GET ${shellUrl} shell scaffold references /c/${name} recursively`);
    }

    // Component page route (iframe content)
    const pageUrl = `${baseUrl}/page/${name}`;
    let pageResponse: Response;
    try {
      pageResponse = await fetch(pageUrl, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      fail(`fetch ${pageUrl} threw: ${String(error)}`);
    }
    if (pageResponse.status !== 200) {
      fail(`GET ${pageUrl} returned ${pageResponse.status}, expected 200`);
    }
    const pageBody = await pageResponse.text();
    if (!pageBody.includes('__CINDER_EXAMPLES__')) {
      fail(`GET ${pageUrl} does not inject __CINDER_EXAMPLES__`);
    }

    // Snapshot route (sampled): /page/:name?snapshot=1 must return 200 and emit
    // the data-snapshot-mode attribute on <html> (snapshotModeHtmlAttribute).
    if (snapshotSample.has(name)) {
      const snapshotUrl = `${pageUrl}?snapshot=1`;
      let snapshotResponse: Response;
      try {
        snapshotResponse = await fetch(snapshotUrl, { signal: AbortSignal.timeout(5_000) });
      } catch (error) {
        fail(`fetch ${snapshotUrl} threw: ${String(error)}`);
      }
      if (snapshotResponse.status !== 200) {
        fail(`GET ${snapshotUrl} returned ${snapshotResponse.status}, expected 200`);
      }
      const snapshotBody = await snapshotResponse.text();
      if (!snapshotBody.includes('data-snapshot-mode')) {
        fail(`GET ${snapshotUrl} did not emit the data-snapshot-mode attribute`);
      }
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

// Guarded by import.meta.main so importing this module (e.g. to unit-test the
// pure title helpers) does not auto-start the server or call process.exit().
if (import.meta.main) {
  let server: PlaygroundServer | undefined;

  try {
    server = await startServer(PORT);
    const baseUrl = `http://127.0.0.1:${server.port}`;
    process.stdout.write(
      `[validate:playground] waiting for playground server on port ${server.port}…\n`,
    );
    await waitForPing(baseUrl, 10_000);
    process.stdout.write(`[validate:playground] server ready at ${baseUrl}\n`);

    const components = await discoverComponents();
    if (components.length < MINIMUM_COMPONENT_COUNT) {
      fail(
        `expected at least ${MINIMUM_COMPONENT_COUNT} components but discoverComponents returned ${components.length}`,
      );
    }

    // import.meta.dirname is packages/playground/src/; examples live under examples/.
    await validateExampleTitles(join(import.meta.dirname, 'examples'));
    await validateComponentRoutes(baseUrl, components);
    await validateSseReload(baseUrl);

    process.stdout.write('[validate:playground] all checks passed.\n');
    await server.dispose();
    process.exit(0);
  } catch (error) {
    await server?.dispose();
    if (error instanceof PlaygroundValidationError) {
      process.stderr.write(`[validate:playground] FAILED: ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
