import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import {
  componentEnhancementKey,
  componentEnhancementOutputPaths,
  discoverComponentEnhancements,
} from './component-enhancements.ts';

describe('component enhancements', () => {
  // COR-1196: the target's build.ts imports this alongside the two functions below, and
  // corvidae's own copy dropped it before this fix — a regression this test would have caught.
  it('computes the browser, declaration, and server outputs for one enhancement', () => {
    const paths = componentEnhancementOutputPaths('/dist', 'second-editor');
    expect(paths).toEqual({
      browser: '/dist/components/second-editor/second-editor-enhancement.js',
      types: '/dist/components/second-editor/second-editor-enhancement.d.ts',
      server: '/dist/server/components/second-editor/second-editor-enhancement.js',
    });
  });

  it('discovers directly importable source for a second component', async () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'cinder-component-enhancement-'));
    const sourceRoot = join(fixtureRoot, 'src');
    const componentsRoot = join(sourceRoot, 'components');
    const sourcePath = join(componentsRoot, 'second-editor', 'second-editor-enhancement.ts');
    mkdirSync(join(componentsRoot, 'second-editor'), { recursive: true });
    writeFileSync(sourcePath, 'export const enhancement = "second-editor";\n');

    try {
      const enhancements = discoverComponentEnhancements(
        [{ name: 'second-editor', isExperimental: false }],
        componentsRoot,
      );
      expect(enhancements).toEqual([{ name: 'second-editor', isExperimental: false, sourcePath }]);
      expect(componentEnhancementKey(enhancements[0]!)).toBe('stable/second-editor');

      const sourceModule: unknown = await import(sourcePath);
      expect(sourceModule).toMatchObject({ enhancement: 'second-editor' });
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
