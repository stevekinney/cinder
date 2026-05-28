import { describe, expect, it } from 'bun:test';
import { relative } from 'node:path';

// Protected-package prefixes are defined centrally in scripts/ssr-import-boundary.ts.
// This test uses a narrower pattern because editor source files legitimately import
// from prosemirror-* (they ARE the browser-side layer); the constraint here is that
// @milkdown/kit/ bundles must stay lazy (no static value imports in non-test files).
const RUNTIME_MILKDOWN_IMPORT_PATTERN =
  /import\s+(?!type\b)[\s\S]*?\s+from\s+['"]@milkdown\/kit\//g;

describe('@cinder/editor SSR import safety', () => {
  it('imports the package barrel without needing browser globals', async () => {
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
