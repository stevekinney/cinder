import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  findIgnoredPackageChangesets,
  parseChangesetPackageNames,
} from './validate-release-workflow.ts';

describe('validate-release-workflow changeset guards', () => {
  test('parses package names from changeset front matter', () => {
    expect(
      parseChangesetPackageNames(`---
'@lostgradient/cinder': minor
'@cinder/playground': patch
---

Release notes.
`),
    ).toEqual(['@lostgradient/cinder', '@cinder/playground']);
  });

  test('reports malformed changeset front matter with a targeted error', () => {
    expect(() =>
      parseChangesetPackageNames(`---
'@cinder/playground': [
---

Broken release note.
`),
    ).toThrow(/changeset has invalid YAML front matter/);
  });

  test('reports pending changesets for ignored packages', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'cinder-release-workflow-'));
    const changesetDirectory = join(temporaryDirectory, '.changeset');

    try {
      mkdirSync(changesetDirectory);
      writeFileSync(join(changesetDirectory, 'README.md'), '# Changesets\n');
      writeFileSync(
        join(changesetDirectory, 'public-package.md'),
        `---
'@lostgradient/cinder': patch
---

Public package release note.
`,
      );
      writeFileSync(
        join(changesetDirectory, 'playground-only.md'),
        `---
'@cinder/playground': patch
---

Private playground note.
`,
      );

      expect(
        findIgnoredPackageChangesets(changesetDirectory, ['@cinder/playground']).map(
          (changeset) => ({
            fileName: basename(changeset.filePath),
            packages: changeset.packages,
          }),
        ),
      ).toEqual([{ fileName: 'playground-only.md', packages: ['@cinder/playground'] }]);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('ignores normal public-package changesets', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'cinder-release-workflow-'));
    const changesetDirectory = join(temporaryDirectory, '.changeset');

    try {
      mkdirSync(changesetDirectory);
      writeFileSync(
        join(changesetDirectory, 'public-package.md'),
        `---
'@lostgradient/cinder': patch
---

Public package release note.
`,
      );

      expect(findIgnoredPackageChangesets(changesetDirectory, ['@cinder/playground'])).toEqual([]);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
