import { afterEach, describe, expect, test } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertReleaseProvenance,
  readTarballManifest,
  resolveReleaseProvenance,
  withReleaseProvenance,
} from './release-provenance.ts';

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

function repository(): { root: string; head: string } {
  const root = mkdtempSync(join(tmpdir(), 'cinder-release-provenance-'));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  writeFileSync(join(root, 'source.txt'), 'source\n');
  execFileSync('git', ['add', 'source.txt'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: root });
  return {
    root,
    head: execFileSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
  };
}

function tarball(manifestText: string, includeManifest = true): string {
  const root = mkdtempSync(join(tmpdir(), 'cinder-release-tarball-'));
  roots.push(root);
  const packageDirectory = join(root, 'package');
  mkdirSync(packageDirectory);
  if (includeManifest) writeFileSync(join(packageDirectory, 'package.json'), manifestText);
  const archive = join(root, 'artifact.tgz');
  execFileSync('tar', ['-czf', archive, '-C', root, 'package']);
  return archive;
}

describe('release provenance', () => {
  test('reports an unavailable tar executable without a secondary TypeError', () => {
    const emptyPath = mkdtempSync(join(tmpdir(), 'cinder-no-tar-'));
    roots.push(emptyPath);
    const moduleUrl = new URL('./release-provenance.ts', import.meta.url).href;
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `import { readTarballManifest } from ${JSON.stringify(moduleUrl)};
        try { readTarballManifest('artifact.tgz'); process.exitCode = 1; }
        catch (error) { process.stdout.write(JSON.stringify({ name: error.name, message: error.message })); }`,
      ],
      { env: { ...process.env, PATH: emptyPath }, encoding: 'utf8' },
    );
    expect(child.status).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({
      name: 'Error',
      message: 'cannot read package.json from release artifact: could not start tar',
    });
  });

  test('records the actual clean checkout HEAD and matching workflow SHA', () => {
    const fixture = repository();
    expect(resolveReleaseProvenance(fixture.root, { GITHUB_SHA: fixture.head })).toEqual({
      gitHead: fixture.head,
      sourceHead: fixture.head,
    });
  });

  test('omits provenance for tracked and untracked dirt with explicit reasons', () => {
    const fixture = repository();
    writeFileSync(join(fixture.root, 'source.txt'), 'tracked change\n');
    expect(resolveReleaseProvenance(fixture.root, {})).toMatchObject({
      reason: 'the checkout has tracked or untracked changes',
    });
    execFileSync('git', ['checkout', '--', 'source.txt'], { cwd: fixture.root });
    writeFileSync(join(fixture.root, 'untracked.txt'), 'change\n');
    expect(resolveReleaseProvenance(fixture.root, {})).toMatchObject({
      reason: 'the checkout has tracked or untracked changes',
    });
    rmSync(join(fixture.root, 'untracked.txt'));
  });

  test('accepts detached HEAD and rejects absent, malformed, or mismatched metadata', () => {
    const detached = repository();
    execFileSync('git', ['checkout', '--detach', 'HEAD'], { cwd: detached.root });
    expect(resolveReleaseProvenance(detached.root, {})).toMatchObject({
      gitHead: detached.head,
    });

    const absent = mkdtempSync(join(tmpdir(), 'cinder-no-git-'));
    roots.push(absent);
    expect(resolveReleaseProvenance(absent, {})).toMatchObject({
      reason: 'git HEAD is unavailable or is not a 40-character SHA',
    });

    const malformed = repository();
    writeFileSync(join(malformed.root, '.git', 'HEAD'), 'ref: refs/heads/missing\n');
    expect(resolveReleaseProvenance(malformed.root, {})).toMatchObject({
      reason: 'git HEAD is unavailable or is not a 40-character SHA',
    });

    const mismatched = repository();
    expect(resolveReleaseProvenance(mismatched.root, { GITHUB_SHA: 'bad' })).toMatchObject({
      reason: 'GITHUB_SHA does not match the checked-out git HEAD',
    });
    expect(resolveReleaseProvenance(mismatched.root, { GITHUB_SHA: '0'.repeat(40) })).toMatchObject(
      { reason: 'GITHUB_SHA does not match the checked-out git HEAD' },
    );
  });

  test('removes authored gitHead when provenance is unavailable without mutating the source object', () => {
    const source = { name: 'example', version: '1.0.0', gitHead: 'stale' };
    const staged = withReleaseProvenance(source, { reason: 'dirty' });
    expect(staged).toEqual({ name: 'example', version: '1.0.0' });
    expect(source.gitHead).toBe('stale');

    const clean = withReleaseProvenance(source, { gitHead: 'a'.repeat(40) });
    expect(clean).toEqual({ name: 'example', version: '1.0.0', gitHead: 'a'.repeat(40) });
    expect(source.gitHead).toBe('stale');
  });

  test('rejects artifacts without exact identity or gitHead and reads real archives', () => {
    const fixture = repository();
    expect(() =>
      assertReleaseProvenance(
        fixture.root,
        { name: 'example', version: '1.0.0' },
        { name: 'example', version: '1.0.0' },
        {},
      ),
    ).toThrow('gitHead');
    expect(() =>
      assertReleaseProvenance(
        fixture.root,
        { name: 'example', version: '1.0.0' },
        { name: 'example', version: '1.0.0', gitHead: fixture.head },
        {},
      ),
    ).not.toThrow();

    const validArchive = tarball(
      JSON.stringify({ name: 'example', version: '1.0.0', gitHead: fixture.head }),
    );
    expect(readTarballManifest(validArchive)).toEqual({
      name: 'example',
      version: '1.0.0',
      gitHead: fixture.head,
    });
    expect(() =>
      assertReleaseProvenance(
        fixture.root,
        { name: 'wrong', version: '1.0.0' },
        {
          name: 'example',
          version: '1.0.0',
          gitHead: fixture.head,
        },
        {},
      ),
    ).toThrow('identity');
    expect(() =>
      assertReleaseProvenance(
        fixture.root,
        { name: 'example', version: '2.0.0' },
        {
          name: 'example',
          version: '1.0.0',
          gitHead: fixture.head,
        },
        {},
      ),
    ).toThrow('identity');
    expect(() =>
      assertReleaseProvenance(
        fixture.root,
        { name: 'example', version: '1.0.0' },
        {
          name: 'example',
          version: '1.0.0',
          gitHead: '0'.repeat(40),
        },
        {},
      ),
    ).toThrow('gitHead');
    expect(() => readTarballManifest(tarball('', false))).toThrow('cannot read package.json');
    expect(() => readTarballManifest(tarball('{'))).toThrow('not valid JSON');
  });
});
