import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { playwrightArguments, verifyStaticArtifact } from './check-static-playground.ts';
import { startStaticServer } from './static-playground-server.ts';

const VERCEL_CONFIG = {
  cleanUrls: true,
  rewrites: [{ source: '/', destination: '/index.html' }],
  redirects: [{ source: '/c/:name', destination: '/page/:name', statusCode: 301 }],
  headers: [
    {
      source: '/assets/(.*)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    { source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
  ],
};

type Fixture = { root: string; directory: string };
type FixtureMetadata = { exportDurationMs: number; rssBytes: number; rssMiB: number };

async function fixture(
  metadata: FixtureMetadata = { exportDurationMs: 10, rssBytes: 1024, rssMiB: 0.0009765625 },
): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'cinder-static-playground-'));
  const directory = join(root, 'public');
  await mkdir(directory, { recursive: true });
  await mkdir(join(directory, 'page', 'button'), { recursive: true });
  await mkdir(join(directory, 'assets', 'abc'), { recursive: true });
  const document = (name: string, path: string) =>
    `<!doctype html><html><head><title>${name}</title><meta name="description" content="${name} docs"><link rel="canonical" href="https://cinder.website${path}"><link rel="stylesheet" href="/assets/abc/site.css"><script type="module" src="/assets/abc/app.js"></script></head><body><main data-component-page><h1>${name}</h1><p>Rendered documentation</p><a href="/page/button">Button</a><div class="example-preview"><h2>Preview heading</h2></div></main></body></html>`;
  await writeFile(join(directory, 'index.html'), document('Cinder', '/'));
  await writeFile(
    join(directory, 'page', 'button', 'index.html'),
    document('Button', '/page/button'),
  );
  await writeFile(join(directory, 'assets', 'abc', 'app.js'), 'console.log("fixture");');
  await writeFile(join(directory, 'assets', 'abc', 'site.css'), 'body { color: black; }');
  const sourceSha = Bun.spawnSync(['git', 'rev-parse', 'HEAD']).stdout.toString().trim();
  await writeFile(
    join(directory, 'static-inventory.json'),
    JSON.stringify({ version: 1, sourceSha, routes: ['/', '/page/button'] }),
  );
  await writeFile(
    join(directory, '..', 'static-export-metadata.json'),
    JSON.stringify({
      version: 1,
      sourceSha,
      ...metadata,
      rssSample: 'export-completion',
    }),
  );
  return { root, directory };
}

describe('verifyStaticArtifact', () => {
  test('passes the deterministic shard through to Playwright', () => {
    expect(playwrightArguments({ index: 3, total: 8 })).toContain('--shard=3/8');
    expect(playwrightArguments({ index: 1, total: 1 })).not.toContain('--shard=1/1');
  });
  test('rejects unknown, duplicate, and incompatible command flags before artifact work', () => {
    for (const argumentsList of [
      ['--directory', '/tmp/missing', '--unknown'],
      ['--directory', '/tmp/missing', '--directory', '/tmp/other'],
      ['--directory', '/tmp/missing', '--verify-only', '--shard=1/8'],
    ]) {
      const result = Bun.spawnSync([
        'bun',
        'run',
        'packages/testing/scripts/check-static-playground.ts',
        '--',
        ...argumentsList,
      ]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toMatch(/static-playground/);
    }
  });
  test('applies wildcard security headers to redirects and missing routes', async () => {
    const { root, directory } = await fixture();
    try {
      const server = await startStaticServer(directory, VERCEL_CONFIG);
      try {
        for (const [path, status] of [
          ['/c/button', 301],
          ['/missing', 404],
        ] as const) {
          const response = await fetch(`${server.origin}${path}`, { redirect: 'manual' });
          expect(response.status).toBe(status);
          expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
          await response.arrayBuffer();
        }
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fails a copied artifact when a required asset is missing', async () => {
    const { root, directory } = await fixture();
    try {
      await rm(join(directory, 'assets', 'abc', 'app.js'));
      await expect(
        verifyStaticArtifact({
          directory,
          vercelConfig: VERCEL_CONFIG,
          origin: 'https://cinder.website',
        }),
      ).rejects.toThrow(/missing required asset.*assets\/abc\/app\.js/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fails a copied artifact when a prerendered document is replaced', async () => {
    const { root, directory } = await fixture();
    try {
      await writeFile(
        join(directory, 'page', 'button', 'index.html'),
        '<!doctype html><html><body><div id="app"></div></body></html>',
      );
      await expect(
        verifyStaticArtifact({
          directory,
          vercelConfig: VERCEL_CONFIG,
          origin: 'https://cinder.website',
        }),
      ).rejects.toThrow(/page\/button.*(h1|title|description|canonical|prerender)/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fails a copied artifact when an inventoried canonical route is deleted', async () => {
    const { root, directory } = await fixture();
    try {
      await rm(join(directory, 'page', 'button'), { recursive: true, force: true });
      await expect(
        verifyStaticArtifact({
          directory,
          vercelConfig: VERCEL_CONFIG,
          origin: 'https://cinder.website',
        }),
      ).rejects.toThrow(/inventory route count or contents drifted/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('accepts a valid copied artifact and returns deterministic file digests', async () => {
    const { root, directory } = await fixture();
    try {
      const first = await verifyStaticArtifact({
        directory,
        vercelConfig: VERCEL_CONFIG,
        origin: 'https://cinder.website',
      });
      const second = await verifyStaticArtifact({
        directory,
        vercelConfig: VERCEL_CONFIG,
        origin: 'https://cinder.website',
      });
      expect(first.routes).toEqual(['/', '/page/button']);
      expect(first.manifest).toEqual(second.manifest);
      expect(first.manifest.find((entry) => entry.path === '/assets/abc/app.js')?.sha256).toMatch(
        /^[a-f0-9]{64}$/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects a copied artifact when an example contributes a second h1', async () => {
    const { root, directory } = await fixture();
    try {
      const path = join(directory, 'page', 'button', 'index.html');
      const html = await Bun.file(path).text();
      await writeFile(path, html.replace('<h2>Preview heading</h2>', '<h1>Preview heading</h1>'));
      await expect(
        verifyStaticArtifact({
          directory,
          vercelConfig: VERCEL_CONFIG,
          origin: 'https://cinder.website',
        }),
      ).rejects.toThrow(/expected exactly one document-owned h1/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('does not serve a symlinked file outside the artifact root', async () => {
    const { root, directory } = await fixture();
    const outside = await mkdtemp(join(tmpdir(), 'cinder-static-sentinel-'));
    try {
      await writeFile(join(outside, 'sentinel.js'), 'window.sentinel = true;');
      await symlink(join(outside, 'sentinel.js'), join(directory, 'assets', 'abc', 'sentinel.js'));
      const server = await startStaticServer(directory, VERCEL_CONFIG);
      try {
        const response = await fetch(`${server.origin}/assets/abc/sentinel.js`);
        expect(response.status).toBe(404);
        expect(await Bun.file(join(outside, 'sentinel.js')).text()).toContain('sentinel');
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  test('does not redirect malformed multi-segment legacy paths', async () => {
    const { root, directory } = await fixture();
    try {
      const server = await startStaticServer(directory, VERCEL_CONFIG);
      try {
        const response = await fetch(`${server.origin}/c/a/b`, { redirect: 'manual' });
        expect(response.status).toBe(404);
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects unsupported static host routing configuration', async () => {
    const { root, directory } = await fixture();
    try {
      await expect(
        startStaticServer(directory, { ...VERCEL_CONFIG, rewrites: [] }),
      ).rejects.toThrow('unsupported rewrite configuration');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('keeps sibling metadata isolated between concurrent fixtures', async () => {
    const first = await fixture({ exportDurationMs: 11, rssBytes: 1100, rssMiB: 0.001 });
    const second = await fixture({ exportDurationMs: 22, rssBytes: 2200, rssMiB: 0.002 });
    try {
      const [firstReport, secondReport] = await Promise.all([
        verifyStaticArtifact({
          directory: first.directory,
          vercelConfig: VERCEL_CONFIG,
          origin: 'https://cinder.website',
        }),
        verifyStaticArtifact({
          directory: second.directory,
          vercelConfig: VERCEL_CONFIG,
          origin: 'https://cinder.website',
        }),
      ]);
      expect(firstReport.exportDurationMs).toBe(11);
      expect(firstReport.rssBytes).toBe(1100);
      expect(secondReport.exportDurationMs).toBe(22);
      expect(secondReport.rssBytes).toBe(2200);
    } finally {
      await Promise.all([
        rm(first.root, { recursive: true, force: true }),
        rm(second.root, { recursive: true, force: true }),
      ]);
    }
  });
});
