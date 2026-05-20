import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDockerAuthenticity, formatFailures } from './docker-authenticity.ts';

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
