/**
 * Mirrors the former `components/editor/src/ssr-import.test.ts`, migrated here
 * when `@cinder/editor` was dissolved into `@lostgradient/markdown` (headless half)
 * and `@lostgradient/editor` (this ProseMirror/Milkdown half). See
 * `docs/decisions/package-boundaries.md`.
 */

import { describe, expect, it } from 'bun:test';
import { relative, resolve } from 'node:path';

describe('@lostgradient/editor test isolation', () => {
  it('keeps process-global module mocks out of the shared test process', async () => {
    const violations: string[] = [];
    // `bun run test` discovers both src/ and scripts/, so scan the package
    // root rather than only the editor's source tree. `import.meta.dirname`
    // is `components/editor/src/lib/editor` (one directory level deeper than
    // the former `packages/commentary/src/editor` this test was migrated
    // from — commentary had no `lib/` layer), so reaching the package root
    // (`components/editor`) needs three `..` segments, not two.
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

  it('keeps the command utility runtime import lazy at the source boundary', async () => {
    const commandsPath = resolve(import.meta.dirname, 'commands.ts');
    const source = await Bun.file(commandsPath).text();

    expect(source).not.toMatch(/^import\s+(?!type\b).*['"]@milkdown\/kit\/utils['"]/m);
    expect(source).toContain("import('@milkdown/kit/utils')");
  });
});
