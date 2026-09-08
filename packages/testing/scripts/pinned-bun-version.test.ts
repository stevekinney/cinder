import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
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
    expect(readPinnedBunVersion()).toBe(
      readWorkspaceManifest().packageManager?.replace('bun@', ''),
    );
  });

  it('installs that exact version in the image rather than whatever bun.sh serves', () => {
    // The install line took no version at all, so an image built today ran a
    // Bun the repository never pinned — the failure mode this guards.
    const dockerfile = readFileSync(resolve(testingPackageRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/ARG BUN_VERSION/);
    expect(dockerfile).toMatch(/bun\.sh\/install \| bash -s "bun-v\$\{BUN_VERSION\}"/);
  });

  it('is the same Bun every workflow job installs', () => {
    const workflow = readFileSync(
      resolve(workspaceRoot, '.github/workflows/browser-tests.yaml'),
      'utf8',
    );
    const pinned = workflow.match(/^\s*BUN_VERSION:\s*(\S+)\s*$/m)?.[1];
    expect(pinned).toBe(readPinnedBunVersion());
  });
});
