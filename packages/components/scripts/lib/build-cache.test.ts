// Real-filesystem behavior of the build-cache helper: hash stability across
// repeated computation, invalidation on an input change (source file, extra
// file, and upstream dist), the force-build override, and the marker
// read/write round trip that `shouldSkipBuild` / `writeBuildInputHash` drive.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BUILD_INPUT_HASH_MARKER,
  computeBuildInputHash,
  shortHash,
  shouldSkipBuild,
  writeBuildInputHash,
  type BuildCacheInputs,
} from './build-cache.ts';

let testRoot: string;

beforeEach(() => {
  testRoot = mkdtempSync(join(tmpdir(), 'build-cache-test-'));
});

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
  delete process.env['CINDER_FORCE_BUILD'];
});

/** Build a minimal package layout under `testRoot`: src/, scripts/, package.json. */
function makePackage(name = 'pkg'): {
  packageRoot: string;
  sourceRoot: string;
  scriptsRoot: string;
  packageJson: string;
} {
  const packageRoot = join(testRoot, name);
  const sourceRoot = join(packageRoot, 'src');
  const scriptsRoot = join(packageRoot, 'scripts');
  mkdirSync(sourceRoot, { recursive: true });
  mkdirSync(scriptsRoot, { recursive: true });
  const packageJson = join(packageRoot, 'package.json');
  writeFileSync(join(sourceRoot, 'index.ts'), 'export const value = 1;\n');
  writeFileSync(join(scriptsRoot, 'build.ts'), '// build script\n');
  writeFileSync(packageJson, '{"name":"pkg"}\n');
  return { packageRoot, sourceRoot, scriptsRoot, packageJson };
}

function inputsFor(pkg: ReturnType<typeof makePackage>, extra: Partial<BuildCacheInputs> = {}) {
  return {
    packageRoot: pkg.packageRoot,
    sourceGlobRoots: [pkg.sourceRoot, pkg.scriptsRoot],
    extraFiles: [pkg.packageJson],
    upstreamDistDirectories: [],
    ...extra,
  };
}

describe('computeBuildInputHash', () => {
  it('is stable across repeated calls with unchanged inputs', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);

    const first = await computeBuildInputHash(inputs);
    const second = await computeBuildInputHash(inputs);

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is independent of directory read order (sorted before hashing)', async () => {
    const pkg = makePackage();
    writeFileSync(join(pkg.sourceRoot, 'zeta.ts'), 'export const z = 1;\n');
    writeFileSync(join(pkg.sourceRoot, 'alpha.ts'), 'export const a = 1;\n');
    const inputs = inputsFor(pkg);

    const first = await computeBuildInputHash(inputs);
    const second = await computeBuildInputHash(inputs);

    expect(first).toBe(second);
  });

  it('changes when a source file under sourceGlobRoots changes', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    const before = await computeBuildInputHash(inputs);

    writeFileSync(join(pkg.sourceRoot, 'index.ts'), 'export const value = 2;\n');

    const after = await computeBuildInputHash(inputs);
    expect(after).not.toBe(before);
  });

  it('changes when a new file is added under sourceGlobRoots', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    const before = await computeBuildInputHash(inputs);

    writeFileSync(join(pkg.sourceRoot, 'new-file.ts'), 'export const n = 1;\n');

    const after = await computeBuildInputHash(inputs);
    expect(after).not.toBe(before);
  });

  it('changes when the build script itself changes', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    const before = await computeBuildInputHash(inputs);

    writeFileSync(join(pkg.scriptsRoot, 'build.ts'), '// changed build script\n');

    const after = await computeBuildInputHash(inputs);
    expect(after).not.toBe(before);
  });

  it('changes when an extraFiles entry (e.g. package.json) changes', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    const before = await computeBuildInputHash(inputs);

    writeFileSync(pkg.packageJson, '{"name":"pkg","version":"0.0.2"}\n');

    const after = await computeBuildInputHash(inputs);
    expect(after).not.toBe(before);
  });

  it('changes when an upstream dependency dist directory changes (invalidates dependents)', async () => {
    const pkg = makePackage('dependent');
    const upstreamDist = join(testRoot, 'upstream-dist');
    mkdirSync(upstreamDist, { recursive: true });
    writeFileSync(join(upstreamDist, 'index.js'), 'export const upstream = 1;\n');

    const inputs = inputsFor(pkg, { upstreamDistDirectories: [upstreamDist] });
    const before = await computeBuildInputHash(inputs);

    // Simulate the upstream package rebuilding with different output.
    writeFileSync(join(upstreamDist, 'index.js'), 'export const upstream = 2;\n');

    const after = await computeBuildInputHash(inputs);
    expect(after).not.toBe(before);
  });

  it('tolerates a missing upstream dist directory (treated as empty, not an error)', async () => {
    const pkg = makePackage();
    const missingDist = join(testRoot, 'does-not-exist', 'dist');
    const inputs = inputsFor(pkg, { upstreamDistDirectories: [missingDist] });

    await expect(computeBuildInputHash(inputs)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('shouldSkipBuild', () => {
  it('does not skip when dist has no recorded marker', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    mkdirSync(join(pkg.packageRoot, 'dist'), { recursive: true });

    const decision = await shouldSkipBuild(inputs);
    expect(decision.skip).toBe(false);
  });

  it('does not skip when dist does not exist at all', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);

    const decision = await shouldSkipBuild(inputs);
    expect(decision.skip).toBe(false);
  });

  it('skips when the recorded marker matches the current input hash', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    const distributionDirectory = join(pkg.packageRoot, 'dist');
    mkdirSync(distributionDirectory, { recursive: true });

    const hash = await computeBuildInputHash(inputs);
    await writeBuildInputHash(distributionDirectory, hash);

    const decision = await shouldSkipBuild(inputs);
    expect(decision.skip).toBe(true);
    if (decision.skip) {
      expect(decision.hash).toBe(hash);
    }
  });

  it('does not skip when the recorded marker no longer matches (inputs changed)', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    const distributionDirectory = join(pkg.packageRoot, 'dist');
    mkdirSync(distributionDirectory, { recursive: true });

    const staleHash = await computeBuildInputHash(inputs);
    await writeBuildInputHash(distributionDirectory, staleHash);

    writeFileSync(join(pkg.sourceRoot, 'index.ts'), 'export const value = 999;\n');

    const decision = await shouldSkipBuild(inputs);
    expect(decision.skip).toBe(false);
  });

  it('does not skip when the marker file is empty/malformed', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    const distributionDirectory = join(pkg.packageRoot, 'dist');
    mkdirSync(distributionDirectory, { recursive: true });
    writeFileSync(join(distributionDirectory, BUILD_INPUT_HASH_MARKER), '   \n');

    const decision = await shouldSkipBuild(inputs);
    expect(decision.skip).toBe(false);
  });

  it('never skips when CINDER_FORCE_BUILD=1 is set, even on a matching marker', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    const distributionDirectory = join(pkg.packageRoot, 'dist');
    mkdirSync(distributionDirectory, { recursive: true });

    const hash = await computeBuildInputHash(inputs);
    await writeBuildInputHash(distributionDirectory, hash);

    process.env['CINDER_FORCE_BUILD'] = '1';
    const decision = await shouldSkipBuild(inputs);
    expect(decision.skip).toBe(false);
  });

  it('falls through to build (never throws) when hashing errors', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);

    const throwingReadDirectory = (() => {
      throw new Error('synthetic readdir failure');
    }) as unknown as typeof import('node:fs/promises').readdir;

    const decision = await shouldSkipBuild(inputs, throwingReadDirectory);
    expect(decision.skip).toBe(false);
    if (!decision.skip) {
      expect(decision.reason).toContain('hash computation failed');
    }
  });
});

describe('writeBuildInputHash', () => {
  it('writes a marker that a subsequent shouldSkipBuild call reads back and matches', async () => {
    const pkg = makePackage();
    const inputs = inputsFor(pkg);
    const distributionDirectory = join(pkg.packageRoot, 'dist');
    mkdirSync(distributionDirectory, { recursive: true });

    const hash = await computeBuildInputHash(inputs);
    await writeBuildInputHash(distributionDirectory, hash);

    const markerContents = await Bun.file(
      join(distributionDirectory, BUILD_INPUT_HASH_MARKER),
    ).text();
    expect(markerContents.trim()).toBe(hash);

    const decision = await shouldSkipBuild(inputs);
    expect(decision.skip).toBe(true);
  });
});

describe('shortHash', () => {
  it('returns the first 12 hex characters of the hash', () => {
    const hash = 'a'.repeat(64);
    expect(shortHash(hash)).toBe('a'.repeat(12));
    expect(shortHash(hash)).toHaveLength(12);
  });
});
