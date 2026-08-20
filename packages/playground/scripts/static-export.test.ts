import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { fingerprintStaticAssets } from './static-asset-fingerprints.ts';
import {
  assertDocumentationMetadata,
  assertDocumentationPagesArePreRendered,
  assertExactlyOneH1,
  assertSafeOutputDirectory,
  assertSitemapMatchesRoutes,
  assetUrlsFromHtml,
  requireProductionBaseUrl,
  runStaticExport,
} from './static-export.ts';

test('content-addresses static assets and rewrites HTML, JS, and CSS references', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'cinder-static-assets-'));
  try {
    await mkdir(join(outputDirectory, 'styles'), { recursive: true });
    await writeFile(
      join(outputDirectory, 'index.html'),
      '<link rel="stylesheet" href="/styles/site.css"><script src="/app.js"></script><img src="/social.png">',
    );
    await writeFile(join(outputDirectory, 'app.js'), 'import "/styles/site.css";');
    await writeFile(join(outputDirectory, 'social.png'), new Uint8Array([137, 80, 78, 71]));
    await writeFile(join(outputDirectory, 'styles', 'site.css'), "@import './tokens.css';");
    await writeFile(join(outputDirectory, 'styles', 'tokens.css'), ':root { color: canvas; }');

    const { fingerprintedUrlBySourceUrl } = await fingerprintStaticAssets(outputDirectory);
    const siteStylesheet = fingerprintedUrlBySourceUrl.get('/styles/site.css')!;
    const tokensStylesheet = fingerprintedUrlBySourceUrl.get('/styles/tokens.css')!;
    const script = fingerprintedUrlBySourceUrl.get('/app.js')!;
    const socialImage = fingerprintedUrlBySourceUrl.get('/social.png')!;

    expect(siteStylesheet).toMatch(/^\/assets\/[a-f0-9]{64}\/styles\/site\.css$/);
    expect(await Bun.file(join(outputDirectory, 'styles', 'site.css')).exists()).toBe(false);
    expect(await Bun.file(join(outputDirectory, siteStylesheet.slice(1))).text()).toContain(
      tokensStylesheet,
    );
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    expect(html).toContain(siteStylesheet);
    expect(html).toContain(script);
    expect(html).toContain(socialImage);
    expect(await Bun.file(join(outputDirectory, script.slice(1))).text()).toContain(siteStylesheet);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('changes every immutable asset URL when its static asset set changes', async () => {
  const firstOutput = await mkdtemp(join(tmpdir(), 'cinder-static-assets-first-'));
  const secondOutput = await mkdtemp(join(tmpdir(), 'cinder-static-assets-second-'));
  try {
    await Promise.all(
      [firstOutput, secondOutput].map(async (outputDirectory, index) => {
        await writeFile(join(outputDirectory, 'index.html'), '<script src="/app.js"></script>');
        await writeFile(join(outputDirectory, 'app.js'), `console.log(${index});`);
      }),
    );
    const first = await fingerprintStaticAssets(firstOutput);
    const second = await fingerprintStaticAssets(secondOutput);

    expect(first.fingerprintedUrlBySourceUrl.get('/app.js')).not.toBe(
      second.fingerprintedUrlBySourceUrl.get('/app.js'),
    );
  } finally {
    await rm(firstOutput, { recursive: true, force: true });
    await rm(secondOutput, { recursive: true, force: true });
  }
});

test('requires a clean absolute HTTPS base URL for the deploy build', () => {
  expect(() => requireProductionBaseUrl('')).toThrow('absolute HTTPS URL');
  expect(() => requireProductionBaseUrl('http://cinder.website')).toThrow('absolute HTTPS origin');
  expect(() => requireProductionBaseUrl('https://cinder.website/docs')).toThrow('without a path');
  expect(requireProductionBaseUrl('https://cinder.website/')).toBe('https://cinder.website');
});

test('refuses a filesystem root as static export output', () => {
  expect(() => assertSafeOutputDirectory('/')).toThrow('filesystem root');
});

test('rejects sitemap route drift and duplicate URLs', () => {
  const baseUrl = 'https://cinder.website';
  const routes = ['/', '/page/button'];
  const valid = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset><url><loc>https://cinder.website/</loc></url><url><loc>https://cinder.website/page/button</loc></url></urlset>`;
  expect(() => assertSitemapMatchesRoutes(valid, baseUrl, routes)).not.toThrow();
  expect(() =>
    assertSitemapMatchesRoutes(valid.replace('/page/button', '/page/card'), baseUrl, routes),
  ).toThrow('missing');
});

test('rejects duplicate canonical tags and malformed JSON-LD', () => {
  const html = [
    '<link rel="canonical" href="https://cinder.website/page/button" />',
    '<meta property="og:url" content="https://cinder.website/page/button" />',
    '<meta property="og:image" content="https://cinder.website/social.png" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="Button" />',
    '<meta name="twitter:description" content="Button docs" />',
    '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
  ].join('');
  expect(() =>
    assertDocumentationMetadata('button', html, 'https://cinder.website', '/page/button'),
  ).not.toThrow();
  expect(() =>
    assertDocumentationMetadata(
      'button',
      `${html}<link rel="canonical" href="https://cinder.website/page/button" />`,
      'https://cinder.website',
      '/page/button',
    ),
  ).toThrow('one canonical');

  let malformedJsonLdError: unknown;
  try {
    assertDocumentationMetadata(
      'button',
      html.replace('{"@context":"https://schema.org"}', '{'),
      'https://cinder.website',
      '/page/button',
    );
  } catch (error) {
    malformedJsonLdError = error;
  }
  expect(malformedJsonLdError).toBeInstanceOf(Error);
  expect((malformedJsonLdError as Error).cause).toBeInstanceOf(SyntaxError);
});

test('HTML asset discovery normalizes query-configured routes to one static path', () => {
  expect(assetUrlsFromHtml('<iframe src="/page/button?preview=1"></iframe>')).toEqual([
    '/page/button',
  ]);
});

test('HTML asset discovery ignores navigation anchors', () => {
  /*
   * Anchors are navigation, not subresources. Since the documentation pages
   * became server-rendered, their markup carries example content with
   * illustrative links — `examples/side-navigation/basic.example.svelte` renders
   * `href="/projects/atlas"`. `render()` throws on any non-2xx, so crawling
   * anchors failed the entire export with `/projects/atlas → HTTP 404`.
   *
   * Real routes are enumerated explicitly by runStaticExport, so dropping
   * anchors costs no coverage.
   */
  expect(
    assetUrlsFromHtml(
      '<a href="/projects/atlas">Atlas</a><a href="/c/button">Button</a><nav><a href="/page/badge">Badge</a></nav>',
    ),
  ).toEqual([]);
});

test('HTML asset discovery collects stylesheets, scripts, and media', () => {
  const urls = assetUrlsFromHtml(
    [
      '<link rel="stylesheet" href="/styles/shell.css" />',
      '<link href="/styles/all.css" rel="stylesheet" />',
      '<script type="module" src="/shell-bundle/shell.js"></script>',
      '<img src="/social.png" alt="" />',
      '<iframe src="/page/button?preview=1"></iframe>',
      '<a href="/should-be-ignored">nope</a>',
    ].join(''),
  );

  expect(urls).toEqual([
    '/styles/shell.css',
    '/styles/all.css',
    '/shell-bundle/shell.js',
    '/social.png',
    '/page/button',
  ]);
});

test('HTML asset discovery skips the SSE stream, which has no static form', () => {
  expect(assetUrlsFromHtml('<script src="/events"></script>')).toEqual([]);
});

test('HTML asset discovery does not carry regex state between calls', () => {
  // A shared `/g` regex would resume from the previous call's lastIndex and miss
  // the first match on the second invocation.
  const html = '<link rel="stylesheet" href="/styles/shell.css" />';

  expect(assetUrlsFromHtml(html)).toEqual(['/styles/shell.css']);
  expect(assetUrlsFromHtml(html)).toEqual(['/styles/shell.css']);
});

describe('static export', () => {
  test('writes the root landing shell instead of a redirect', async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), 'cinder-static-export-'));
    try {
      const rendered = await runStaticExport({
        outputDirectory,
        sidebarComponents: ['button'],
        allComponents: [],
      });
      const indexHtml = await readFile(join(outputDirectory, 'index.html'), 'utf8');

      expect(indexHtml).toContain('id="shell-root"');
      expect(indexHtml).toContain('id="cinder-initial"');
      expect(indexHtml).toContain('readmeHtml');
      expect(indexHtml).toMatch(/\/assets\/[a-f0-9]{64}\/shell-bundle\/shell\.js/);
      expect(indexHtml).toMatch(/\/assets\/[a-f0-9]{64}\/playground-styles\/landing\.css/);
      expect(indexHtml).not.toContain('http-equiv="refresh"');
      expect([...rendered].some((url) => url.endsWith('/shell-bundle/shell.js'))).toBe(true);
      expect(indexHtml).not.toContain('data-canonical-documentation');
      expect(indexHtml).toContain('<link rel="canonical" href="https://playground.local/" />');
      expect(indexHtml).toContain('<script type="application/ld+json">');
      expect([...rendered].some((url) => url.endsWith('/social.png'))).toBe(true);
      expect(rendered.has('/sitemap.xml')).toBe(true);
      expect(rendered.has('/robots.txt')).toBe(true);
      const socialImageUrl = [...rendered].find((url) => url.endsWith('/social.png'));
      if (socialImageUrl === undefined) throw new Error('missing fingerprinted social image');
      const socialImage = new Uint8Array(
        await readFile(join(outputDirectory, socialImageUrl.slice(1))),
      );
      expect([...socialImage.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      await expect(readFile(join(outputDirectory, 'sitemap.xml'), 'utf8')).resolves.toContain(
        'https://playground.local/page/button',
      );
      await expect(readFile(join(outputDirectory, 'robots.txt'), 'utf8')).resolves.toContain(
        'Sitemap: https://playground.local/sitemap.xml',
      );
      expect([...rendered].some((url) => url.endsWith('/playground-styles/landing.css'))).toBe(
        true,
      );
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }, 90_000);

  test('materializes extracted Chat routes, bundles, documentation, and styles', async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), 'cinder-static-export-chat-'));
    try {
      const rendered = await runStaticExport({
        outputDirectory,
        sidebarComponents: ['chat'],
        allComponents: ['chat', 'chat-composer-popover', 'chat-conversation-header'],
      });
      const pageHtml = await readFile(join(outputDirectory, 'page', 'chat', 'index.html'), 'utf8');
      const readFingerprintedAsset = async (suffix: string): Promise<string> => {
        const url = [...rendered].find((candidate) => candidate.endsWith(suffix));
        if (url === undefined) throw new Error(`missing fingerprinted ${suffix}`);
        return readFile(join(outputDirectory, url.slice(1)), 'utf8');
      };
      const chatStyles = await readFingerprintedAsset('/package-components/chat/chat/chat.css');
      const composerStyles = await readFingerprintedAsset(
        '/package-components/chat/chat-composer-popover/chat-composer-popover.css',
      );
      const headerStyles = await readFingerprintedAsset(
        '/package-components/chat/chat-conversation-header/chat-conversation-header.css',
      );

      expect(pageHtml).toMatch(/\/assets\/[a-f0-9]{64}\/page-bundle\/chat\.js/);
      expect(pageHtml).toMatch(/\/assets\/[a-f0-9]{64}\/package-components\/chat\/chat\/chat\.css/);
      expect(pageHtml).toContain('id="cinder-documentation"');
      expect(pageHtml).toContain('\\u003cp');

      // The canonical documentation page IS /page/<name> now; /c/ is redirected
      // by vercel.json and never written to disk.
      expect(rendered.has('/c/chat')).toBe(false);
      expect(pageHtml).toContain('data-component-page');
      expect(pageHtml).toMatch(/<h1[^>]*>.*Chat.*<\/h1>/s);
      expect(rendered.has('/page/chat?preview=1')).toBe(false);
      expect(chatStyles).toContain('.cinder-chat');
      expect(composerStyles).toMatch(
        /@import '\/assets\/[a-f0-9]{64}\/components\/command-menu\/command-menu\.css';/,
      );
      expect(headerStyles).toMatch(
        /@import '\/assets\/[a-f0-9]{64}\/components\/dropdown\/dropdown\.css';/,
      );
      expect(rendered.has('/api/manifest/chat')).toBe(true);
      expect(rendered.has('/api/documentation/chat')).toBe(true);
      expect(
        [...rendered].some((url) => url.endsWith('/package-components/chat/chat/chat.css')),
      ).toBe(true);
      expect(
        [...rendered].some((url) => url.endsWith('/components/command-menu/command-menu.css')),
      ).toBe(true);
      expect([...rendered].some((url) => url.endsWith('/components/dropdown/dropdown.css'))).toBe(
        true,
      );
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }, 120_000);

  test('materializes shell routes for navigable family children', async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), 'cinder-static-export-family-'));
    try {
      const rendered = await runStaticExport({
        outputDirectory,
        sidebarComponents: ['chat'],
        allComponents: [],
      });
      // `/c/<name>` is a legacy alias redirected by vercel.json, so it must NOT
      // be written into public/ — that would restore a second documentation
      // surface on disk.
      expect(rendered.has('/c/chat')).toBe(false);
      expect(rendered.has('/c/chat-composer-popover')).toBe(false);
      expect(rendered.has('/page/chat-composer-popover')).toBe(true);
      await expect(
        readFile(join(outputDirectory, 'page', 'chat-composer-popover', 'index.html'), 'utf8'),
      ).resolves.toContain('data-component-page');
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }, 120_000);
});

describe('assertDocumentationPagesArePreRendered', () => {
  /*
   * The guardrail for the original defect: `/page/<name>` shipped an empty
   * `<div id="app">` plus a bundle, so the deployed site rendered nothing until
   * JavaScript executed — and nothing failed, because the export only checked
   * for a 2xx response.
   */
  const goodPage =
    '<html><body><div id="app"><div data-component-page><h1>Button</h1></div></div></body></html>';

  test('accepts pages that carry server-rendered documentation', () => {
    expect(() =>
      assertDocumentationPagesArePreRendered([{ name: 'button', html: goodPage }]),
    ).not.toThrow();
  });

  test('accepts an empty page list', () => {
    expect(() => assertDocumentationPagesArePreRendered([])).not.toThrow();
  });

  test('rejects an empty mount root — the original regression', () => {
    expect(() =>
      assertDocumentationPagesArePreRendered([
        { name: 'button', html: '<html><body><div id="app"></div></body></html>' },
      ]),
    ).toThrow(/#app is empty/);
  });

  test('rejects a page missing the documentation root attribute', () => {
    expect(() =>
      assertDocumentationPagesArePreRendered([
        { name: 'badge', html: '<div id="app"><h1>Badge</h1></div>' },
      ]),
    ).toThrow(/data-component-page/);
  });

  test('rejects a page missing its hero heading', () => {
    expect(() =>
      assertDocumentationPagesArePreRendered([
        { name: 'badge', html: '<div id="app"><div data-component-page></div></div>' },
      ]),
    ).toThrow(/<h1/);
  });

  test('reports every offender and the total, not just the first', () => {
    const error = (() => {
      try {
        assertDocumentationPagesArePreRendered([
          { name: 'button', html: goodPage },
          { name: 'badge', html: '<div id="app"></div>' },
          { name: 'card', html: '<div id="app"></div>' },
        ]);
        return null;
      } catch (thrown) {
        return thrown as Error;
      }
    })();

    expect(error).not.toBeNull();
    expect(error?.message).toContain('2 of 3');
    expect(error?.message).toContain('badge');
    expect(error?.message).toContain('card');
  });
});

describe('assertExactlyOneH1', () => {
  test('accepts one semantic top-level heading', () => {
    expect(() => assertExactlyOneH1('landing', '<main><h1>cinder</h1></main>')).not.toThrow();
  });

  test('rejects duplicate or missing top-level headings', () => {
    expect(() => assertExactlyOneH1('landing', '<h1>cinder</h1><h1>cinder</h1>')).toThrow(
      'landing: expected exactly one h1, found 2',
    );
    expect(() => assertExactlyOneH1('landing', '<main></main>')).toThrow(
      'landing: expected exactly one h1, found 0',
    );
  });
});

test('clears a legacy /c/ tree left by a previous export', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'cinder-static-export-legacy-'));
  try {
    // Simulate output from before `/c/<name>` became a redirect.
    await mkdir(join(outputDirectory, 'c', 'button'), { recursive: true });
    await writeFile(join(outputDirectory, 'c', 'button', 'index.html'), '<html>stale</html>');

    await runStaticExport({
      outputDirectory,
      sidebarComponents: ['button'],
      allComponents: ['button'],
    });

    // A stale second documentation surface must not survive into public/.
    expect(existsSync(join(outputDirectory, 'c'))).toBe(false);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}, 120_000);
