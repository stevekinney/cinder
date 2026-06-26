import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  bumpLevelForPackage,
  checkChangesetPrereleaseBumps,
  isPreRelease,
} from './check-changeset-prerelease-bumps.ts';

const PACKAGE = '@lostgradient/cinder';

// Track every temp changeset dir so it's removed after each test — otherwise
// repeated local + CI runs leak fixture directories into the system temp dir.
const fixtureRoots: string[] = [];
afterEach(() => {
  while (fixtureRoots.length > 0) {
    rmSync(fixtureRoots.pop()!, { recursive: true, force: true });
  }
});

function makeChangesetDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'changeset-bump-gate-'));
  fixtureRoots.push(root);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(root, name), content);
  }
  return root;
}

function changeset(level: 'major' | 'minor' | 'patch'): string {
  return `---\n'${PACKAGE}': ${level}\n---\n\nSome change.\n`;
}

describe('bumpLevelForPackage', () => {
  it('reads the level from frontmatter regardless of quote style', () => {
    expect(bumpLevelForPackage(`---\n'${PACKAGE}': major\n---\n`, PACKAGE)).toBe('major');
    expect(bumpLevelForPackage(`---\n"${PACKAGE}": minor\n---\n`, PACKAGE)).toBe('minor');
    expect(bumpLevelForPackage(`---\n${PACKAGE}: patch\n---\n`, PACKAGE)).toBe('patch');
  });

  it('reads a quoted bump value (Changesets accepts a quoted scalar)', () => {
    expect(bumpLevelForPackage(`---\n'${PACKAGE}': "major"\n---\n`, PACKAGE)).toBe('major');
    expect(bumpLevelForPackage(`---\n"${PACKAGE}": 'minor'\n---\n`, PACKAGE)).toBe('minor');
  });

  it('ignores commented-out bump lines and reads the real one', () => {
    // A commented previous value before the active entry must not win — Changesets
    // ignores the comment and applies the real `major`.
    const source = `---\n# '${PACKAGE}': minor\n'${PACKAGE}': major\n---\n\nChange.\n`;
    expect(bumpLevelForPackage(source, PACKAGE)).toBe('major');
  });

  it('does not read a bump from a comment-only entry', () => {
    expect(bumpLevelForPackage(`---\n# '${PACKAGE}': major\n---\n`, PACKAGE)).toBeNull();
  });

  it('only scans the frontmatter, not the prose body', () => {
    const source = `---\n'${PACKAGE}': minor\n---\n\nMentions '${PACKAGE}': major in prose.\n`;
    expect(bumpLevelForPackage(source, PACKAGE)).toBe('minor');
  });

  it('uses the last duplicate entry (YAML last-key-wins, matching Changesets)', () => {
    // Changesets applies the last entry for a key, so minor-then-major is a major.
    expect(
      bumpLevelForPackage(`---\n'${PACKAGE}': minor\n'${PACKAGE}': major\n---\n`, PACKAGE),
    ).toBe('major');
    expect(
      bumpLevelForPackage(`---\n'${PACKAGE}': major\n'${PACKAGE}': minor\n---\n`, PACKAGE),
    ).toBe('minor');
  });

  it('does not prefix-match a malformed bump value', () => {
    // `patches` must not be read as `patch`, nor `majorly` as `major`.
    expect(bumpLevelForPackage(`---\n'${PACKAGE}': patches\n---\n`, PACKAGE)).toBeNull();
    expect(bumpLevelForPackage(`---\n'${PACKAGE}': majorly\n---\n`, PACKAGE)).toBeNull();
  });

  it('allows a trailing inline comment after the bump value', () => {
    expect(bumpLevelForPackage(`---\n'${PACKAGE}': major # was minor\n---\n`, PACKAGE)).toBe(
      'major',
    );
  });

  it('returns null when the package is not mentioned', () => {
    expect(bumpLevelForPackage(`---\n'@other/pkg': major\n---\n`, PACKAGE)).toBeNull();
  });
});

describe('isPreRelease', () => {
  it('treats 0.y.z as pre-release and >= 1.0.0 as stable', () => {
    expect(isPreRelease('0.3.0')).toBe(true);
    expect(isPreRelease('0.99.5')).toBe(true);
    expect(isPreRelease('1.0.0')).toBe(false);
    expect(isPreRelease('2.4.1')).toBe(false);
  });

  it('throws on an unparseable version', () => {
    expect(() => isPreRelease('not-a-version')).toThrow();
  });
});

describe('checkChangesetPrereleaseBumps', () => {
  it('flags a major changeset while pre-1.0', async () => {
    const dir = makeChangesetDir({
      'breaking.md': changeset('major'),
      'feature.md': changeset('minor'),
      'README.md': changeset('major'), // README is ignored, not a real changeset
    });
    const violations = await checkChangesetPrereleaseBumps({
      changesetDirectory: dir,
      version: '0.3.0',
      relativeTo: dir,
    });
    expect(violations.map((v) => v.filePath)).toEqual(['breaking.md']);
    expect(violations.map((v) => v.bump)).toEqual(['major']);
  });

  it('passes when every pre-1.0 changeset is minor or patch', async () => {
    const dir = makeChangesetDir({
      'a.md': changeset('minor'),
      'b.md': changeset('patch'),
    });
    const violations = await checkChangesetPrereleaseBumps({
      changesetDirectory: dir,
      version: '0.3.0',
      relativeTo: dir,
    });
    expect(violations).toEqual([]);
  });

  it('allows major bumps once the package is stable (>= 1.0.0)', async () => {
    const dir = makeChangesetDir({ 'breaking.md': changeset('major') });
    const violations = await checkChangesetPrereleaseBumps({
      changesetDirectory: dir,
      version: '1.2.0',
      relativeTo: dir,
    });
    expect(violations).toEqual([]);
  });
});
