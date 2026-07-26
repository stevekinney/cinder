import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  assertDocumentationPagesArePreRendered,
  assetUrlsFromHtml,
  runStaticExport,
} from './static-export.ts';

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
      expect(indexHtml).toContain('/shell-bundle/shell.js');
      expect(indexHtml).toContain('/styles/shell.css');
      expect(indexHtml).not.toContain('http-equiv="refresh"');
      expect(rendered.has('/shell-bundle/shell.js')).toBe(true);
      expect(indexHtml).not.toContain('data-canonical-documentation');
      expect(rendered.has('/styles/shell.css')).toBe(true);
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
      const chatStyles = await readFile(
        join(outputDirectory, 'package-components', 'chat', 'chat', 'chat.css'),
        'utf8',
      );
      const composerStyles = await readFile(
        join(
          outputDirectory,
          'package-components',
          'chat',
          'chat-composer-popover',
          'chat-composer-popover.css',
        ),
        'utf8',
      );
      const headerStyles = await readFile(
        join(
          outputDirectory,
          'package-components',
          'chat',
          'chat-conversation-header',
          'chat-conversation-header.css',
        ),
        'utf8',
      );

      expect(pageHtml).toContain('/page-bundle/chat.js');
      expect(pageHtml).toContain('/package-components/chat/chat/chat.css');
      expect(pageHtml).toContain('id="cinder-documentation"');
      expect(pageHtml).toContain('\\u003cp');

      const canonicalHtml = await Bun.file(join(outputDirectory, 'c', 'chat', 'index.html')).text();
      expect(canonicalHtml).toContain('data-canonical-documentation');
      expect(canonicalHtml).toMatch(/<h1[^>]*>.*Chat.*<\/h1>/s);
      expect(canonicalHtml).toContain('src="/page/chat?preview=1"');
      expect(rendered.has('/page/chat?preview=1')).toBe(false);
      expect(chatStyles).toContain('.cinder-chat');
      expect(composerStyles).toContain("@import '/components/command-menu/command-menu.css';");
      expect(headerStyles).toContain("@import '/components/dropdown/dropdown.css';");
      expect(rendered.has('/api/manifest/chat')).toBe(true);
      expect(rendered.has('/api/documentation/chat')).toBe(true);
      expect(rendered.has('/package-components/chat/chat/chat.css')).toBe(true);
      expect(rendered.has('/components/command-menu/command-menu.css')).toBe(true);
      expect(rendered.has('/components/dropdown/dropdown.css')).toBe(true);
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
      expect(rendered.has('/c/chat')).toBe(true);
      expect(rendered.has('/c/chat-composer-popover')).toBe(true);
      await expect(
        readFile(join(outputDirectory, 'c', 'chat-composer-popover', 'index.html'), 'utf8'),
      ).resolves.toContain('data-canonical-documentation');
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
