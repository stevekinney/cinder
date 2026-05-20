import { describe, expect, it } from 'bun:test';

import {
  getTouchedPackages,
  isSourceFile,
  loadWorkspacePackages,
  rootConfigStaged,
  type WorkspacePackage,
} from './utilities.ts';

const fakePackages: readonly WorkspacePackage[] = [
  { name: '@cinder/diff', dir: 'packages/diff/', hasTypecheck: true, hasTest: true },
  { name: '@cinder/markdown', dir: 'packages/markdown/', hasTypecheck: true, hasTest: true },
  { name: 'cinder', dir: 'packages/components/', hasTypecheck: true, hasTest: false },
];

describe('isSourceFile', () => {
  it('treats supported extensions as source', () => {
    expect(isSourceFile('packages/diff/src/index.ts')).toBe(true);
    expect(isSourceFile('packages/components/src/Button.tsx')).toBe(true);
    expect(isSourceFile('packages/components/src/Button.svelte')).toBe(true);
    expect(isSourceFile('packages/components/src/button.css')).toBe(true);
    expect(isSourceFile('packages/diff/tsconfig.json')).toBe(true);
  });

  it('excludes markdown outright', () => {
    expect(isSourceFile('README.md')).toBe(false);
    expect(isSourceFile('packages/diff/docs/intro.md')).toBe(false);
    expect(isSourceFile('packages/diff/CHANGELOG.md')).toBe(false);
  });

  it('excludes README and CHANGELOG documents lacking a source extension', () => {
    expect(isSourceFile('packages/diff/README')).toBe(false);
    expect(isSourceFile('packages/diff/CHANGELOG')).toBe(false);
    expect(isSourceFile('packages/diff/Readme.txt')).toBe(false);
  });

  it('does NOT exclude source files whose basename starts with readme or changelog', () => {
    // Regression for the round-1 bug where the basename check ran before the
    // extension check and silently dropped these files.
    expect(isSourceFile('packages/diff/src/changelog-helpers.ts')).toBe(true);
    expect(isSourceFile('packages/diff/src/readme-generator.tsx')).toBe(true);
    expect(isSourceFile('packages/diff/src/Readme.svelte')).toBe(true);
  });

  it('rejects unknown extensions', () => {
    expect(isSourceFile('packages/diff/src/index.rs')).toBe(false);
    expect(isSourceFile('packages/diff/Makefile')).toBe(false);
  });

  it('is case-insensitive on extensions and basenames', () => {
    expect(isSourceFile('packages/diff/src/Index.TS')).toBe(true);
    expect(isSourceFile('packages/diff/README.MD')).toBe(false);
  });
});

describe('getTouchedPackages', () => {
  it('returns the packages whose dir prefix matches staged source files', () => {
    const touched = getTouchedPackages(fakePackages, [
      'packages/diff/src/index.ts',
      'packages/markdown/src/parser.ts',
    ]);
    expect(touched.map((p) => p.name).toSorted()).toEqual(['@cinder/diff', '@cinder/markdown']);
  });

  it('ignores docs-only staged files', () => {
    const touched = getTouchedPackages(fakePackages, [
      'packages/diff/README.md',
      'packages/diff/CHANGELOG.md',
    ]);
    expect(touched).toEqual([]);
  });

  it('mixes source and docs files correctly', () => {
    const touched = getTouchedPackages(fakePackages, [
      'packages/diff/README.md',
      'packages/diff/src/index.ts',
      'packages/markdown/docs/notes.md',
    ]);
    expect(touched.map((p) => p.name)).toEqual(['@cinder/diff']);
  });

  it('returns empty when no staged file matches any package', () => {
    const touched = getTouchedPackages(fakePackages, ['README.md', 'package.json']);
    expect(touched).toEqual([]);
  });

  it('does not double-report a package with multiple staged files', () => {
    const touched = getTouchedPackages(fakePackages, [
      'packages/diff/src/a.ts',
      'packages/diff/src/b.ts',
      'packages/diff/src/c.ts',
    ]);
    expect(touched.map((p) => p.name)).toEqual(['@cinder/diff']);
  });
});

describe('rootConfigStaged', () => {
  it('returns true when a high-impact root file is staged', () => {
    expect(rootConfigStaged(['tsconfig.json'])).toBe(true);
    expect(rootConfigStaged(['tsconfig.base.json'])).toBe(true);
    expect(rootConfigStaged(['tsconfig.build.json'])).toBe(true);
    expect(rootConfigStaged(['tsconfig.check.json'])).toBe(true);
    expect(rootConfigStaged(['tsconfig.test.json'])).toBe(true);
    expect(rootConfigStaged(['package.json'])).toBe(true);
    expect(rootConfigStaged(['bun.lock'])).toBe(true);
    expect(rootConfigStaged(['.oxlintrc.json'])).toBe(true);
    expect(rootConfigStaged(['bunfig.toml'])).toBe(true);
    expect(rootConfigStaged(['.prettierrc.json'])).toBe(true);
    expect(rootConfigStaged(['.stylelintrc.json'])).toBe(true);
  });

  it('returns false for nested files of the same name', () => {
    // packages/diff/tsconfig.json must NOT escalate to a full workspace run.
    expect(rootConfigStaged(['packages/diff/tsconfig.json'])).toBe(false);
    expect(rootConfigStaged(['packages/diff/package.json'])).toBe(false);
  });

  it('returns false when only non-root files are staged', () => {
    expect(rootConfigStaged(['packages/diff/src/index.ts', 'README.md'])).toBe(false);
  });

  it('returns false on an empty staged list', () => {
    expect(rootConfigStaged([])).toBe(false);
  });
});

describe('loadWorkspacePackages', () => {
  it('reads every packages/*/package.json and exposes script presence', async () => {
    const packages = await loadWorkspacePackages();
    const names = packages.map((p) => p.name).toSorted();
    expect(names).toContain('@cinder/diff');
    expect(names).toContain('@cinder/markdown');
    expect(names).toContain('@cinder/editor');
    expect(names).toContain('@cinder/commentary');
    expect(names).toContain('@cinder/playground');
    expect(names).toContain('@cinder/testing');
    expect(names).toContain('cinder');
    for (const pkg of packages) {
      expect(pkg.dir.startsWith('packages/')).toBe(true);
      expect(pkg.dir.endsWith('/')).toBe(true);
      expect(typeof pkg.hasTypecheck).toBe('boolean');
      expect(typeof pkg.hasTest).toBe('boolean');
    }
  });
});
