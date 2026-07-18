import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { runStaticExport } from './static-export.ts';

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
        allComponents: ['chat'],
      });
      const pageHtml = await readFile(join(outputDirectory, 'page', 'chat', 'index.html'), 'utf8');
      const chatStyles = await readFile(
        join(outputDirectory, 'package-components', 'chat', 'chat', 'chat.css'),
        'utf8',
      );

      expect(pageHtml).toContain('/page-bundle/chat.js');
      expect(pageHtml).toContain('/package-components/chat/chat/chat.css');
      expect(chatStyles).toContain('.cinder-chat');
      expect(rendered.has('/api/manifest/chat')).toBe(true);
      expect(rendered.has('/api/documentation/chat')).toBe(true);
      expect(rendered.has('/package-components/chat/chat/chat.css')).toBe(true);
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }, 120_000);
});
