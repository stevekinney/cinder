/**
 * Mirrors the former `packages/editor/src/ssr-import.test.ts`, migrated here
 * when `@cinder/editor` was dissolved into `@lostgradient/markdown` (headless half)
 * and `@cinder/commentary` (this ProseMirror/Milkdown half). See
 * `docs/decisions/package-boundaries.md`.
 */

import { describe, expect, it } from 'bun:test';
import { relative } from 'node:path';

// Protected prefix — single source of truth is scripts/ssr-import-boundary.ts.
// Defined inline (matching markdown-editor.import-boundary.test.ts's
// precedent) because cross-package imports are outside commentary's rootDir.
//
// Editor source files legitimately import from prosemirror-* (they ARE the browser-side layer),
// so this test uses MILKDOWN_PREFIX only. The constraint here is that @milkdown/kit/ bundles
// must stay lazy (no static value imports in non-test files).
const MILKDOWN_PREFIX = '@milkdown/' as const;
const escapedPrefix = MILKDOWN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RUNTIME_MILKDOWN_IMPORT_PATTERN = new RegExp(
  `import\\s+(?!type\\b)[\\s\\S]*?\\s+from\\s+['"]${escapedPrefix}`,
  'g',
);

describe('@cinder/commentary editor SSR import safety', () => {
  it('imports the editor barrel without needing browser globals', async () => {
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

    try {
      Reflect.deleteProperty(globalThis, 'document');
      const editorModule = await import('./index.js');
      expect(typeof editorModule.createEditor).toBe('function');
      expect(typeof editorModule.destroyEditor).toBe('function');
    } finally {
      if (documentDescriptor) {
        Object.defineProperty(globalThis, 'document', documentDescriptor);
      }
    }
  });

  it('keeps Milkdown runtime imports lazy in non-test source files', async () => {
    const violations: string[] = [];
    const glob = new Bun.Glob('**/*.ts');

    for await (const filePath of glob.scan({
      absolute: true,
      cwd: import.meta.dirname,
      onlyFiles: true,
    })) {
      if (filePath.endsWith('.test.ts') || filePath.endsWith('.d.ts')) continue;

      const source = await Bun.file(filePath).text();
      for (const match of source.matchAll(RUNTIME_MILKDOWN_IMPORT_PATTERN)) {
        const lineNumber = source.slice(0, match.index).split('\n').length;
        violations.push(`${relative(import.meta.dirname, filePath)}:${lineNumber}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
