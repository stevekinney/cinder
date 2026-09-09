import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPinnedBunVersion } from './update-snapshots-docker.ts';

const testingPackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(testingPackageRoot, '../..');

function readWorkspaceManifest(): { packageManager?: string } {
  const parsed: unknown = JSON.parse(readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null)
    throw new Error('workspace manifest is not an object');
  const packageManager = (parsed as Record<string, unknown>)['packageManager'];
  return typeof packageManager === 'string' ? { packageManager } : {};
}

describe('the container runs the Bun this workspace pins', () => {
  it('reads the exact version from `packageManager`', () => {
    const { packageManager } = readWorkspaceManifest();
    if (packageManager === undefined)
      throw new Error('the workspace package.json must declare packageManager');
    expect(readPinnedBunVersion()).toBe(packageManager.replace('bun@', ''));
  });

  it('installs that exact version in the image rather than whatever bun.sh serves', () => {
    // The install line took no version at all, so an image built today ran a
    // Bun the repository never pinned — the failure mode this guards.
    const dockerfile = readFileSync(resolve(testingPackageRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/ARG BUN_VERSION/);
    expect(dockerfile).toMatch(/bun\.sh\/install \| bash -s "bun-v\$\{BUN_VERSION\}"/);
  });

  it('refuses to build without the version rather than falling back to latest', () => {
    // A manual `docker build` with no build-arg would otherwise reintroduce
    // the drift quietly, which is the whole failure this pins down.
    const dockerfile = readFileSync(resolve(testingPackageRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/test -n "\$\{BUN_VERSION\}"/);
    expect(dockerfile).toMatch(/BUN_VERSION build-arg is required/);
  });

  it('is the same Bun every workflow job installs', () => {
    // Checking one workflow let the other ten drift: the pin lives in eleven
    // places across `BUN_VERSION` env blocks and `setup-bun` inputs, and a
    // bump that misses any of them puts a job on a different Bun than the
    // container and the workspace.
    const pinned = readPinnedBunVersion();
    const workflowsRoot = resolve(workspaceRoot, '.github/workflows');
    const pins: { file: string; version: string }[] = [];
    for (const file of readdirSync(workflowsRoot)) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const workflow = readFileSync(resolve(workflowsRoot, file), 'utf8');
      for (const match of workflow.matchAll(/^\s*(?:BUN_VERSION:|bun-version:)\s*(.+?)\s*$/gm)) {
        const value = (match[1] ?? '').replace(/^'|'$/g, '');
        // `bun-version: ${{ env.BUN_VERSION }}` resolves through the same
        // file's env block, which this sweep already checks directly.
        if (value.startsWith('${{')) continue;
        pins.push({ file, version: value });
      }
    }
    expect(pins.length).toBeGreaterThan(0);
    expect(pins.filter((pin) => pin.version !== pinned)).toEqual([]);
  });
});
