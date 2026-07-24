import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import {
  componentEnhancementOutputPaths,
  discoverComponentEnhancements,
} from './component-enhancements.ts';

describe('component enhancements', () => {
  it('discovers and builds browser/server outputs for a hypothetical second component', async () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'cinder-component-enhancement-'));
    const sourceRoot = join(fixtureRoot, 'src');
    const componentsRoot = join(sourceRoot, 'components');
    const sourcePath = join(componentsRoot, 'second-editor', 'second-editor-enhancement.ts');
    const browserOutput = join(fixtureRoot, 'dist');
    const serverOutput = join(fixtureRoot, 'dist', 'server');
    mkdirSync(join(componentsRoot, 'second-editor'), { recursive: true });
    writeFileSync(sourcePath, 'export const enhancement = "second-editor";\n');

    try {
      const enhancements = discoverComponentEnhancements(
        [{ name: 'second-editor', isExperimental: false }],
        componentsRoot,
      );
      expect(enhancements).toEqual([{ name: 'second-editor', sourcePath }]);

      const browserBuild = await Bun.build({
        entrypoints: enhancements.map((enhancement) => enhancement.sourcePath),
        outdir: browserOutput,
        root: sourceRoot,
        target: 'browser',
        format: 'esm',
        naming: { entry: '[dir]/[name].[ext]' },
      });
      const serverBuild = await Bun.build({
        entrypoints: enhancements.map((enhancement) => enhancement.sourcePath),
        outdir: serverOutput,
        root: sourceRoot,
        target: 'node',
        format: 'esm',
        naming: { entry: '[dir]/[name].[ext]' },
      });

      expect(browserBuild.success).toBe(true);
      expect(serverBuild.success).toBe(true);
      const outputPaths = componentEnhancementOutputPaths(browserOutput, 'second-editor');
      expect(await Bun.file(outputPaths.browser).exists()).toBe(true);
      expect(await Bun.file(outputPaths.server).exists()).toBe(true);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
