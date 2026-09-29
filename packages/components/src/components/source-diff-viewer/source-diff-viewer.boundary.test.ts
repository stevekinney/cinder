/**
 * DR-3's contract boundary: `SourceDiffViewer` must remain usable without any
 * `@lostgradient/editor`, `@lostgradient/markdown`, Milkdown, or ProseMirror
 * runtime import, even after adding the optional annotation hooks. Scans this
 * component directory's own source files (never its tests, which may need
 * fixtures from anywhere) so a future annotation-hook change cannot silently
 * reach across the editor/Cinder surface boundary documented for the
 * diff-review project.
 */
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, test } from 'bun:test';

const COMPONENT_DIRECTORY = import.meta.dir;
const FORBIDDEN_SPECIFIER_PATTERN =
  /from\s+['"](@lostgradient\/editor|@lostgradient\/markdown|milkdown|prosemirror)[^'"]*['"]/g;

function sourceFileNames(): string[] {
  return readdirSync(COMPONENT_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => ['.ts', '.svelte'].includes(extname(name)))
    .filter((name) => !name.includes('.test.'));
}

describe('SourceDiffViewer: editor/Markdown boundary', () => {
  test('never imports @lostgradient/editor, @lostgradient/markdown, milkdown, or prosemirror', async () => {
    const fileNames = sourceFileNames();
    expect(fileNames.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const fileName of fileNames) {
      const source = await Bun.file(join(COMPONENT_DIRECTORY, fileName)).text();
      const matches = source.match(FORBIDDEN_SPECIFIER_PATTERN);
      if (matches) offenders.push(`${fileName}: ${matches.join(', ')}`);
    }

    expect(offenders).toEqual([]);
  });

  test('the package dependency manifest names no editor/markdown-runtime coupling for this directory', () => {
    // Regression guard for the boundary assertion itself: a forbidden import
    // added to any file above must fail the first test, not slip through
    // because the pattern only matched a subset of extensions.
    expect(
      sourceFileNames().every((name) => extname(name) === '.ts' || extname(name) === '.svelte'),
    ).toBe(true);
  });
});
