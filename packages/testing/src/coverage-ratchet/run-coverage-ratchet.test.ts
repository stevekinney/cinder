import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { outcomeOf, rethrow } from '../helpers/module-scope-outcome.ts';
import { rejectionOf } from '../helpers/promise-outcome.ts';
import { EXPECTED_SOURCE_GLOBS, runCoverageRatchet } from './run-coverage-ratchet.ts';

const scratchDirectories: string[] = [];

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A package directory holding a ratchet, a coverage report, and the sources it names. */
function packageFixture(
  ratchet: Record<string, unknown>,
  lcov: string,
  sources: Record<string, string> = { 'src/index.ts': 'export const value = 1;\n' },
): string {
  const root = mkdtempSync(join(tmpdir(), 'coverage-ratchet-run-'));
  scratchDirectories.push(root);
  const files = {
    'coverage-ratchet.json': JSON.stringify(ratchet),
    'coverage/lcov.info': lcov,
    ...sources,
  };
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

function lcovRecord(file: string, lines: [number, number][], functions: [number, number]): string {
  return [
    'TN:',
    `SF:${file}`,
    `FNF:${functions[0]}`,
    `FNH:${functions[1]}`,
    ...lines.map(([line, hits]) => `DA:${line},${hits}`),
    `LF:${lines.length}`,
    `LH:${lines.filter(([, hits]) => hits > 0).length}`,
    'end_of_record',
    '',
  ].join('\n');
}

const covered = lcovRecord('src/index.ts', [[1, 1]], [1, 1]);
const underThreshold = lcovRecord(
  'src/index.ts',
  [
    [1, 1],
    [2, 0],
    [3, 0],
  ],
  [2, 1],
);

describe('runCoverageRatchet', () => {
  test('passes a fully covered package and prints the summary', async () => {
    const root = packageFixture({ lines: 1, functions: 1 }, covered);
    const result = await runCoverageRatchet({ packageRoot: root });
    expect(result.exitCode).toBe(0);
    expect(result.messages).toEqual([
      {
        stream: 'log',
        text: 'Coverage ratchet (1 files): functions 100.00% >= 100.00% lines 100.00% >= 100.00%',
      },
    ]);
  });

  test('fails a package under its threshold and names the unhit lines', async () => {
    const root = packageFixture({ lines: 1, functions: 1 }, underThreshold, {
      'src/index.ts':
        'export const first = 1;\nexport const second = 2;\nexport const third = 3;\n',
    });
    const result = await runCoverageRatchet({ packageRoot: root });
    expect(result.exitCode).toBe(1);
    const errors = result.messages.filter((message) => message.stream === 'error');
    expect(errors[0]?.text).toContain(
      'Failed: runtime functions 50.00% < 100.00%, runtime lines 33.33% < 100.00%.',
    );
    expect(errors.at(-1)?.text).toContain('Uncovered runtime lines (1 file(s)):');
    expect(errors.at(-1)?.text).toContain('src/index.ts: 2-3');
  });

  test('passes the same report against a lower threshold', async () => {
    const root = packageFixture({ lines: 0.3, functions: 0.5 }, underThreshold);
    const result = await runCoverageRatchet({ packageRoot: root });
    expect(result.exitCode).toBe(0);
  });

  test('measures the Svelte ratchet separately and fails when it is missed', async () => {
    const lcov =
      covered +
      lcovRecord(
        'src/widget.svelte',
        [
          [1, 1],
          [2, 0],
        ],
        [2, 1],
      );
    const passing = packageFixture(
      { lines: 1, functions: 1, svelte: { lines: 0.5, functions: 0.5 } },
      lcov,
    );
    const passed = await runCoverageRatchet({ packageRoot: passing });
    expect(passed.exitCode).toBe(0);
    expect(passed.messages[0]?.text).toContain('Svelte coverage ratchet (1 files)');

    const failing = packageFixture(
      { lines: 1, functions: 1, svelte: { lines: 0.9, functions: 0.9 } },
      lcov,
    );
    const failed = await runCoverageRatchet({ packageRoot: failing });
    expect(failed.exitCode).toBe(1);
    const errors = failed.messages.filter((message) => message.stream === 'error');
    expect(errors[0]?.text).toContain('svelte lines 50.00% < 90.00%');
    expect(errors.at(-1)?.text).toContain('Uncovered svelte lines (1 file(s)):');
  });

  test('warns when the Svelte floor was measured on another platform, without failing', async () => {
    const lcov = covered + lcovRecord('src/widget.svelte', [[1, 1]], [1, 1]);
    const root = packageFixture(
      {
        lines: 1,
        functions: 1,
        svelte: { lines: 0.5, functions: 0.5 },
        svelteMeasuredOn: { platform: 'linux', architecture: 'x64' },
      },
      lcov,
    );
    const result = await runCoverageRatchet({
      packageRoot: root,
      platform: { platform: 'darwin', architecture: 'arm64' },
    });
    expect(result.exitCode).toBe(0);
    expect(result.messages[0]).toMatchObject({ stream: 'warn' });
    expect(result.messages[0]?.text).toContain('linux/x64');
  });

  test('fails a fully covered run when runtime source imports test support', async () => {
    const root = packageFixture({ lines: 1, functions: 1 }, covered, {
      'src/index.ts': "export { open } from './index-test-helpers.js';\n",
      'src/index-test-helpers.ts': 'export const open = 1;\n',
    });
    const result = await runCoverageRatchet({ packageRoot: root });
    expect(result.exitCode).toBe(1);
    const text = result.messages.map((message) => message.text).join('\n');
    expect(text).toContain('src/index.ts imports ./index-test-helpers.js');
    expect(text).toContain('1 runtime import(s) of test support modules');
  });

  test('fails a fully covered run when only a subpath export imports test support', async () => {
    const root = packageFixture({ lines: 1, functions: 1 }, covered, {
      'src/index.ts': 'export const value = 1;\n',
      'src/bun/index.ts': "export { open } from './process-test-helpers.ts';\n",
      'src/bun/process-test-helpers.ts': 'export const open = 1;\n',
      'package.json': JSON.stringify({
        exports: { '.': './src/index.ts', './bun': './src/bun/index.ts' },
      }),
    });
    const result = await runCoverageRatchet({ packageRoot: root });
    expect(result.exitCode).toBe(1);
    const text = result.messages.map((message) => message.text).join('\n');
    expect(text).toContain('src/bun/index.ts imports ./process-test-helpers.ts');
    expect(text).toContain('1 runtime import(s) of test support modules');
  });

  test('rejects a package with no coverage report', async () => {
    const root = packageFixture({ lines: 1, functions: 1 }, '');
    const rejection = await rejectionOf(runCoverageRatchet({ packageRoot: root }));
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toContain('LCOV report did not contain any records');
  });
});

describe('checkCoverageRatchet', async () => {
  // Run in a child process: it records its outcome on `process.exitCode`, which a test runner would
  // otherwise read as its own.
  function runCheck(root: string) {
    const caller = join(root, 'check.ts');
    writeFileSync(
      caller,
      `import { checkCoverageRatchet } from ${JSON.stringify(join(import.meta.dir, 'run-coverage-ratchet.ts'))};\n` +
        `await checkCoverageRatchet({ packageRoot: ${JSON.stringify(root)} });\n`,
    );
    return Bun.spawnSync([process.execPath, caller], { timeout: 120_000 });
  }

  // Each check is a real child process, so it runs once at module scope, off the per-test clock.
  const holdingThresholdsOutcome = await outcomeOf(() => {
    const result = runCheck(packageFixture({ lines: 1, functions: 1 }, covered));
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('Coverage ratchet (1 files)');
    expect(result.stderr.toString()).toBe('');
  });
  test('prints the summary and exits 0 when every threshold holds', () =>
    rethrow(holdingThresholdsOutcome));

  const missedThresholdOutcome = await outcomeOf(() => {
    const result = runCheck(packageFixture({ lines: 1, functions: 1 }, underThreshold));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('Failed: runtime');
    expect(result.stdout.toString()).toBe('');
  });
  test('prints the failure on stderr and exits 1 when a threshold is missed', () =>
    rethrow(missedThresholdOutcome));

  describe('expectedSourceGlobs', () => {
    const sources = {
      'src/index.ts': 'export const value = 1;\n',
      'src/unloaded.ts': 'export const never = 1;\n',
      'src/index.test.ts': "import './index.ts';\n",
      'src/test/harness.ts': 'export {};\n',
      'src/types.d.ts': 'export type T = 1;\n',
      'src/widget.svelte': '<p>hi</p>\n',
    };
    const expectedSourceGlobs = ['src/**/*.ts', 'src/**/*.svelte'];

    test('EXPECTED_SOURCE_GLOBS expects every TypeScript extension, but not test files', async () => {
      const files = {
        'src/index.ts': '',
        'src/a.ts': '',
        'src/b.tsx': '',
        'src/c.mts': '',
        'src/d.cts': '',
        'src/f.test.tsx': '',
        'src/helpers.test-support.ts': '',
        'src/nested/__fixtures__/data.ts': '',
        'src/nested/test/harness.ts': '',
        'src/nested/tests/harness.ts': '',
        'src/nested/mount-harness.ts': '',
        'src/g.spec.mts': '',
        'src/h.d.ts': '',
        'src/i.d.mts': '',
        'src/j.d.cts': '',
      };
      const root = packageFixture({ lines: 1, functions: 1 }, covered, files);
      const result = await runCoverageRatchet({
        packageRoot: root,
        expectedSourceGlobs: EXPECTED_SOURCE_GLOBS,
      });
      const text = result.messages.map((message) => message.text).join('\n');
      for (const file of ['a.ts', 'b.tsx', 'c.mts', 'd.cts']) {
        expect(text).toContain(`  src/${file}`);
      }
      expect(text).toContain('  src/nested/mount-harness.ts');
      expect(text).not.toMatch(
        /f\.test|g\.spec|h\.d|i\.d|j\.d|test-support|__fixtures__|nested\/tests?\//,
      );
    });

    test('ignores files the tests never loaded unless the option is given', async () => {
      const root = packageFixture({ lines: 1, functions: 1 }, covered, sources);
      const result = await runCoverageRatchet({ packageRoot: root });
      expect(result.exitCode).toBe(0);
    });

    test('fails when an in-scope source file has no LCOV record, naming it', async () => {
      const root = packageFixture({ lines: 1, functions: 1 }, covered, sources);
      const result = await runCoverageRatchet({ packageRoot: root, expectedSourceGlobs });
      expect(result.exitCode).toBe(1);
      const errors = result.messages.filter((message) => message.stream === 'error');
      expect(errors.map(({ text }) => text).join('\n')).toContain(
        'Failed: 1 source file(s) missing from LCOV.',
      );
      expect(errors.map(({ text }) => text).join('\n')).toContain('  src/unloaded.ts');
      // Test files, test directories, declaration files, and unmeasured Svelte are not expected.
      expect(errors.map(({ text }) => text).join('\n')).not.toMatch(
        /index\.test|harness|types\.d|widget/,
      );
    });

    test('passes when every in-scope file has a record, even one with no executable lines', async () => {
      const lcov = covered + lcovRecord('src/unloaded.ts', [], [0, 0]);
      const root = packageFixture({ lines: 1, functions: 1 }, lcov, sources);
      const result = await runCoverageRatchet({ packageRoot: root, expectedSourceGlobs });
      expect(result.exitCode).toBe(0);
    });

    test('expects Svelte modules only when the ratchet measures them', async () => {
      const lcov =
        covered +
        lcovRecord('src/unloaded.ts', [], [0, 0]) +
        lcovRecord('src/other.svelte', [[1, 1]], [1, 1]);
      const root = packageFixture(
        { lines: 1, functions: 1, svelte: { lines: 0, functions: 0 } },
        lcov,
        sources,
      );
      const result = await runCoverageRatchet({ packageRoot: root, expectedSourceGlobs });
      expect(result.exitCode).toBe(1);
      expect(result.messages.map(({ text }) => text).join('\n')).toContain('  src/widget.svelte');
    });
  });
});
