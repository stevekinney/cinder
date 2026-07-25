import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { assetUrlsFromHtml, runStaticExport } from './static-export.ts';

test('HTML asset discovery normalizes query-configured routes to one static path', () => {
  expect(
    assetUrlsFromHtml(
      '<iframe src="/page/button?preview=1"></iframe><a href="/page/button">Button</a>',
    ),
  ).toEqual(['/page/button']);
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
});
