import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  VersionConstantError,
  updateVersionSource,
  versionConstantPath,
  versionConstantShape,
  writeVersionConstant,
} from './write-version-constant.ts';

const versionSource = [
  '/**',
  ' * GENERATED FILE. Do not edit by hand.',
  ' */',
  "export const VERSION = '0.27.1';",
  '',
].join('\n');

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function makePackage(options: { version?: string; source?: string }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cinder-write-version-'));
  temporaryRoots.push(root);
  const constantPath = join(root, versionConstantPath);
  await mkdir(dirname(constantPath), { recursive: true });
  await Bun.write(
    join(root, 'package.json'),
    JSON.stringify({ name: '@lostgradient/cinder', version: options.version }, null, 2),
  );
  await Bun.write(constantPath, options.source ?? versionSource);
  return root;
}

describe('updateVersionSource', () => {
  test('replaces only the version literal and keeps the leading comment', () => {
    const updated = updateVersionSource(versionSource, '0.28.0');
    expect(updated).toBe(versionSource.replace('0.27.1', '0.28.0'));
    expect(versionConstantShape.exec(updated)?.[2]).toBe('0.28.0');
  });

  test('replaces the sentinel the generator writes', () => {
    const sentinel = versionSource.replace('0.27.1', 'workspace');
    expect(updateVersionSource(sentinel, '0.28.0')).toBe(versionSource.replace('0.27.1', '0.28.0'));
  });

  test('returns the source unchanged when it already holds the version', () => {
    expect(updateVersionSource(versionSource, '0.27.1')).toBe(versionSource);
  });

  test('refuses a source with no version constant', () => {
    expect(() => updateVersionSource('export const OTHER = 1;\n', '1.0.0')).toThrow(
      VersionConstantError,
    );
  });

  test('refuses a source the mirror gate would reject', () => {
    expect(() => updateVersionSource(`${versionSource}${versionSource}`, '1.0.0')).toThrow(
      'exactly one',
    );
    expect(() => updateVersionSource(`${versionSource}export const OTHER = 1;\n`, '1.0.0')).toThrow(
      VersionConstantError,
    );
    expect(() => updateVersionSource(versionSource.trimEnd(), '1.0.0')).toThrow(
      VersionConstantError,
    );
  });

  test('refuses a version that is not semver', () => {
    expect(() => updateVersionSource(versionSource, "1.0.0'; evil()")).toThrow('semver');
  });
});

describe('writeVersionConstant', () => {
  test('makes VERSION equal the package.json version', async () => {
    const root = await makePackage({ version: '0.28.0' });
    expect(await writeVersionConstant(root)).toEqual({ version: '0.28.0', changed: true });
    expect(await Bun.file(join(root, versionConstantPath)).text()).toBe(
      versionSource.replace('0.27.1', '0.28.0'),
    );
  });

  test('reports no change when VERSION already agrees', async () => {
    const root = await makePackage({ version: '0.27.1' });
    expect(await writeVersionConstant(root)).toEqual({ version: '0.27.1', changed: false });
  });

  test('refuses a package.json with no version', async () => {
    const root = await makePackage({});
    await expect(writeVersionConstant(root)).rejects.toThrow('missing a version');
  });

  test('the real generated module has the shape the mirror gate accepts', async () => {
    const source = await Bun.file(join(import.meta.dir, '..', versionConstantPath)).text();
    expect(versionConstantShape.test(source)).toBe(true);
  });
});

describe('the changeset:version command', () => {
  test('writes the constant after the generated-source reset, so the reset cannot revert it', async () => {
    const workspaceManifest = (await Bun.file(
      join(import.meta.dir, '..', '..', '..', 'package.json'),
    ).json()) as { scripts?: Record<string, string> };
    const versionCommand = workspaceManifest.scripts?.['changeset:version'];

    expect(versionCommand).toBeDefined();
    if (versionCommand === undefined) return;

    const changesetsIndex = versionCommand.indexOf('changeset version');
    const resetIndex = versionCommand.indexOf('git checkout HEAD -- packages/components/src');
    const cleanIndex = versionCommand.indexOf('git clean -fdq -- packages/components/src');
    const writeIndex = versionCommand.indexOf(
      'bun run packages/components/scripts/write-version-constant.ts',
    );
    expect(changesetsIndex).toBeGreaterThanOrEqual(0);
    expect(resetIndex).toBeGreaterThan(changesetsIndex);
    expect(cleanIndex).toBeGreaterThan(resetIndex);
    expect(writeIndex).toBeGreaterThan(cleanIndex);
  });
});
