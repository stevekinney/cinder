import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPinnedBunVersion } from './update-snapshots-docker.ts';

const testingPackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(testingPackageRoot, '../..');

/**
 * True when the declaration on `index` sits in the workflow's own top-level
 * `env:` block, which every job in the file can read.
 *
 * Scope is the whole point: a `BUN_VERSION` nested under one job is invisible
 * to the others, so a `${{ env.BUN_VERSION }}` reference in a different job
 * would resolve to the empty string and `setup-bun` would install whatever it
 * likes — while a file-level "this file declares it" check waved it through.
 */
function declaredAtWorkflowScope(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? '';
  if (line.length - line.trimStart().length !== 2) return false;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = lines[cursor] ?? '';
    if (candidate.trim().length === 0) continue;
    if (candidate.length - candidate.trimStart().length >= 2) continue;
    return candidate.trimEnd() === 'env:';
  }
  return false;
}

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
    const references: { file: string; value: string }[] = [];
    const filesDeclaringEnvironmentPin = new Set<string>();
    for (const file of readdirSync(workflowsRoot)) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const lines = readFileSync(resolve(workflowsRoot, file), 'utf8').split('\n');
      for (const [index, line] of lines.entries()) {
        const declaration = /^\s*(BUN_VERSION|bun-version):\s*(.+?)\s*$/.exec(line);
        if (declaration === null) continue;
        const value = (declaration[2] ?? '').replace(/^'|'$/g, '');
        if (value.startsWith('${{')) {
          references.push({ file, value });
          continue;
        }
        if (declaration[1] === 'BUN_VERSION' && declaredAtWorkflowScope(lines, index)) {
          filesDeclaringEnvironmentPin.add(file);
        }
        pins.push({ file, version: value });
      }
    }
    expect(pins.length).toBeGreaterThan(0);
    expect(pins.filter((pin) => pin.version !== pinned)).toEqual([]);

    // An expression is not a free pass. `${{ vars.BUN_VERSION }}`, or a typo
    // like `${{ env.BUN_VERSOIN }}`, installs some other Bun (or none at all)
    // while every literal declaration elsewhere keeps the assertion above
    // green. Exactly one expression is admissible, and only in a file whose
    // declaration every job can actually read — see `declaredAtWorkflowScope`.
    expect(references.filter((reference) => reference.value !== '${{ env.BUN_VERSION }}')).toEqual(
      [],
    );
    expect(
      references.filter((reference) => !filesDeclaringEnvironmentPin.has(reference.file)),
    ).toEqual([]);
  });

  it('leaves no setup-bun step without a version to install', () => {
    // Scanning declarations only finds the pins that exist. A `setup-bun` step
    // that never had a `bun-version` input, or lost one, falls back to the
    // action's own default — the unpinned install this file exists to forbid —
    // while every other file's declaration keeps the sweep above green. So
    // enumerate the steps, not the declarations.
    const workflowsRoot = resolve(workspaceRoot, '.github/workflows');
    const stepsWithoutAVersion: string[] = [];
    let stepsChecked = 0;
    for (const file of readdirSync(workflowsRoot)) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const lines = readFileSync(resolve(workflowsRoot, file), 'utf8').split('\n');
      for (const [index, line] of lines.entries()) {
        const listItem = /^(\s*)-\s/.exec(line);
        if (listItem === null) continue;
        const indent = (listItem[1] ?? '').length;
        const step = [line];
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
          const next = lines[cursor] ?? '';
          if (next.trim().length === 0) continue;
          if (next.length - next.trimStart().length <= indent) break;
          step.push(next);
        }
        const body = step.join('\n');
        if (!body.includes('oven-sh/setup-bun')) continue;
        stepsChecked += 1;
        if (!/^\s*bun-version:/m.test(body)) stepsWithoutAVersion.push(`${file}:${index + 1}`);
      }
    }
    expect(stepsChecked).toBeGreaterThan(0);
    expect(stepsWithoutAVersion).toEqual([]);
  });
});
