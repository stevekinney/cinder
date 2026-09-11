import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  architectureAuthenticityFailure,
  checkDockerAuthenticity,
  formatFailures,
} from './docker-authenticity.ts';

function writePackageJson(playwrightSpec: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'docker-authenticity-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ devDependencies: { '@playwright/test': playwrightSpec } }),
  );
  return join(dir, 'package.json');
}

describe('checkDockerAuthenticity', () => {
  it('rejects a caret-pinned playwright dependency', async () => {
    const packageJsonPath = writePackageJson('^1.60.0');
    await expect(checkDockerAuthenticity(packageJsonPath)).rejects.toThrow(/exact-pinned/i);
  });

  it('rejects a tilde-pinned playwright dependency', async () => {
    const packageJsonPath = writePackageJson('~1.60.0');
    await expect(checkDockerAuthenticity(packageJsonPath)).rejects.toThrow(/exact-pinned/i);
  });

  it('fails when no @playwright/test dependency is declared', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'docker-authenticity-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: {} }));
    await expect(checkDockerAuthenticity(join(dir, 'package.json'))).rejects.toThrow(
      /not declared/i,
    );
  });

  it('returns failures on a macOS dev host (no /etc/os-release, no env baked)', async () => {
    // Test runs on macOS in dev and on Linux in CI. In neither case is the
    // CINDER_PLAYWRIGHT_VERSION env baked, so at minimum that check must
    // fail. On macOS the os-release check also fails.
    const packageJsonPath = writePackageJson('1.60.0');
    delete process.env['CINDER_PLAYWRIGHT_VERSION'];
    const result = await checkDockerAuthenticity(packageJsonPath);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure result');
    const checks = result.failures.map((failure) => failure.check);
    expect(checks).toContain('CINDER_PLAYWRIGHT_VERSION baked at image build');
  });

  it('flags a non-x64 host architecture even when other checks are otherwise satisfied', async () => {
    // The base Playwright image is multi-arch: OS codename, playwright
    // --version, and the baked env var can all still match on an arm64
    // build of the same image. Injecting the architecture directly proves
    // this check fires independently of the other three, which this test
    // environment cannot fully control (no real jammy container here).
    const packageJsonPath = writePackageJson('1.60.0');
    const result = await checkDockerAuthenticity(packageJsonPath, 'arm64');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure result');
    expect(result.failures.map((failure) => failure.check)).toContain('container architecture');
  });

  it('never flags architecture when the container reports the required x64', async () => {
    const packageJsonPath = writePackageJson('1.60.0');
    const result = await checkDockerAuthenticity(packageJsonPath, 'x64');
    if (!result.ok) {
      expect(result.failures.map((failure) => failure.check)).not.toContain(
        'container architecture',
      );
    }
  });

  it('formatFailures names the CI workflow-dispatch route for an architecture mismatch', () => {
    const message = formatFailures([
      { check: 'container architecture', expected: 'x64', actual: 'arm64' },
    ]);
    expect(message).toContain(
      'gh workflow run browser-tests.yaml -f update_baselines=true -f source_ref=<branch> -f base_ref=main',
    );
    // Re-running the docker wrapper would just reproduce the same mismatch —
    // the message may explain that, but must not present it as the fix.
    expect(message).not.toContain(
      'Run "bun run --filter=@cinder/testing test:browser:update:docker" instead.',
    );
  });

  it('formatFailures includes every failed check and points to the docker recipe', () => {
    const message = formatFailures([
      { check: 'os-release VERSION_CODENAME', expected: 'jammy', actual: 'sequoia' },
      {
        check: 'CINDER_PLAYWRIGHT_VERSION baked at image build',
        expected: '1.60.0',
        actual: '<env var unset — likely not inside the cinder-playwright image>',
      },
    ]);
    expect(message).toContain('Refusing to update snapshots');
    expect(message).toContain('os-release VERSION_CODENAME');
    expect(message).toContain('CINDER_PLAYWRIGHT_VERSION baked at image build');
    expect(message).toContain('test:browser:update:docker');
  });
});

describe('architectureAuthenticityFailure', () => {
  it('passes on the required x64 architecture', () => {
    expect(architectureAuthenticityFailure('x64')).toBeUndefined();
  });

  it('flags an arm64 container as a mismatch', () => {
    expect(architectureAuthenticityFailure('arm64')).toEqual({
      check: 'container architecture',
      expected: 'x64',
      actual: 'arm64',
    });
  });
});
