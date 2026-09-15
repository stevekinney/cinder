import { afterEach, expect, test } from 'bun:test';
import { pageArtifactByPath, pageBuildPromiseByKey } from './build-artifacts-shared.ts';
import { invalidateCachesForChange } from './file-watcher.ts';
import { pageEntryByName } from './page-bundle.ts';

const names = ['tabs', 'tab', 'tab-list', 'tab-panel', 'button'];
afterEach(() => {
  pageEntryByName.clear();
  pageArtifactByPath.clear();
  pageBuildPromiseByKey.clear();
});
function seedPages() {
  for (const name of names) {
    const path = `page-${name}-before.js`;
    pageEntryByName.set(name, path);
    pageArtifactByPath.set(path, `import "old-${name}.js"`);
    pageBuildPromiseByKey.set(name, Promise.resolve(path));
  }
}

test('parent example edits invalidate every dependent page and pending build', () => {
  seedPages();
  invalidateCachesForChange({ kind: 'examples', names: new Set(['tabs']) });
  for (const name of names.slice(0, -1)) {
    expect(pageEntryByName.has(name)).toBe(false);
    expect(pageArtifactByPath.has(`page-${name}-before.js`)).toBe(false);
    expect(pageBuildPromiseByKey.has(name)).toBe(false);
  }
  expect(pageEntryByName.get('button')).toBe('page-button-before.js');
  expect(pageArtifactByPath.has('page-button-before.js')).toBe(true);
  expect(pageBuildPromiseByKey.has('button')).toBe(true);
});

test('a child example edit preserves unrelated parent and sibling page entries', () => {
  seedPages();
  invalidateCachesForChange({ kind: 'examples', names: new Set(['tab']) });
  expect(pageEntryByName.has('tab')).toBe(false);
  for (const name of ['tabs', 'tab-list', 'tab-panel', 'button']) {
    expect(pageEntryByName.has(name)).toBe(true);
    expect(pageArtifactByPath.has(`page-${name}-before.js`)).toBe(true);
    expect(pageBuildPromiseByKey.has(name)).toBe(true);
  }
});
