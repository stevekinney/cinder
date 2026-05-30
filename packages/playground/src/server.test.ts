/**
 * Unit tests for `scripts/playground/server.ts` route handlers.
 *
 * Uses handleRequest directly (no live server) for route-level coverage.
 * The triggerReload / SSE integration path is covered by validate-playground.ts.
 *
 * Tests that hit /bundle/button/primary.js and /example-src/button/primary rely
 * on scripts/playground/examples/button/primary.example.svelte existing. A
 * beforeAll guard asserts this up front so failures are diagnosable.
 */

import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import type { ComponentManifest } from './analyze.ts';
import { jsonForScriptTag } from './render-shell.ts';
import { PORT, createHttpServerOnAvailablePort, handleRequest, triggerReload } from './server.ts';

const FIXTURE_COMPONENT = 'button';
const FIXTURE_SCENARIO = 'primary';
const FIXTURE_PATH = join(
  import.meta.dirname,
  'examples',
  FIXTURE_COMPONENT,
  `${FIXTURE_SCENARIO}.example.svelte`,
);

beforeAll(async () => {
  const exists = await Bun.file(FIXTURE_PATH).exists();
  if (!exists) {
    throw new Error(
      `[server.test] Required fixture missing: ${FIXTURE_PATH}\n` +
        `Create src/examples/${FIXTURE_COMPONENT}/${FIXTURE_SCENARIO}.example.svelte before running these tests.`,
    );
  }
});

const temporaryServers: ReturnType<typeof Bun.serve>[] = [];

afterEach(async () => {
  const servers = temporaryServers.splice(0);
  await Promise.all(servers.map((server) => server.stop(true)));
});

function req(path: string, options?: RequestInit): Request {
  return new Request(`http://localhost:${PORT}${path}`, options);
}

function reservePort(start: number): ReturnType<typeof Bun.serve> {
  for (let port = start; port < start + 100; port++) {
    try {
      return Bun.serve({
        port,
        fetch: () => new Response('reserved'),
      });
    } catch (error) {
      const errorWithCode = error as Error & { code?: unknown };
      if (errorWithCode.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`Could not reserve a test port starting at ${start}`);
}

function tryReservePort(port: number): ReturnType<typeof Bun.serve> | null {
  try {
    return Bun.serve({
      port,
      fetch: () => new Response('reserved'),
    });
  } catch (error) {
    const errorWithCode = error as Error & { code?: unknown };
    if (errorWithCode.code === 'EADDRINUSE') return null;
    throw error;
  }
}

describe('port selection', () => {
  it('defaults to port 5555', () => {
    expect(PORT).toBe(5555);
  });

  it('uses the next available port when the preferred port is taken', async () => {
    const reserved = tryReservePort(PORT) ?? reservePort(56_000);
    temporaryServers.push(reserved);
    const reservedPort = reserved.port;
    if (reservedPort === undefined) throw new Error('Reserved test server did not expose a port');

    const { port: serverPort, server } = createHttpServerOnAvailablePort(
      reservedPort,
      () => new Response('fallback'),
    );
    temporaryServers.push(server);

    expect(serverPort).toBeGreaterThan(reservedPort);
    const response = await fetch(`http://127.0.0.1:${serverPort}`);
    expect(await response.text()).toBe('fallback');
  });
});

describe('/ping', () => {
  it('returns 200 pong', async () => {
    const response = await handleRequest(req('/ping'));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('pong');
  });
});

describe('/styles.css', () => {
  it('returns 200 with text/css when src/styles/index.css exists', async () => {
    const response = await handleRequest(req('/styles.css'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/css');
  });
});

describe('/', () => {
  it('redirects to /c/<first-component>', async () => {
    const response = await handleRequest(req('/'));
    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toMatch(/^\/c\//);
  });
});

describe('/c/:name', () => {
  it('returns 200 HTML for a known component', async () => {
    const response = await handleRequest(req('/c/button'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/html');
    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    // Shell SPA scaffolding: mount point, data island, and bundle tag.
    expect(html).toContain('id="shell-root"');
    expect(html).toContain('id="cinder-initial"');
    expect(html).toContain('/shell-bundle/shell.js');
  });

  it('embeds the active component name in the cinder-initial data island', async () => {
    const response = await handleRequest(req('/c/button'));
    const html = await response.text();
    const match = html.match(
      /<script type="application\/json" id="cinder-initial">([^<]+)<\/script>/,
    );
    expect(match).not.toBeNull();
    const payload = JSON.parse(match![1]!) as { component: string; components: string[] };
    expect(payload.component).toBe('button');
    expect(payload.components).toContain('button');
    expect(payload.components).toContain('avatar');
  });

  it('returns 404 for an unknown component', async () => {
    const response = await handleRequest(req('/c/does-not-exist'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for segments with uppercase (not in safe-segment pattern)', async () => {
    const response = await handleRequest(req('/c/Button'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for segments starting with a hyphen', async () => {
    const response = await handleRequest(req('/c/-bad'));
    expect(response.status).toBe(404);
  });
});

describe('/shell-bundle/:filename.js', () => {
  it('returns 200 application/javascript for the canonical /shell.js entry', async () => {
    const response = await handleRequest(req('/shell-bundle/shell.js'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/javascript');
    const body = await response.text();
    // Shell bundle must mount the SPA — the mount target ID is part of the
    // public contract between the bundle and render-shell.ts.
    expect(body).toContain('shell-root');
  }, 30_000);

  it('returns 404 for an unknown shell-bundle filename', async () => {
    const response = await handleRequest(req('/shell-bundle/does-not-exist.js'));
    expect(response.status).toBe(404);
  });
});

describe('/page-bundle/:name.js', () => {
  it('returns 200 application/javascript for a known component', async () => {
    const response = await handleRequest(req(`/page-bundle/${FIXTURE_COMPONENT}.js`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/javascript');
  }, 30_000);

  it('returns 404 for an unknown component', async () => {
    const response = await handleRequest(req('/page-bundle/does-not-exist.js'));
    expect(response.status).toBe(404);
  }, 30_000);

  it('returns 404 for segments with uppercase (blocked by isSafeSegment)', async () => {
    const response = await handleRequest(req('/page-bundle/Button.js'));
    expect(response.status).toBe(404);
  }, 30_000);
});

// Code-split chunks. Both bundle families (page-bundle and per-scenario
// bundle) emit dynamic-import URLs through publicPath: '/page-bundle/'.
// Entry artifacts and async chunks share that flat namespace; chunks are
// content-hashed (`<name>-<hash>.js`) so they never collide with the
// unhashed entry URL `<name>.js` the iframe asks for.
describe('chunks under /page-bundle/<filename>.js', () => {
  it('returns 404 for an unknown chunk filename that fails isSafeSegment', async () => {
    // Names with uppercase fail the safe-segment guard before any lookup.
    const response = await handleRequest(req('/page-bundle/Does-Not-Exist.js'));
    expect(response.status).toBe(404);
  });

  it("entry's hashed chunk URLs all resolve to JS", async () => {
    // Build a page bundle that's known to have dynamic imports (chat
    // does — markdown-preview lazy-loads @cinder/markdown/rendering). The
    // entry response body must reference at least one hashed chunk URL,
    // and every referenced URL must resolve to 200 application/javascript.
    const entryResponse = await handleRequest(req('/page-bundle/chat.js'));
    expect(entryResponse.status).toBe(200);
    const body = await entryResponse.text();
    // Hashed chunks contain a hash segment after the last `-`; the
    // unhashed entry URL is just `<component>.js`. Match the hashed
    // shape with at least one dash and an alphanumeric tail.
    // A content-hashed chunk ends in `-<hash>.js` where the hash is a long
    // lowercase-alphanumeric content digest (Bun's `[name]-[hash]` naming).
    // Requiring that hash tail — rather than "any hyphenated segment" — avoids
    // matching a bare multi-word entry like `page-accordion-item.js`, which has
    // dashes but no hash and is served `no-store`, not `immutable`.
    const chunkUrls = Array.from(
      body.matchAll(/\/page-bundle\/[A-Za-z0-9_-]+-[a-z0-9]{8,}\.js/g),
      (match) => match[0],
    );
    expect(chunkUrls.length).toBeGreaterThan(0);
    const unique = Array.from(new Set(chunkUrls));
    for (const url of unique) {
      const chunkResponse = await handleRequest(req(url));
      expect(chunkResponse.status).toBe(200);
      expect(chunkResponse.headers.get('Content-Type')).toBe('application/javascript');
    }
  }, 60_000);
});

// HTTP caching contract for the bundle routes. Content-hashed chunk URLs are
// immutable (the hash changes when the bytes change), so they get a one-year
// immutable Cache-Control. The bare, unhashed entry URLs the browser requests
// directly (`/page-bundle/<component>.js`, `/shell-bundle/shell.js`,
// `/bundle/<name>/<scenario>.js`) point at whatever the latest build produced
// and must never be cached.
describe('Cache-Control headers on bundle routes', () => {
  const IMMUTABLE = 'public, max-age=31536000, immutable';
  const NO_STORE = 'no-store';

  it('serves the bare page-bundle entry URL with no-store', async () => {
    const response = await handleRequest(req(`/page-bundle/${FIXTURE_COMPONENT}.js`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
  }, 30_000);

  it('serves the shell-bundle entry URL with no-store', async () => {
    const response = await handleRequest(req('/shell-bundle/shell.js'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
  }, 30_000);

  it('serves the bare scenario bundle entry URL with no-store', async () => {
    const response = await handleRequest(
      req(`/bundle/${FIXTURE_COMPONENT}/${FIXTURE_SCENARIO}.js`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
  }, 30_000);

  it('serves content-hashed page-bundle chunks with an immutable Cache-Control', async () => {
    // `chat` lazy-loads markdown rendering, so its entry references at least
    // one hashed chunk. Warm the entry, extract a hashed chunk URL, then
    // assert the chunk response carries the immutable header. Hashed URLs
    // have a `-<hash>` segment; the bare entry URL (`chat.js`) does not.
    const entryResponse = await handleRequest(req('/page-bundle/chat.js'));
    expect(entryResponse.status).toBe(200);
    const body = await entryResponse.text();
    // A content-hashed chunk ends in `-<hash>.js` where the hash is a long
    // lowercase-alphanumeric content digest (Bun's `[name]-[hash]` naming).
    // Requiring that hash tail — rather than "any hyphenated segment" — avoids
    // matching a bare multi-word entry like `page-accordion-item.js`, which has
    // dashes but no hash and is served `no-store`, not `immutable`.
    const chunkUrls = Array.from(
      body.matchAll(/\/page-bundle\/[A-Za-z0-9_-]+-[a-z0-9]{8,}\.js/g),
      (match) => match[0],
    );
    expect(chunkUrls.length).toBeGreaterThan(0);

    const chunkResponse = await handleRequest(req(chunkUrls[0]!));
    expect(chunkResponse.status).toBe(200);
    expect(chunkResponse.headers.get('Cache-Control')).toBe(IMMUTABLE);
  }, 60_000);
});

// Bundle artifact paths must follow the predictable shapes the route
// handlers depend on. If Bun changes its no-`outdir` artifact path
// behavior (absolute paths, synthetic names), this test fails first and
// gives the maintainer a clear pointer to the route mapping.
describe('build artifact paths', () => {
  it('page-bundle entry response is non-empty JS', async () => {
    const response = await handleRequest(req('/page-bundle/chat.js'));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
    // Sanity: this is JavaScript, not HTML.
    expect(body).not.toMatch(/^<!doctype html/i);
  }, 60_000);

  it('chat entry chunk does not eagerly contain @shikijs/langs grammar payloads', async () => {
    // Phase 3 verification proxy: with code splitting on, the highlighter
    // stack should land in chunks, not in the entry. If a future change
    // reverts the lazy import or splitting breaks, the entry will balloon
    // back to multi-MB. This is a structural, not size-based, assertion.
    const response = await handleRequest(req('/page-bundle/chat.js'));
    const body = await response.text();
    // The bundled grammar files have a stable string fingerprint —
    // every @shikijs/langs/<lang>.mjs starts with `var <lang>_default = ...`
    // and references "scopeName". The entry should not contain a Shiki
    // language grammar inlined.
    const grammarMarkers = body.match(/scopeName/g) ?? [];
    expect(grammarMarkers.length).toBe(0);
  }, 60_000);
});

describe('/styles/* (path traversal guard)', () => {
  it('returns 200 text/css for /styles/index.css', async () => {
    const response = await handleRequest(req('/styles/index.css'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/css');
  });

  it('returns 200 text/css for /styles/foundation.css', async () => {
    const response = await handleRequest(req('/styles/foundation.css'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/css');
  });

  it('returns 404 for a path-traversal attempt with `..` segments', async () => {
    // Caught by the includes('..') pre-filter.
    const response = await handleRequest(req('/styles/../../../etc/passwd'));
    expect(response.status).toBe(404);
  });

  it('returns 404 when the request contains URL-encoded traversal sequences', async () => {
    // WHATWG URL parsing preserves %2E (does not decode it to '.'), so the
    // literal filename '%2E%2E%2F%2E%2E%2Fpasswd.css' never resolves to a
    // real file under STYLES_ROOT — the file-existence check returns 404.
    // Combined with the .css extension filter and the platform-safe
    // relativePath()/isAbsolute() containment guard, encoded traversal is
    // not a viable bypass.
    const response = await handleRequest(req('/styles/%2E%2E%2F%2E%2E%2Fpasswd.css'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for null-byte injection attempts', async () => {
    // The '.css'-extension guard rejects this before any file read happens
    // because '%00.png' makes the relative path end in '.png', not '.css'.
    const response = await handleRequest(req('/styles/index.css%00.png'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for an empty relative path', async () => {
    const response = await handleRequest(req('/styles/'));
    expect(response.status).toBe(404);
  });

  it('returns 404 when the requested path does not end in .css', async () => {
    const response = await handleRequest(req('/styles/index.html'));
    expect(response.status).toBe(404);
  });

  it('returns 404 when the requested file does not exist', async () => {
    const response = await handleRequest(req('/styles/this-file-does-not-exist.css'));
    expect(response.status).toBe(404);
  });
});

describe('/bundle/:name/:scenario.js', () => {
  it('returns 404 for a nonexistent example', async () => {
    const response = await handleRequest(req('/bundle/button/nonexistent.js'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for segments with uppercase (blocked by isSafeSegment)', async () => {
    const response = await handleRequest(req('/bundle/Button/primary.js'));
    expect(response.status).toBe(404);
  });

  it('returns 200 application/javascript for a known example', async () => {
    const response = await handleRequest(
      req(`/bundle/${FIXTURE_COMPONENT}/${FIXTURE_SCENARIO}.js`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/javascript');
  });

  it('returns the same bundle on repeated requests (cache hit)', async () => {
    const r1 = await handleRequest(req(`/bundle/${FIXTURE_COMPONENT}/${FIXTURE_SCENARIO}.js`));
    const r2 = await handleRequest(req(`/bundle/${FIXTURE_COMPONENT}/${FIXTURE_SCENARIO}.js`));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(await r1.text()).toBe(await r2.text());
  });
});

describe('/example-src/:name/:scenario', () => {
  it('returns 200 text/plain for a known example', async () => {
    const response = await handleRequest(
      req(`/example-src/${FIXTURE_COMPONENT}/${FIXTURE_SCENARIO}`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    const source = await response.text();
    expect(source).toContain('Button');
  });

  it('returns 404 for a nonexistent example', async () => {
    const response = await handleRequest(req('/example-src/button/nonexistent'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for segments with uppercase (blocked by isSafeSegment)', async () => {
    const response = await handleRequest(req('/example-src/Button/primary'));
    expect(response.status).toBe(404);
  });
});

describe('/events (SSE)', () => {
  it('returns 200 with text/event-stream and sends initial handshake', async () => {
    const response = await handleRequest(req('/events'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    // Consume and verify the initial handshake comment.
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    // The stream enqueues strings; Bun may deliver them as string or Uint8Array.
    const text = value instanceof Uint8Array ? new TextDecoder().decode(value) : String(value);
    expect(text).toContain(': connected');
    reader.cancel();
  });
});

describe('triggerReload', () => {
  it('does not throw when no clients are connected', () => {
    expect(() => triggerReload()).not.toThrow();
  });

  it('removes dead controllers from sseClients without throwing', async () => {
    const response = await handleRequest(req('/events'));
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(() => triggerReload()).not.toThrow();
  });

  // The shell SPA's EventSource listener branches on the event-type line of
  // the SSE record. If the wire format ever drifts (typo, casing, missing
  // newlines), live-reload silently breaks. These tests pin the format.
  it("emits the literal 'event: reload' line for the default event type", async () => {
    const response = await handleRequest(req('/events'));
    const reader = response.body!.getReader();
    await reader.read(); // consume handshake comment

    triggerReload();

    const { value } = await reader.read();
    const text = value instanceof Uint8Array ? new TextDecoder().decode(value) : String(value);
    expect(text).toContain('event: reload');
    expect(text).toContain('data: {}');
    await reader.cancel();
  });

  it("emits 'event: shell-reload' when called with shell-reload", async () => {
    const response = await handleRequest(req('/events'));
    const reader = response.body!.getReader();
    await reader.read();

    triggerReload('shell-reload');

    const { value } = await reader.read();
    const text = value instanceof Uint8Array ? new TextDecoder().decode(value) : String(value);
    expect(text).toContain('event: shell-reload');
    expect(text).toContain('data: {}');
    await reader.cancel();
  });

  it('does not throw when shell-reload is dispatched with no connected clients', () => {
    expect(() => triggerReload('shell-reload')).not.toThrow();
  });
});

describe('unknown routes', () => {
  it('returns 404 for arbitrary paths', async () => {
    const response = await handleRequest(req('/not-a-real-path'));
    expect(response.status).toBe(404);
  });
});

describe('isSafeSegment (via route behavior)', () => {
  it('rejects segments with uppercase letters', async () => {
    const r1 = await handleRequest(req('/c/Button'));
    expect(r1.status).toBe(404);
    const r2 = await handleRequest(req('/bundle/Button/primary.js'));
    expect(r2.status).toBe(404);
  });

  it('rejects segments containing special characters', async () => {
    const response = await handleRequest(req('/c/bad%20name'));
    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// /page/:name — component page (iframe content) + snapshot mode
// ---------------------------------------------------------------------------

describe('/page/:name', () => {
  it('returns 200 HTML for a known component', async () => {
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/html');
    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('id="app"');
  });

  it('returns 404 for an unknown component', async () => {
    const response = await handleRequest(req('/page/does-not-exist'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for a segment that fails isSafeSegment', async () => {
    const response = await handleRequest(req('/page/Button'));
    expect(response.status).toBe(404);
  });

  it('does NOT include data-snapshot-mode on <html> without ?snapshot=1', async () => {
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}`));
    const html = await response.text();
    expect(html).not.toContain('data-snapshot-mode');
  });

  it('includes data-snapshot-mode on <html> with ?snapshot=1', async () => {
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}?snapshot=1`));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('data-snapshot-mode');
    // The attribute must appear on the opening <html> tag, before first paint.
    const htmlTagMatch = html.match(/<html[^>]*>/);
    expect(htmlTagMatch).not.toBeNull();
    expect(htmlTagMatch![0]).toContain('data-snapshot-mode');
  });

  it('injects the snapshot-mode <style> tag with ?snapshot=1', async () => {
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}?snapshot=1`));
    const html = await response.text();
    expect(html).toContain('id="cinder-snapshot-mode"');
    expect(html).toContain('animation-duration: 0s');
    expect(html).toContain('caret-color: transparent');
  });

  it('does NOT inject the snapshot-mode <style> tag without ?snapshot=1', async () => {
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}`));
    const html = await response.text();
    expect(html).not.toContain('id="cinder-snapshot-mode"');
    expect(html).not.toContain('caret-color: transparent');
  });

  it('does not activate snapshot mode for snapshot=true (strict equality)', async () => {
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}?snapshot=true`));
    const html = await response.text();
    expect(html).not.toContain('data-snapshot-mode');
  });

  it('does not activate snapshot mode for snapshot=yes', async () => {
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}?snapshot=yes`));
    const html = await response.text();
    expect(html).not.toContain('data-snapshot-mode');
  });

  it('loads the full CSS aggregator (styles/all.css) so component styles are present', async () => {
    // The component preview iframe must load `cinder/styles/all` (tokens +
    // foundation + ALL per-component CSS) rather than the slim base
    // (`cinder/styles` / index.css). After the per-component subpath split,
    // index.css only contains tokens/foundation/utilities — omitting it here
    // would leave every component unstyled in the Playwright preview, breaking
    // visual snapshots, positioning assertions, and accessibility checks.
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}`));
    const html = await response.text();
    expect(html).toContain('href="/styles/all.css"');
    expect(html).not.toContain('href="/styles/index.css"');
  });

  it('checker background uses theme-adaptive custom properties, not hardcoded colors', async () => {
    // Regression: the checker squares were hardcoded #e0e0e0 on a #fff base,
    // which is blinding in dark mode. The pattern must adapt via light-dark()
    // and the --cinder-surface token so it reads as a transparency checker in
    // both schemes without any JS.
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}`));
    const html = await response.text();
    const checkerBlockMatch = /body\[data-cinder-bg="checker"\]\s*\{[^}]*\}/.exec(html);
    expect(checkerBlockMatch).not.toBeNull();
    const checkerBlock = checkerBlockMatch![0];
    expect(checkerBlock).not.toContain('#fff');
    expect(checkerBlock).not.toContain('#e0e0e0');
    expect(checkerBlock).toContain('light-dark(');
    expect(checkerBlock).toContain('var(--cinder-surface)');
    // Geometry must stay a 16px grid checker.
    expect(checkerBlock).toContain('background-size: 16px 16px');
  });

  it('wraps the body background/color transition in a reduced-motion guard', async () => {
    // The crossfade must only run when the user has not requested reduced
    // motion, so the unguarded `transition: background ...` is gone.
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}`));
    const html = await response.text();
    const guardMatch =
      /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[^}]*body\s*\{[^}]*transition:\s*background[^}]*\}/.exec(
        html,
      );
    expect(guardMatch).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// /page/:name — __CINDER_EXAMPLES__ inline-script escaping (regression for the
// ecb46fa0 bug: renderComponentPage embedded the examples payload with a raw
// JSON.stringify, so a `</script>` inside an example title/description closed
// the inline <script> early and could inject markup. The fix routes the
// payload through jsonForScriptTag, the same escaper used for the shell data
// island. Verified at two levels: the escaping policy itself, and the live page.
// ---------------------------------------------------------------------------

describe('/page/:name — __CINDER_EXAMPLES__ script-tag escaping', () => {
  it('jsonForScriptTag neutralizes </script> inside an examples-shaped payload', () => {
    const examples = [
      {
        scenario: 'malicious',
        title: 'Closes early</script><script>alert(1)</script>',
        description: 'Also nasty: </script> & <img src=x onerror=alert(1)>',
      },
    ];

    const encoded = jsonForScriptTag(examples);

    // No raw markup characters survive — `<`, `>`, and `&` are all \uXXXX-escaped,
    // so the payload cannot terminate the inline script or open a new element.
    expect(encoded).not.toContain('<');
    expect(encoded).not.toContain('>');
    expect(encoded).not.toContain('&');
    expect(encoded.toLowerCase()).not.toContain('</script');
    expect(encoded).toContain('\\u003c'); // < was escaped
    expect(encoded).toContain('\\u003e'); // > was escaped

    // Still valid JSON that round-trips back to the original data.
    expect(JSON.parse(encoded)).toEqual(examples);
  });

  it('embeds the live examples payload with no raw markup chars in the inline script', async () => {
    const response = await handleRequest(req(`/page/${FIXTURE_COMPONENT}`));
    const html = await response.text();

    // Isolate the __CINDER_EXAMPLES__ assignment (from `window.` to the
    // terminating `;</script>` that legitimately closes that inline script).
    const start = html.indexOf('window.__CINDER_EXAMPLES__');
    expect(start).toBeGreaterThanOrEqual(0);
    const closer = html.indexOf('</script>', start);
    expect(closer).toBeGreaterThan(start);
    const assignment = html.slice(start, closer);

    // The payload (everything after `= `) must carry no raw `<`, `>`, or `&` —
    // those would mean a future example string could break out of the script.
    const payload = assignment.slice(assignment.indexOf('= ') + 2);
    expect(payload).not.toContain('<');
    expect(payload).not.toContain('>');
    expect(payload).not.toContain('&');

    // The assignment still parses as JSON once the trailing `;` is dropped.
    const json = payload.trimEnd().replace(/;$/, '');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Wave 2: manifest and controls-bundle routes
// ---------------------------------------------------------------------------

describe('/api/manifest', () => {
  it('returns 200 application/json', async () => {
    const response = await handleRequest(req('/api/manifest'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  }, 30_000);

  it('returns an array with at least 21 entries', async () => {
    const response = await handleRequest(req('/api/manifest'));
    const manifests = (await response.json()) as unknown[];
    expect(Array.isArray(manifests)).toBe(true);
    expect(manifests.length).toBeGreaterThanOrEqual(21);
  }, 30_000);

  it('each entry has name, kebabName, file, importPath, and props array', async () => {
    const response = await handleRequest(req('/api/manifest'));
    const manifests = (await response.json()) as ComponentManifest[];
    for (const entry of manifests) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.kebabName).toBe('string');
      expect(typeof entry.file).toBe('string');
      expect(typeof entry.importPath).toBe('string');
      expect(Array.isArray(entry.props)).toBe(true);
    }
  }, 30_000);

  it('includes button in the manifest', async () => {
    const response = await handleRequest(req('/api/manifest'));
    const manifests = (await response.json()) as ComponentManifest[];
    const button = manifests.find((entry) => entry.kebabName === 'button');
    expect(button).toBeDefined();
  }, 30_000);
});

describe('/api/manifest/:name', () => {
  it('returns 200 for a known component (button)', async () => {
    const response = await handleRequest(req('/api/manifest/button'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  }, 30_000);

  it('returns parsed JSON with name=Button and kebabName=button', async () => {
    const response = await handleRequest(req('/api/manifest/button'));
    const result = (await response.json()) as ComponentManifest;
    expect(result.name).toBe('Button');
    expect(result.kebabName).toBe('button');
  }, 30_000);

  it('returns 404 for an unknown component', async () => {
    const response = await handleRequest(req('/api/manifest/does-not-exist'));
    expect(response.status).toBe(404);
  }, 30_000);

  it('returns 404 for segments with uppercase (isSafeSegment blocked)', async () => {
    const response = await handleRequest(req('/api/manifest/Button'));
    expect(response.status).toBe(404);
  }, 30_000);
});

describe('/bundle/:name/controls.js (route retired)', () => {
  // The Try-it controls bundle was removed alongside the controls panel —
  // playground pages show only static authored scenarios. No route handles
  // `controls.js`; the request falls through to the generic scenario
  // bundler, which 404s because there is no `controls.example.svelte` file.

  it('returns 404 — no scenario bundle by that name', async () => {
    const response = await handleRequest(req('/bundle/button/controls.js'));
    expect(response.status).toBe(404);
  }, 30_000);

  it('returns 404 for an unknown component', async () => {
    const response = await handleRequest(req('/bundle/does-not-exist/controls.js'));
    expect(response.status).toBe(404);
  }, 30_000);

  it('returns 404 for unsafe segment (uppercase)', async () => {
    const response = await handleRequest(req('/bundle/Button/controls.js'));
    expect(response.status).toBe(404);
  }, 30_000);
});
