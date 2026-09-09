import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPinnedBunVersion } from './update-snapshots-docker.ts';

const testingPackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(testingPackageRoot, '../..');
const workflowsRoot = resolve(workspaceRoot, '.github/workflows');

/**
 * The only expression a `bun-version` input may hold.
 *
 * Anything else is refused rather than reasoned about. A typo like
 * `${{ env.BUN_VERSOIN }}` resolves to the empty string and `setup-bun`
 * installs whatever it likes; `${{ vars.BUN_VERSION }}` resolves to whatever
 * a repository or organization variable happens to hold, which is worse —
 * a value this repository cannot see, review, or keep in step with
 * `packageManager`. Neither is checkable from the tree, so neither is allowed.
 */
const ENVIRONMENT_REFERENCE = '${{ env.BUN_VERSION }}';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The `BUN_VERSION` an `env:` mapping declares, if any.
 *
 * YAML scalars come back typed, so `bun-version: 1.2` would arrive as a
 * number. Everything is compared as a string, which is also how Actions
 * substitutes it.
 */
function declaredBunVersion(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined;
  const environment = node['env'];
  if (!isRecord(environment)) return undefined;
  const declared = environment['BUN_VERSION'];
  return declared === undefined || declared === null ? undefined : String(declared);
}

type SetupBunStep = {
  location: string;
  /** The `bun-version` input, or `undefined` when the step carries none. */
  input: string | undefined;
  /**
   * What `${{ env.BUN_VERSION }}` would resolve to for THIS step: its own
   * `env`, else its job's, else the workflow's. Scope is the point — a
   * `BUN_VERSION` declared under one job is invisible to every other.
   */
  resolvedEnvironmentPin: string | undefined;
};

/**
 * Every `setup-bun` step in a parsed workflow, each carrying the version it
 * would actually install.
 *
 * Parsed rather than pattern-matched. Three rounds of review found three ways
 * around a line-oriented reader — an expression that was skipped instead of
 * checked, a declaration under a job that a file-level check accepted, and a
 * `bun-version` sitting outside the action's own `with:` mapping. Flow-style
 * YAML (`env: { BUN_VERSION: 1.4.0 }`) would have been a fourth. Reading the
 * structure ends the whole class rather than the last instance of it.
 */
function collectSetupBunSteps(file: string, workflow: unknown): SetupBunStep[] {
  const collected: SetupBunStep[] = [];
  if (!isRecord(workflow)) return collected;
  const workflowPin = declaredBunVersion(workflow);
  const jobs = workflow['jobs'];
  if (!isRecord(jobs)) return collected;

  for (const [jobName, job] of Object.entries(jobs)) {
    if (!isRecord(job)) continue;
    const jobPin = declaredBunVersion(job) ?? workflowPin;
    const steps = job['steps'];
    if (!Array.isArray(steps)) continue;

    for (const [index, step] of steps.entries()) {
      if (!isRecord(step)) continue;
      const uses = step['uses'];
      if (typeof uses !== 'string' || !uses.startsWith('oven-sh/setup-bun')) continue;
      const inputs = step['with'];
      const input = isRecord(inputs) ? inputs['bun-version'] : undefined;
      collected.push({
        location: `${file} › ${jobName} › step ${index + 1}`,
        input: input === undefined || input === null ? undefined : String(input),
        resolvedEnvironmentPin: declaredBunVersion(step) ?? jobPin,
      });
    }
  }
  return collected;
}

/** Every `BUN_VERSION` an `env:` mapping declares, at any scope. */
function collectDeclarations(
  file: string,
  workflow: unknown,
): { location: string; version: string }[] {
  const collected: { location: string; version: string }[] = [];
  if (!isRecord(workflow)) return collected;

  const workflowPin = declaredBunVersion(workflow);
  if (workflowPin !== undefined)
    collected.push({ location: `${file} › env`, version: workflowPin });

  const jobs = workflow['jobs'];
  if (!isRecord(jobs)) return collected;
  for (const [jobName, job] of Object.entries(jobs)) {
    if (!isRecord(job)) continue;
    const jobPin = declaredBunVersion(job);
    if (jobPin !== undefined)
      collected.push({ location: `${file} › ${jobName} › env`, version: jobPin });
    const steps = job['steps'];
    if (!Array.isArray(steps)) continue;
    for (const [index, step] of steps.entries()) {
      const stepPin = declaredBunVersion(step);
      if (stepPin !== undefined) {
        collected.push({
          location: `${file} › ${jobName} › step ${index + 1} › env`,
          version: stepPin,
        });
      }
    }
  }
  return collected;
}

function readWorkflows(): { file: string; workflow: unknown }[] {
  return readdirSync(workflowsRoot)
    .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
    .map((file) => ({
      file,
      workflow: Bun.YAML.parse(readFileSync(resolve(workflowsRoot, file), 'utf8')) as unknown,
    }));
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

  it('declares the pinned version everywhere it declares one at all', () => {
    // Checking one workflow let the other ten drift: the pin lives in eleven
    // places across `BUN_VERSION` env blocks and `setup-bun` inputs, and a
    // bump that misses any of them puts a job on a different Bun than the
    // container and the workspace. A stale declaration nothing reads today is
    // a trap for whoever wires the next reference to it, so it fails too.
    const pinned = readPinnedBunVersion();
    const declarations = readWorkflows().flatMap(({ file, workflow }) =>
      collectDeclarations(file, workflow),
    );
    expect(declarations.length).toBeGreaterThan(0);
    expect(declarations.filter((declaration) => declaration.version !== pinned)).toEqual([]);
  });

  it('installs that same version in every setup-bun step', () => {
    const pinned = readPinnedBunVersion();
    const steps = readWorkflows().flatMap(({ file, workflow }) =>
      collectSetupBunSteps(file, workflow),
    );

    // A formatting or key change that stops matching must fail loudly rather
    // than pass over an empty list.
    expect(steps.length).toBeGreaterThan(0);

    // No input at all means `setup-bun` picks its own version — the unpinned
    // install this whole file exists to forbid.
    expect(steps.filter((step) => step.input === undefined).map((step) => step.location)).toEqual(
      [],
    );

    const wrong = steps.filter((step) => {
      if (step.input === pinned) return false;
      if (step.input !== ENVIRONMENT_REFERENCE) return true;
      // The reference is only as good as what it resolves to for THIS step.
      return step.resolvedEnvironmentPin !== pinned;
    });
    // Report what the step resolves to, not just what it says. An input of
    // `${{ env.BUN_VERSION }}` is correct or not depending entirely on the
    // environment chain behind it, and a message showing only the expression
    // sends the reader looking at the one line that is fine.
    expect(
      wrong.map((step) => {
        const resolved =
          step.input === ENVIRONMENT_REFERENCE
            ? ` → ${step.resolvedEnvironmentPin ?? '(no BUN_VERSION in scope)'}`
            : '';
        return `${step.location}: ${step.input ?? '(no bun-version input)'}${resolved}`;
      }),
    ).toEqual([]);
  });
});
