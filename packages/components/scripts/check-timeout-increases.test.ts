import { describe, expect, test } from 'bun:test';

import {
  findTimeoutIncreaseViolations,
  formatTimeoutIncreaseViolations,
} from './check-timeout-increases.ts';

function diffFor(filePath: string, removed: string[], added: string[]): string {
  return [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -10,${removed.length} +10,${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
    '',
  ].join('\n');
}

describe('check-timeout-increases', () => {
  test('rejects comparable timeout, retry, workflow, waitFor, and slow threshold increases', () => {
    const diff = [
      diffFor(
        'packages/components/src/button/button.test.ts',
        [
          "await page.locator('[data-ready]').waitFor({ timeout: 5_000 });",
          'test.describe.configure({ retries: 1 });',
          'test.slow(2);',
        ],
        [
          "await page.locator('[data-ready]').waitFor({ timeout: 10_000 });",
          'test.describe.configure({ retries: 3 });',
          'test.slow(3);',
        ],
      ),
      diffFor(
        '.github/workflows/unit-tests.yaml',
        ['    timeout-minutes: 5'],
        ['    timeout-minutes: 10'],
      ),
      diffFor(
        'packages/components/scripts/probe.sh',
        ['bun test --timeout 5000'],
        ['bun test --timeout 6000'],
      ),
    ].join('\n');

    const violations = findTimeoutIncreaseViolations(diff);

    expect(violations.map((violation) => violation.new.renderedValue)).toEqual([
      '10_000',
      '3',
      '3',
      '10',
      '6000',
    ]);
  });

  test('allows unchanged values, reductions, and newly introduced bounded operations', () => {
    const diff = [
      diffFor(
        'packages/components/src/button/button.test.ts',
        [
          'await expect(locator).toBeVisible({ timeout: 5_000 });',
          'test.describe.configure({ retries: 2 });',
        ],
        [
          'await expect(locator).toBeVisible({ timeout: 5_000 });',
          'test.describe.configure({ retries: 1 });',
          'await page.waitForTimeout(250);',
        ],
      ),
      diffFor(
        'packages/components/src/new-test.ts',
        [],
        ['await page.locator("main").waitFor({ timeout: 1_000 });'],
      ),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toEqual([]);
  });

  test('matches settings instead of positions when thresholds are reordered or inserted', () => {
    const reordered = diffFor(
      'packages/components/src/button/button.test.ts',
      ['await first.waitFor({ timeout: 5_000 });', 'await second.waitFor({ timeout: 10_000 });'],
      ['await second.waitFor({ timeout: 10_000 });', 'await first.waitFor({ timeout: 5_000 });'],
    );
    const insertedBeforeIncrease = diffFor(
      'packages/components/src/dialog/dialog.test.ts',
      ['await dialog.waitFor({ timeout: 5_000 });'],
      ['await setup.waitFor({ timeout: 1_000 });', 'await dialog.waitFor({ timeout: 10_000 });'],
    );

    expect(findTimeoutIncreaseViolations(reordered)).toEqual([]);
    expect(findTimeoutIncreaseViolations(insertedBeforeIncrease)).toHaveLength(1);
  });

  test('detects a per-callsite increase when generic threshold values swap', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['await first.waitFor({ timeout: 5_000 });', 'await second.waitFor({ timeout: 10_000 });'],
        ['await first.waitFor({ timeout: 10_000 });', 'await second.waitFor({ timeout: 5_000 });'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.new.line).toContain('first.waitFor');
  });

  test('preserves callsites when an increased threshold takes another old value', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['await first.waitFor({ timeout: 5_000 });', 'await second.waitFor({ timeout: 10_000 });'],
        ['await first.waitFor({ timeout: 10_000 });', 'await second.waitFor({ timeout: 4_000 });'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.new.line).toContain('first.waitFor');
  });

  test('preserves multiple timeout callsites on one source line', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.setTimeout(5_000); test.setTimeout(10_000);'],
        ['test.setTimeout(10_000); test.setTimeout(4_000);'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(5_000);
    expect(violations[0]?.new.value).toBe(10_000);
  });

  test('preserves equal-valued timeout callsites on one source line', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.setTimeout(5_000); test.setTimeout(5_000);'],
        ['test.setTimeout(5_000); test.setTimeout(10_000);'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(5_000);
    expect(violations[0]?.new.value).toBe(10_000);
  });

  test('rejects a newly added zero-argument test.slow()', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor('packages/components/src/button/button.test.ts', [], ['test.slow();']),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.renderedValue).toBe('1 (implicit normal timeout)');
    expect(violations[0]?.new.renderedValue).toBe('3');
  });

  test('rejects newly added conditional test.slow() and positive retries', () => {
    const diff = diffFor(
      'packages/components/src/button/button.test.ts',
      [],
      ['test.slow(process.platform === "darwin");', 'test.describe.configure({ retries: 2 });'],
    );

    const violations = findTimeoutIncreaseViolations(diff);
    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.old.renderedValue)).toEqual([
      '1 (implicit normal timeout)',
      '0 (implicit default retries)',
    ]);
  });

  test('rejects named timeout constant increases', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        ['const HYDRATION_TEARDOWN_TIMEOUT_MS = 5_000;'],
        ['const HYDRATION_TEARDOWN_TIMEOUT_MS = 10_000;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('rejects renamed timeout constant increases at the same callsite', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        ['const OLD_TIMEOUT_MS = 5_000;'],
        ['const NEW_TIMEOUT_MS = 10_000;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks timeout flags in package manifests', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/package.json',
        ['  "test": "bun test --timeout 5000"'],
        ['  "test": "bun test --timeout 10000"'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks quoted configuration keys in source files', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.describe.configure({ \'retries\': 1, "timeout": 5_000 });'],
        ['test.describe.configure({ \'retries\': 2, "timeout": 10_000 });'],
      ),
    );

    expect(violations).toHaveLength(2);
  });

  test('checks timeout calls whose numeric argument is on the next line', () => {
    const diff = [
      'diff --git a/packages/components/src/button/button.test.ts b/packages/components/src/button/button.test.ts',
      '--- a/packages/components/src/button/button.test.ts',
      '+++ b/packages/components/src/button/button.test.ts',
      '@@ -10,3 +10,3 @@',
      ' test.setTimeout(',
      '-  5_000,',
      '+  10_000,',
      ' );',
      '',
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('checks default navigation timeout calls on one or multiple lines', () => {
    const singleLine = diffFor(
      'packages/components/src/button/button.test.ts',
      ['page.setDefaultNavigationTimeout(5_000);'],
      ['page.setDefaultNavigationTimeout(10_000);'],
    );
    const multiline = [
      'diff --git a/packages/components/src/dialog/dialog.test.ts b/packages/components/src/dialog/dialog.test.ts',
      '--- a/packages/components/src/dialog/dialog.test.ts',
      '+++ b/packages/components/src/dialog/dialog.test.ts',
      '@@ -10,3 +10,3 @@',
      ' page.setDefaultNavigationTimeout(',
      '-  5_000,',
      '+  10_000,',
      ' );',
      '',
    ].join('\n');

    expect(findTimeoutIncreaseViolations([singleLine, multiline].join('\n'))).toHaveLength(2);
  });

  test('checks multiline configuration assignments', () => {
    const diff = [
      'diff --git a/packages/components/src/button/button.test.ts b/packages/components/src/button/button.test.ts',
      '--- a/packages/components/src/button/button.test.ts',
      '+++ b/packages/components/src/button/button.test.ts',
      '@@ -10,3 +10,3 @@',
      ' test.describe.configure({ timeout:',
      '-  5_000,',
      '+  10_000,',
      ' });',
      '',
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('matches the same setting across whitespace-only formatting edits', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.describe.configure({ timeout:5_000 });'],
        ['test.describe.configure({ timeout: 10_000 });'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('matches equivalent timeout spellings', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.describe.configure({ testTimeout: 5_000 });'],
        ['test.describe.configure({ timeout: 10_000 });'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('keeps distinct named threshold identities separate across files', () => {
    const violations = findTimeoutIncreaseViolations(
      [
        diffFor(
          'packages/components/scripts/first-readiness.ts',
          ['const FIRST_TIMEOUT_MS = 5_000;'],
          [],
        ),
        diffFor(
          'packages/components/scripts/second-readiness.ts',
          [],
          ['const SECOND_TIMEOUT_MS = 10_000;'],
        ),
      ].join('\n'),
    );

    expect(violations).toEqual([]);
  });

  test('ignores retry-shaped domain data outside test configuration', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/playground/src/examples/schema-form/json-schema.example.svelte',
        ["value={{ name: 'Refresh indexes', retries: 2 }}"],
        ["value={{ name: 'Refresh indexes', retries: 3 }}"],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('matches moved thresholds across diff hunks and files', () => {
    const diff = [
      diffFor('packages/components/src/old-location.test.ts', ['const ROUTE_TIMEOUT = 5_000;'], []),
      diffFor(
        'packages/components/src/new-location.test.ts',
        [],
        ['const ROUTE_TIMEOUT = 10_000;'],
      ),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('does not pair unrelated generic thresholds across files', () => {
    const diff = [
      diffFor('packages/components/src/removed.test.ts', ['test.setTimeout(5_000);'], []),
      diffFor('packages/components/src/added.test.ts', [], ['test.setTimeout(10_000);']),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toEqual([]);
  });

  test('preserves named thresholds moved out of deleted files', () => {
    const diff = [
      'diff --git a/packages/components/src/old.test.ts b/packages/components/src/old.test.ts',
      'deleted file mode 100644',
      '--- a/packages/components/src/old.test.ts',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-const ROUTE_TIMEOUT = 5_000;',
      diffFor('packages/components/src/new.test.ts', [], ['const ROUTE_TIMEOUT = 10_000;']),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('checks Bun test timeouts supplied as a trailing argument', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/convention.test.ts',
        ["test('old', () => {", '  expect(true).toBe(true);', '}, 30_000);'],
        ["test('old', () => {", '  expect(true).toBe(true);', '}, 60_000);'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks Bun test timeouts after function-reference callbacks', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/convention.test.ts',
        ["test('old', handler, 5_000);"],
        ["test('old', handler, 10_000);"],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('compares newly added Bun test timeouts with the runner default', () => {
    const increased = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        [],
        ["test('case', handler, 10_000);"],
      ),
    );
    const reduced = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        [],
        ["test('case', handler, 4_000);"],
      ),
    );

    expect(increased).toHaveLength(1);
    expect(reduced).toEqual([]);
  });

  test('checks retries inside multiline Playwright configuration', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/example.test.ts',
        ['test.describe.configure({', '  retries: 1,', '});'],
        ['test.describe.configure({', '  retries: 2,', '});'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('treats a zero Playwright timeout as unbounded', () => {
    const disabled = findTimeoutIncreaseViolations(
      diffFor('packages/testing/playwright.config.ts', ['timeout: 90_000,'], ['timeout: 0,']),
    );
    const restored = findTimeoutIncreaseViolations(
      diffFor('packages/testing/playwright.config.ts', ['timeout: 0,'], ['timeout: 90_000,']),
    );

    expect(disabled).toHaveLength(1);
    expect(restored).toEqual([]);
  });

  test('rejects a newly introduced unbounded timeout', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor('packages/testing/playwright.config.ts', [], ['timeout: 0,']),
    );

    expect(violations).toHaveLength(1);
  });

  test('does not let an unrelated removal mask a local increase', () => {
    const diff = [
      diffFor(
        'packages/components/src/increased.test.ts',
        ['test.setTimeout(5_000);'],
        ['test.setTimeout(10_000);'],
      ),
      diffFor('packages/components/src/deleted.test.ts', ['test.setTimeout(20_000);'], []),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('checks lower-camel timeout identifiers', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/consumer-readiness.test.ts',
        ['const timeoutMs = 1_000;'],
        ['const timeoutMs = 2_000;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('classifies retrieve-prefixed timing identifiers as timeouts', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/consumer-readiness.test.ts',
        ['const retrieveTimeoutMs = 5_000;'],
        ['const retrieveTimeoutMs = 10_000;'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.new.kind).toBe('timeout');
  });

  test('checks lower-snake-case threshold identifiers', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/consumer-readiness.test.ts',
        ['const test_timeout_ms = 5_000;'],
        ['const test_timeout_ms = 10_000;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks multiline lower-snake-case threshold identifiers', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/consumer-readiness.test.ts',
        ['const test_timeout_ms =', '  5_000;'],
        ['const test_timeout_ms =', '  10_000;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks typed timeout declarations', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/consumer-readiness.test.ts',
        ['const timeoutMs: number = 5_000;'],
        ['const timeoutMs: number = 10_000;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks typed multiline timeout declarations', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/consumer-readiness.test.ts',
        ['const timeoutMs: number =', '  5_000;'],
        ['const timeoutMs: number =', '  10_000;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('compares new Playwright test timeouts with the runner default', () => {
    const increased = findTimeoutIncreaseViolations(
      diffFor('packages/components/src/button/button.test.ts', [], ['test.setTimeout(60_000);']),
    );
    const reduced = findTimeoutIncreaseViolations(
      diffFor('packages/components/src/button/button.test.ts', [], ['test.setTimeout(10_000);']),
    );

    expect(increased).toHaveLength(1);
    expect(reduced).toEqual([]);
  });

  test('ignores timeout-shaped rendered prose', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/playground/src/status.svelte',
        ['<p>Timeout: 5 seconds</p>'],
        ['<p>Timeout: 10 seconds</p>'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('checks exact CLI threshold arguments in executable string arrays', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/scripts/update-snapshots.ts',
        ["const arguments = ['--retries=0'];"],
        ["const arguments = ['--retries=2'];"],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('compares new Bun CLI timeouts with the runner default', () => {
    const increased = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/package.json',
        ['"test": "bun test"'],
        ['"test": "bun test --timeout=10000"'],
      ),
    );
    const reduced = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/package.json',
        ['"test": "bun test"'],
        ['"test": "bun test --timeout=4000"'],
      ),
    );

    expect(increased).toHaveLength(1);
    expect(reduced).toEqual([]);
  });

  test('compares new Bun argv timeouts with the runner default', () => {
    const increased = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/scripts/run-tests.ts',
        ["const command = ['bun', 'test'];"],
        ["const command = ['bun', 'test', '--timeout=10000'];"],
      ),
    );
    const reduced = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/scripts/run-tests.ts',
        ["const command = ['bun', 'test'];"],
        ["const command = ['bun', 'test', '--timeout=4000'];"],
      ),
    );

    expect(increased).toHaveLength(1);
    expect(reduced).toEqual([]);
  });

  test('checks TypeScript module-extension test files', () => {
    for (const extension of ['mts', 'cts']) {
      const violations = findTimeoutIncreaseViolations(
        diffFor(
          `packages/components/src/example.test.${extension}`,
          ['test.setTimeout(5_000);'],
          ['test.setTimeout(10_000);'],
        ),
      );

      expect(violations).toHaveLength(1);
    }
  });

  test('checks split CLI threshold arguments in executable string arrays', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/scripts/update-snapshots.ts',
        ["const arguments = ['--timeout', '5000'];"],
        ["const arguments = ['--timeout', '10000'];"],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.new.value).toBe(10_000);
  });

  test('checks split CLI threshold arguments across executable array lines', () => {
    const diff = [
      'diff --git a/packages/testing/scripts/update-snapshots.ts b/packages/testing/scripts/update-snapshots.ts',
      '--- a/packages/testing/scripts/update-snapshots.ts',
      '+++ b/packages/testing/scripts/update-snapshots.ts',
      '@@ -10,4 +10,4 @@',
      ' const arguments = [',
      "   '--timeout',",
      "-  '5000',",
      "+  '10000',",
      ' ];',
      '',
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('checks Bun rerun-each retry flags', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'package.json',
        ['"test": "bun test --rerun-each=2"'],
        ['"test": "bun test --rerun-each=3"'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.new.kind).toBe('retries');
  });

  test('ignores nested CLI argument fixtures inside source strings', () => {
    const diff = diffFor(
      'packages/components/scripts/check-timeout-increases.test.ts',
      [],
      [`    ["const arguments = ['--retries=2'];"],`],
    );

    expect(findTimeoutIncreaseViolations(diff)).toEqual([]);
  });

  test('ignores standalone CLI-shaped prose strings', () => {
    const diff = diffFor('packages/components/src/usage.ts', [], ["const usage = '--retries=2';"]);

    expect(findTimeoutIncreaseViolations(diff)).toEqual([]);
  });

  test('evaluates complete constant numeric timeout expressions', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.setTimeout(60_000 * 2);'],
        ['test.setTimeout(60_000 * 3);'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(120_000);
    expect(violations[0]?.new.value).toBe(180_000);
  });

  test('evaluates parenthesized constant numeric timeout expressions', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.setTimeout(60_000 * (1 + 1));'],
        ['test.setTimeout(60_000 * (1 + 2));'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(120_000);
    expect(violations[0]?.new.value).toBe(180_000);
  });

  test('evaluates scientific-notation timeout literals', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.setTimeout(5e3);'],
        ['test.setTimeout(5e4);'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(5_000);
    expect(violations[0]?.new.value).toBe(50_000);
  });

  test('evaluates non-decimal JavaScript timeout literals', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.setTimeout(0x1388);', 'test.setTimeout(0b1001110001000);'],
        ['test.setTimeout(0x2710);', 'test.setTimeout(0o23420);'],
      ),
    );

    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.old.value)).toEqual([5_000, 5_000]);
    expect(violations.map((violation) => violation.new.value)).toEqual([10_000, 10_000]);
  });

  test('checks numeric branches in conditional timeout settings', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        ['timeout: process.env.CI ? 5_000 : 1_000,'],
        ['timeout: process.env.CI ? 10_000 : 1_000,'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(5_000);
    expect(violations[0]?.new.value).toBe(10_000);
  });

  test('checks polling and delay constants in validation infrastructure', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        ['const SVELTEKIT_DEV_SSR_POLL_INTERVAL_MS = 200;', 'const retryDelayMs = 100;'],
        ['const SVELTEKIT_DEV_SSR_POLL_INTERVAL_MS = 2_000;', 'const retryDelayMs = 500;'],
      ),
    );

    expect(violations).toHaveLength(2);
  });

  test('analyzes removed thresholds using the source path of a rename', () => {
    const diff = [
      'diff --git a/packages/components/src/button/button.test.ts b/packages/components/src/button/button.ts',
      'similarity index 90%',
      'rename from packages/components/src/button/button.test.ts',
      'rename to packages/components/src/button/button.ts',
      '--- a/packages/components/src/button/button.test.ts',
      '+++ b/packages/components/src/button/button.ts',
      '@@ -10,1 +10,1 @@',
      '-setTimeout(resolve, 5_000);',
      '+setTimeout(resolve, 10_000);',
      '',
    ].join('\n');

    const violations = findTimeoutIncreaseViolations(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(5_000);
    expect(violations[0]?.new.value).toBe(10_000);
  });

  test('compares a new Bun setDefaultTimeout call with the runner default', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor('packages/components/src/button/button.test.ts', [], ['setDefaultTimeout(10_000);']),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(5_000);
    expect(violations[0]?.new.value).toBe(10_000);
  });

  test('checks timeout arguments on parameterized Bun tests', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ["test.each(cases)('case', handler, 5_000);"],
        ["test.each(cases)('case', handler, 10_000);"],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks timeout arguments on conditional Bun tests', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ["test.skipIf(condition)('case', handler, 5_000);"],
        ["test.skipIf(condition)('case', handler, 10_000);"],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks Bun test timeout arguments in underscore-style test filenames', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button_test_case.ts',
        ["test('case', handler, 5_000);"],
        ["test('case', handler, 10_000);"],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('rejects non-finite timeout expressions as unbounded', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        [],
        ['timeout: 5_000 / 0,', 'deadline: 0 - 5_000 / 0,'],
      ),
    );

    expect(violations).toHaveLength(2);
    expect(violations.every((violation) => violation.new.effectiveValue === Infinity)).toBe(true);
  });

  test('checks callback timers and Bun sleep waits', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/tree/tree.test.ts',
        ['await new Promise((resolve) => setTimeout(resolve, 20));', 'await Bun.sleep(20);'],
        ['await new Promise((resolve) => setTimeout(resolve, 200));', 'await Bun.sleep(200);'],
      ),
    );

    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.new.renderedValue)).toEqual(['200', '200']);
  });

  test('ignores callback timers in production source', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/playground/src/examples/toast-region/promise.example.svelte',
        ['setTimeout(resolve, 20);'],
        ['setTimeout(resolve, 200);'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('ignores bare timeout options in production source', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/editor/src/lib/components/diff-viewer/diff-controller.svelte.ts',
        ['requestIdleCallback(doCompute, { timeout: 2_000 });'],
        ['requestIdleCallback(doCompute, { timeout: 4_000 });'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('ignores named timing and retry fields in production source', () => {
    const timingViolations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/editor/src/lib/components/diff-viewer/diff-controller.svelte.ts',
        ['const animationTimeout = 200;'],
        ['const animationTimeout = 300;'],
      ),
    );
    const retryViolations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/playground/src/examples/json-viewer/basic.example.svelte',
        ['const retryCount = 0;'],
        ['const retryCount = 1;'],
      ),
    );

    expect(timingViolations).toEqual([]);
    expect(retryViolations).toEqual([]);
  });

  test('rejects removing a restrictive workflow timeout', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor('.github/workflows/unit-tests.yaml', ['timeout-minutes: 5'], []),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.effectiveValue).toBe(5);
    expect(violations[0]?.new.effectiveValue).toBe(360);
  });

  test('ignores thresholds inside multiline template literals', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/usage.ts',
        ['const documentation = `', 'timeout: 5_000', '`;'],
        ['const documentation = `', 'timeout: 10_000', '`;'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('does not manufacture increases when multiple thresholds decrease', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.setTimeout(5_000);', 'test.setTimeout(10_000);'],
        ['test.setTimeout(4_000);', 'test.setTimeout(9_000);'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('does not confuse unrelated trailing call arguments with Bun test timeouts', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor('packages/components/src/consumer-readiness.test.ts', ['}, 30);'], ['}, 40);']),
    );

    expect(violations).toEqual([]);
  });

  test('allows a conditional slow annotation to be disabled', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.slow(true);'],
        ['test.slow(false);'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('ignores threshold text in trailing source comments', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['runTest(); // timeout: 5_000'],
        ['runTest(); // timeout: 10_000'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('does not let apostrophes in comments hide later timeout changes', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ["// don't increase waits", 'test.setTimeout(5_000);'],
        ["// don't increase waits", 'test.setTimeout(10_000);'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('does not let apostrophes in regular expressions hide later timeout changes', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ["const contraction = /don't/;", 'test.setTimeout(5_000);'],
        ["const contraction = /don't/;", 'test.setTimeout(10_000);'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('ignores threshold text in trailing shell and YAML hash comments', () => {
    const diff = [
      diffFor(
        'packages/components/scripts/probe.sh',
        ['run_test # timeout: 5_000'],
        ['run_test # timeout: 10_000'],
      ),
      diffFor(
        '.github/workflows/unit-tests.yaml',
        ['run: run-test # retries: 1'],
        ['run: run-test # retries: 3'],
      ),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toEqual([]);
  });

  test('checks executable shell case-pattern lines in workflow blocks', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        '.github/workflows/browser-tests.yaml',
        ['*) bun test --timeout=5000 ;;'],
        ['*) bun test --timeout=10000 ;;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('does not treat mentions of test.slow() inside guard implementation text as calls', () => {
    const diff = diffFor(
      'packages/components/scripts/check-timeout-increases.ts',
      [],
      ["if (identity.includes('slow:test.slow()')) continue;"],
    );

    expect(findTimeoutIncreaseViolations(diff)).toEqual([]);
  });

  test('does not treat threshold examples inside source string literals as executable settings', () => {
    const diff = diffFor(
      'packages/components/scripts/check-timeout-increases.test.ts',
      [],
      [
        "const retryExample = 'test.describe.configure({ retries: 2 });';",
        "const slowExample = 'test.slow(true);';",
      ],
    );

    expect(findTimeoutIncreaseViolations(diff)).toEqual([]);
  });

  test('ignores comments, unrelated numeric edits, and lockfile noise', () => {
    const diff = [
      diffFor(
        'packages/components/src/button/button.ts',
        ['const columnCount = 4;'],
        ['const columnCount = 8;'],
      ),
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['// timeout: 5_000', '# retries: 1'],
        ['// timeout: 10_000', '# retries: 3'],
      ),
      diffFor('bun.lock', ['timeout = 1'], ['timeout = 99']),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toEqual([]);
  });

  test('formats file, hunk, old/new evidence, and policy on failure', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['test.setTimeout(5_000);'],
        ['test.setTimeout(10_000);'],
      ),
    );

    const message = formatTimeoutIncreaseViolations(violations);

    expect(message).toContain('check-timeout-increases');
    expect(message).toContain('timeout/retry threshold increase');
    expect(message).toContain('Pull request policy');
    expect(message).toContain('packages/components/src/button/button.test.ts');
    expect(message).toContain('old line 10: test.setTimeout(5_000);');
    expect(message).toContain('new line 10: test.setTimeout(10_000);');
  });
});
