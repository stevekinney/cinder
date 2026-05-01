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

import { beforeAll, describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import type { ComponentManifest } from './analyze.ts';
import { PORT, handleRequest, triggerReload } from './server.ts';

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

function req(path: string, options?: RequestInit): Request {
  return new Request(`http://localhost:${PORT}${path}`, options);
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

  it('returns 404 for segments starting with a hyphen', async () => {
    const response = await handleRequest(req('/c/-bad'));
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

  it('returns 404 when join() resolves outside STYLES_ROOT (encoded traversal)', async () => {
    // URL-encoded ".." segments that survive into the relative path until
    // join() canonicalizes them. The cssPath.startsWith(STYLES_ROOT + '/')
    // guard is the load-bearing fence here — without the trailing slash the
    // adjacent-prefix bypass at /x/styles vs /x/styles-evil would slip past.
    const response = await handleRequest(req('/styles/%2E%2E%2F%2E%2E%2Fpasswd.css'));
    expect(response.status).toBe(404);
  });

  it('returns 404 for null-byte injection attempts', async () => {
    // Defense-in-depth: ensure %00 doesn't truncate the path inside Bun.file.
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
