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
      diffFor('packages/components/src/old-location.test.ts', ['test.setTimeout(5_000);'], []),
      diffFor('packages/components/src/new-location.test.ts', [], ['test.setTimeout(10_000);']),
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

  test('ignores nested CLI argument fixtures inside source strings', () => {
    const diff = diffFor(
      'packages/components/scripts/check-timeout-increases.test.ts',
      [],
      [`    ["const arguments = ['--retries=2'];"],`],
    );

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
