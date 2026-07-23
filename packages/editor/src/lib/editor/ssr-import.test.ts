/**
 * Mirrors the former `packages/editor/src/ssr-import.test.ts`, migrated here
 * when `@cinder/editor` was dissolved into `@lostgradient/markdown` (headless half)
 * and `@lostgradient/editor` (this ProseMirror/Milkdown half). See
 * `docs/decisions/package-boundaries.md`.
 */

import { describe, expect, it } from 'bun:test';
import { relative, resolve } from 'node:path';

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

describe('@lostgradient/editor editor SSR import safety', () => {
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

  it('keeps process-global module mocks out of the shared test process', async () => {
    const violations: string[] = [];
    // `bun run test` discovers both src/ and scripts/, so scan the package
    // root rather than only the editor's source tree. `import.meta.dirname`
    // is `packages/editor/src/lib/editor` (one directory level deeper than
    // the former `packages/commentary/src/editor` this test was migrated
    // from — commentary had no `lib/` layer), so reaching the package root
    // (`packages/editor`) needs three `..` segments, not two.
    const packageRoot = resolve(import.meta.dirname, '..', '..', '..');
    const moduleMockPattern = new RegExp(['mock', 'module'].join('\\.'), 'g');
    const glob = new Bun.Glob('**/*.test.ts');

    for await (const filePath of glob.scan({
      absolute: true,
      cwd: packageRoot,
      onlyFiles: true,
    })) {
      const source = await Bun.file(filePath).text();
      for (const match of source.matchAll(moduleMockPattern)) {
        const lineNumber = source.slice(0, match.index).split('\n').length;
        violations.push(`${relative(packageRoot, filePath)}:${lineNumber}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
