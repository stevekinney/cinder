/**
 * Unit tests for `scripts/playground/server.ts` route handlers.
 *
 * Uses handleRequest directly (no live server) for route-level coverage.
 * The triggerReload / SSE integration path is covered by validate-playground.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { handleRequest, triggerReload } from './server.ts';

function req(path: string, options?: RequestInit): Request {
  return new Request(`http://localhost:4173${path}`, options);
}

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
    // The file exists in this repo, so we expect 200.
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
    expect(html).toContain('<nav>');
  });

  it('returns 404 for an unknown component', async () => {
    const response = await handleRequest(req('/c/does-not-exist'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for segments with uppercase (not in safe-segment pattern)', async () => {
    const response = await handleRequest(req('/c/Button'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for segments starting with a digit in wrong pattern', async () => {
    // Component names must match /^[a-z0-9][a-z0-9-]*$/ and exist in allowlist.
    const response = await handleRequest(req('/c/9button'));
    expect(response.status).toBe(404);
  });
});

describe('/bundle/:name/:scenario.js', () => {
  it('returns 404 for a nonexistent example', async () => {
    const response = await handleRequest(req('/bundle/button/nonexistent.js'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for segments with uppercase (blocked by isSafeSegment)', async () => {
    // URL parser normalizes .. away, so test actual unsafe chars instead.
    const response = await handleRequest(req('/bundle/Button/primary.js'));
    expect(response.status).toBe(404);
  });

  it('returns 200 application/javascript for a known example', async () => {
    // button/primary.example.svelte exists in this repo
    const response = await handleRequest(req('/bundle/button/primary.js'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/javascript');
  });
});

describe('/example-src/:name/:scenario', () => {
  it('returns 200 text/plain for a known example', async () => {
    const response = await handleRequest(req('/example-src/button/primary'));
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
  it('returns 200 with text/event-stream', async () => {
    const response = await handleRequest(req('/events'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    // Consume and verify the initial handshake comment.
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    // The controller enqueues strings; coerce to string regardless of chunk type.
    const text = typeof value === 'string' ? value : new TextDecoder().decode(value as Uint8Array);
    expect(text).toContain(': connected');
    reader.cancel();
  });
});

describe('triggerReload', () => {
  it('does not throw when no clients are connected', () => {
    expect(() => triggerReload()).not.toThrow();
  });

  it('removes dead controllers from sseClients without throwing', async () => {
    // Connect a client, then immediately close the stream and trigger reload.
    const response = await handleRequest(req('/events'));
    const reader = response.body!.getReader();
    // Consume the initial handshake.
    await reader.read();
    // Cancel the reader (simulates client disconnect).
    await reader.cancel();
    // triggerReload should not throw even though the controller is dead.
    expect(() => triggerReload()).not.toThrow();
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

  it('rejects segments starting with a hyphen', async () => {
    const response = await handleRequest(req('/c/-bad'));
    expect(response.status).toBe(404);
  });

  it('rejects segments containing special characters', async () => {
    const response = await handleRequest(req('/c/bad%20name'));
    expect(response.status).toBe(404);
  });
});

describe('beforeEach/afterEach cleanup', () => {
  // Verify the bundle cache doesn't leak between tests by checking
  // that repeated requests for the same bundle produce the same content.
  let firstResponse: string;

  beforeEach(async () => {
    const r = await handleRequest(req('/bundle/button/primary.js'));
    if (r.status === 200) {
      firstResponse = await r.text();
    }
  });

  afterEach(() => {
    firstResponse = '';
  });

  it('serves the same bundle content on repeated requests (cache hit)', async () => {
    const r = await handleRequest(req('/bundle/button/primary.js'));
    if (r.status === 200) {
      expect(await r.text()).toBe(firstResponse);
    }
  });
});
