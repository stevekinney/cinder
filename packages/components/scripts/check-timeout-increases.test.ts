import { describe, expect, test } from 'bun:test';

import { sourceLineForAnalysis } from './check-timeout-increase-strings.ts';
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

  test('allows unchanged values and reductions', () => {
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

  test('rejects newly introduced explicit waits', () => {
    const diff = diffFor(
      'packages/components/scripts/check-suite.test.ts',
      [],
      ['await Bun.sleep(60_000);', 'await page.waitForTimeout(250);'],
    );

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(2);
  });

  test('checks Playwright operation timeout options', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/tests/avatar-group-focus-rings.playwright.ts',
        ["await page.waitForSelector('#app', { timeout: 20_000 });"],
        ["await page.waitForSelector('#app', { timeout: 40_000 });"],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks Bun configuration, promise timer aliases, configured assertions, and stable reads', () => {
    const diff = [
      diffFor('bunfig.toml', ['timeout = 5_000'], ['timeout = 10_000']),
      diffFor(
        'packages/testing/scripts/start-server.ts',
        [
          "import { setTimeout as delay } from 'node:timers/promises';",
          'await delay(500);',
          'const PLAYGROUND_WARM_READINESS_STABLE_READS = 2;',
        ],
        [
          "import { setTimeout as delay } from 'node:timers/promises';",
          'await delay(1_000);',
          'const PLAYGROUND_WARM_READINESS_STABLE_READS = 4;',
        ],
      ),
      diffFor(
        'packages/components/src/button/button.test.ts',
        [],
        ['const slowExpect = expect.configure({ timeout: 10_000 });'],
      ),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(4);
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

  test('checks quoted Jest threshold keys in JSON configuration', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'package.json',
        ['  "jest": {', '    "testTimeout": 5000', '  }'],
        ['  "jest": {', '    "testTimeout": 10000', '  }'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('does not expose threshold-shaped text inside JSON strings', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'package.json',
        ['  "description": "contains \\\"timeout\\\": 5000"'],
        ['  "description": "contains \\\"timeout\\\": 10000"'],
      ),
    );

    expect(violations).toEqual([]);
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

    const violations = findTimeoutIncreaseViolations(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.filePath).toBe('packages/components/src/removed.test.ts');
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

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(2);
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

  test('rejects removing a restrictive Playwright test timeout', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor('packages/components/src/button/button.test.ts', ['test.setTimeout(5_000);'], []),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.new.value).toBe(30_000);
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

  test('compares new Bun argv rerun-each values with the retry default', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/scripts/run-tests.ts',
        ["const command = ['bun', 'test'];"],
        ["const command = ['bun', 'test', '--rerun-each', '10'];"],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(0);
    expect(violations[0]?.new.kind).toBe('retries');
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

  test('compares a newly added multiline Bun timeout argument with the runner default', () => {
    const increased = [
      'diff --git a/packages/testing/scripts/run-tests.ts b/packages/testing/scripts/run-tests.ts',
      '--- a/packages/testing/scripts/run-tests.ts',
      '+++ b/packages/testing/scripts/run-tests.ts',
      '@@ -10,1 +10,6 @@',
      '+const arguments = [',
      "+  'bun',",
      "+  'test',",
      "+  '--timeout',",
      "+  '10000',",
      '+];',
      '',
    ].join('\n');
    const reduced = [
      'diff --git a/packages/testing/scripts/run-tests.ts b/packages/testing/scripts/run-tests.ts',
      '--- a/packages/testing/scripts/run-tests.ts',
      '+++ b/packages/testing/scripts/run-tests.ts',
      '@@ -10,1 +10,6 @@',
      '+const arguments = [',
      "+  'bun',",
      "+  'test',",
      "+  '--timeout',",
      "+  '4000',",
      '+];',
      '',
    ].join('\n');

    const violations = findTimeoutIncreaseViolations(increased);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(5_000);
    expect(findTimeoutIncreaseViolations(reduced)).toEqual([]);
  });

  test('compares a newly added multiline Bun rerun-each argument with the retry default', () => {
    const diff = [
      'diff --git a/packages/testing/scripts/run-tests.ts b/packages/testing/scripts/run-tests.ts',
      '--- a/packages/testing/scripts/run-tests.ts',
      '+++ b/packages/testing/scripts/run-tests.ts',
      '@@ -10,1 +10,6 @@',
      '+const arguments = [',
      "+  'bun',",
      "+  'test',",
      "+  '--rerun-each',",
      "+  '10',",
      '+];',
      '',
    ].join('\n');

    const violations = findTimeoutIncreaseViolations(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(0);
    expect(violations[0]?.new.kind).toBe('retries');
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

  test('rejects embedded Playwright slow annotations', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/example.test.ts',
        [],
        ['if (condition) test.slow();', 'testInfo.slow();'],
      ),
    );

    expect(violations).toHaveLength(2);
  });

  test('checks repository wait-helper timeout arguments', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        [
          'await waitForUrl(url, 10_000, server);',
          "await fetchWithTimeout(url, 10_000, 'request');",
        ],
        [
          'await waitForUrl(url, 20_000, server);',
          "await fetchWithTimeout(url, 20_000, 'request');",
        ],
      ),
    );

    expect(violations).toHaveLength(2);
  });

  test('checks AbortSignal timeout calls on one or multiple lines', () => {
    const singleLine = diffFor(
      'packages/playground/src/validate-playground.ts',
      ['const signal = AbortSignal.timeout(5_000);'],
      ['const signal = AbortSignal.timeout(10_000);'],
    );
    const multiline = diffFor(
      'packages/playground/src/validate-playground.ts',
      ['const signal = AbortSignal.timeout(', '  5_000,', ');'],
      ['const signal = AbortSignal.timeout(', '  10_000,', ');'],
    );

    expect(findTimeoutIncreaseViolations([singleLine, multiline].join('\n'))).toHaveLength(2);
  });

  test('checks marker-first uppercase threshold identifiers', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-consumers.test.ts',
        ['const TIMEOUT_MS = 5_000;', 'const WAIT_MS = 5_000;', 'const RETRY_COUNT = 1;'],
        ['const TIMEOUT_MS = 10_000;', 'const WAIT_MS = 10_000;', 'const RETRY_COUNT = 2;'],
      ),
    );

    expect(violations).toHaveLength(3);
  });

  test('keeps timeout callsites stable when lines are inserted', () => {
    const diff = [
      'diff --git a/packages/components/src/button/button.test.ts b/packages/components/src/button/button.test.ts',
      '--- a/packages/components/src/button/button.test.ts',
      '+++ b/packages/components/src/button/button.test.ts',
      '@@ -10,2 +10,3 @@',
      '-test.setTimeout(5_000);',
      '-test.setTimeout(10_000);',
      '+// Explain the two test budgets.',
      '+test.setTimeout(10_000);',
      '+test.setTimeout(4_000);',
      '',
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('analyzes both sides of a production-to-test rename as test infrastructure', () => {
    const diff = [
      'diff --git a/packages/components/src/example.ts b/packages/components/src/example.test.ts',
      'similarity index 90%',
      'rename from packages/components/src/example.ts',
      'rename to packages/components/src/example.test.ts',
      '--- a/packages/components/src/example.ts',
      '+++ b/packages/components/src/example.test.ts',
      '@@ -1 +1 @@',
      '-const TEST_TIMEOUT_MS = 5_000;',
      '+const TEST_TIMEOUT_MS = 10_000;',
      '',
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('treats zero polling and delay thresholds as finite', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-consumers.test.ts',
        ['const POLL_INTERVAL_MS = 0;', 'const RETRY_DELAY_MS = 0;'],
        ['const POLL_INTERVAL_MS = 200;', 'const RETRY_DELAY_MS = 200;'],
      ),
    );

    expect(violations).toHaveLength(2);
  });

  test('compares new Playwright configuration timeouts with the runner default', () => {
    const configViolations = findTimeoutIncreaseViolations(
      diffFor('packages/testing/playwright.config.ts', [], ['export default { timeout: 60_000 };']),
    );
    const describeViolations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        [],
        ['test.describe.configure({ timeout: 60_000 });'],
      ),
    );

    expect(configViolations).toHaveLength(1);
    expect(describeViolations).toHaveLength(1);
  });

  test('uses the Playwright assertion default for expect configuration timeouts', () => {
    const inlineViolations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        [],
        ['export default { expect: { timeout: 10_000 } };'],
      ),
    );
    const multilineViolations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        ['  expect: {', '    timeout: 5_000,', '  },'],
        ['  expect: {', '    timeout: 10_000,', '  },'],
      ),
    );

    expect(inlineViolations).toHaveLength(1);
    expect(inlineViolations[0]?.old.value).toBe(5_000);
    expect(multilineViolations).toHaveLength(1);
  });

  test('uses the Playwright web server default for webServer configuration timeouts', () => {
    const tightening = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        [],
        ['export default { webServer: { timeout: 45_000 } };'],
      ),
    );
    const increase = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        [],
        ['export default { webServer: { timeout: 90_000 } };'],
      ),
    );

    expect(tightening).toEqual([]);
    expect(increase).toHaveLength(1);
    expect(increase[0]?.old.value).toBe(60_000);
  });

  test('uses the Playwright web server default for array-form configurations', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        [],
        ['export default { webServer: [{ timeout: 45_000 }] };'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('compares new Playwright default timeout calls with the action default', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/tests/example.playwright.ts',
        [],
        ['page.setDefaultTimeout(60_000);', 'page.setDefaultNavigationTimeout(60_000);'],
      ),
    );

    expect(violations).toHaveLength(2);
    expect(violations.every((violation) => violation.old.value === 30_000)).toBe(true);
  });

  test('compares direct TestInfo timeout calls with the test default', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor('packages/testing/tests/example.playwright.ts', [], ['testInfo.setTimeout(60_000);']),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(30_000);
  });

  test('compares Jest and Vitest testTimeout settings with runner defaults', () => {
    const violations = findTimeoutIncreaseViolations(
      [
        diffFor('packages/testing/jest.config.ts', [], ['export default { testTimeout: 10_000 };']),
        diffFor(
          'packages/testing/vitest.config.ts',
          [],
          ['export default { testTimeout: 10_000 };'],
        ),
      ].join('\n'),
    );

    expect(violations).toHaveLength(2);
    expect(violations.every((violation) => violation.old.value === 5_000)).toBe(true);
  });

  test('checks numeric bounds on polling retry loops', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/husky/utilities.test.ts',
        ['for (let attempt = 0; attempt < 50; attempt += 1) {', 'while (retryCount <= 2) {'],
        ['for (let attempt = 0; attempt < 100; attempt += 1) {', 'while (retryCount <= 4) {'],
      ),
    );

    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.new.value)).toEqual([100, 5]);
  });

  test('checks relative Playwright timeout extensions', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/tests/example.playwright.ts',
        ['testInfo.setTimeout(testInfo.timeout + 5_000);'],
        ['testInfo.setTimeout(testInfo.timeout + 10_000);'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.new.value).toBe(10_000);
  });

  test('checks relative Playwright timeout multipliers', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/tests/example.playwright.ts',
        ['testInfo.setTimeout(testInfo.timeout * 2);'],
        ['testInfo.setTimeout(testInfo.timeout * 3);'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(2);
    expect(violations[0]?.new.value).toBe(3);
  });

  test('treats testInfo.setTimeout(0) as unbounded', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/tests/example.playwright.ts',
        ['testInfo.setTimeout(0);'],
        ['testInfo.setTimeout(5_000);'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('checks Playwright expect.poll interval increases', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/tests/example.playwright.ts',
        ['await expect.poll(readiness, { intervals: [100, 250] }).toBe(true);'],
        ['await expect.poll(readiness, { intervals: [100, 500] }).toBe(true);'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(250);
    expect(violations[0]?.new.value).toBe(500);
  });

  test('keeps expect.poll intervals within their own call', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/tests/example.playwright.ts',
        [
          'await expect.poll(readiness, { intervals: [100, 250] }).toBe(true);\nconst options = { intervals: [500] };',
        ],
        ['await expect.poll(readiness, {}).toBe(true);\nconst options = { intervals: [1_000] };'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('compares new Jest setTimeout calls with the runner default', () => {
    const increased = findTimeoutIncreaseViolations(
      diffFor('packages/components/src/button/button.test.ts', [], ['jest.setTimeout(10_000);']),
    );
    const reduced = findTimeoutIncreaseViolations(
      diffFor('packages/components/src/button/button.test.ts', [], ['jest.setTimeout(4_000);']),
    );

    expect(increased).toHaveLength(1);
    expect(increased[0]?.old.value).toBe(5_000);
    expect(reduced).toEqual([]);
  });

  test('normalizes threshold identifier units before comparison', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/example.test.ts',
        ['const TEST_TIMEOUT_SECONDS = 30;', 'const requestTimeoutSeconds = 30;'],
        ['const TEST_TIMEOUT_MS = 30_000;', 'const requestTimeoutMs = 30_000;'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('checks Bun lifecycle hook timeout arguments', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        ['beforeAll(setup, 5_000);', 'afterEach(cleanup, 5_000);'],
        ['beforeAll(setup, 10_000);', 'afterEach(cleanup, 10_000);'],
      ),
    );

    expect(violations).toHaveLength(2);
  });

  test('checks lower-camel retry thresholds in validation infrastructure', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        ['const browserRetryCount = 1;'],
        ['const browserRetryCount = 2;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('ignores application-data retry fields inside test fixtures', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/approval-card/approval-card.test.ts',
        ['const argsPreview = { dryRun: false, retries: 1 };'],
        ['const argsPreview = { dryRun: false, retries: 2 };'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('ignores unrelated bare slow calls in tests', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/example.test.ts',
        ['expect(slow(2)).toBe(4);'],
        ['expect(slow(3)).toBe(6);'],
      ),
    );

    expect(violations).toEqual([]);
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

  test('preserves same-line wait helper callsite order', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/tree/tree.test.ts',
        ['await Bun.sleep(100); await Bun.sleep(200);'],
        ['await Bun.sleep(200); await Bun.sleep(100);'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(100);
    expect(violations[0]?.new.value).toBe(200);
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

  test('keeps YAML analysis after hashes inside JavaScript template literals', () => {
    const line = 'run: bun test --timeout 10_000 `console.log( # marker)`';

    expect(sourceLineForAnalysis('.github/workflows/unit-tests.yaml', line)).toBe(line);
  });

  test('ignores threshold text in TOML hash comments', () => {
    const diff = diffFor('bunfig.toml', ['# timeout = 5_000'], ['# timeout = 10_000']);

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

  test('checks workflow expressions and executable shell sleeps', () => {
    const diff = [
      diffFor(
        '.github/workflows/unit-tests.yaml',
        ['    timeout-minutes: ${{ 5 }}', '      run: sleep 30'],
        ['    timeout-minutes: ${{ 10 }}', '      run: sleep 60'],
      ),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(2);
  });

  test('checks newly added Playwright assertion timeouts against the framework default', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/button/button.test.ts',
        [],
        ['await expect.poll(readiness).toBe(true, { timeout: 10_000 });'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(5_000);
  });

  test('preserves executable threshold expressions inside template literals', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-command.ts',
        ['const command = `run ${test.setTimeout(5_000)}`;'],
        ['const command = `run ${test.setTimeout(10_000)}`;'],
      ),
    );

    expect(violations).toHaveLength(1);
  });

  test('checks Jest retries, grace periods, and numeric wait bounds', () => {
    const diff = [
      diffFor(
        'packages/components/scripts/check-suite.test.ts',
        ['jest.retryTimes(1);'],
        ['jest.retryTimes(3);'],
      ),
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        ['const CHILD_PROCESS_TERMINATION_GRACE_MS = 1_000;'],
        ['const CHILD_PROCESS_TERMINATION_GRACE_MS = 2_000;'],
      ),
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        ['await Bun.sleep(Math.min(25, timeoutMs));'],
        ['await Bun.sleep(Math.min(250, timeoutMs));'],
      ),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(3);
  });

  test('checks multiline conditional threshold branches', () => {
    const diff = [
      'diff --git a/packages/components/scripts/check-suite.test.ts b/packages/components/scripts/check-suite.test.ts',
      '--- a/packages/components/scripts/check-suite.test.ts',
      '+++ b/packages/components/scripts/check-suite.test.ts',
      '@@ -10,4 +10,4 @@',
      ' const timeout = condition',
      '-  ? 5_000',
      '+  ? 10_000',
      '   : 1_000;',
      '',
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('ignores bare timeout-shaped fixture data', () => {
    const diff = diffFor(
      'packages/components/src/button/button.test.ts',
      ['const fixture = { timeout: 5 };'],
      ['const fixture = { timeout: 10 };'],
    );

    expect(findTimeoutIncreaseViolations(diff)).toEqual([]);
  });

  test('distinguishes millisecond and second identifier suffixes', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        ['const STREAM_DRAIN_GRACE_MILLISECONDS = 5_000;'],
        ['const STREAM_DRAIN_GRACE_SECONDS = 10;'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.effectiveValue).toBe(5_000);
    expect(violations[0]?.new.effectiveValue).toBe(10_000);
  });

  test('checks promiseWithTimeout and synchronous Bun waits', () => {
    const diff = [
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        ['await promiseWithTimeout(operation, 15_000, "launch");'],
        ['await promiseWithTimeout(operation, 30_000, "launch");'],
      ),
      diffFor(
        'packages/components/scripts/next.ts',
        ['Bun.sleepSync(2_000);'],
        ['Bun.sleepSync(4_000);'],
      ),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(2);
  });

  test('checks attempt-shaped retry thresholds', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/next.ts',
        ['function claimNextTask(maxAttempts = 5) {}'],
        ['function claimNextTask(maxAttempts = 10) {}'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.new.kind).toBe('retries');
  });

  test('normalizes shell sleep duration suffixes', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        '.github/workflows/unit-tests.yaml',
        ['      run: sleep 30'],
        ['      run: sleep 1m'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.effectiveValue).toBe(30_000);
    expect(violations[0]?.new.effectiveValue).toBe(60_000);
  });

  test('checks quoted workflow threshold keys', () => {
    const diff = [
      diffFor(
        '.github/workflows/unit-tests.yaml',
        ['    "timeout-minutes": 5'],
        ['    "timeout-minutes": 10'],
      ),
      diffFor(
        '.github/workflows/browser-tests.yml',
        ["    'timeout-minutes': 5"],
        ["    'timeout-minutes': 10"],
      ),
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(2);
  });

  test('uses the Testing Library waitFor timeout default', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/src/data-grid/data-grid.test.ts',
        [],
        ['await waitFor(() => expect(done).toBe(true), { timeout: 2_000 });'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.value).toBe(1_000);
    expect(
      findTimeoutIncreaseViolations(
        diffFor(
          'packages/components/src/data-grid/data-grid.test.ts',
          [],
          ['await waitFor(() => expect(done).toBe(true), { timeout: 500 });'],
        ),
      ),
    ).toEqual([]);
  });

  test('uses project and global Playwright timeout defaults', () => {
    const projectIncrease = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        [],
        ['export default { projects: [{ name: "chromium", timeout: 60_000 }] };'],
      ),
    );
    const addedGlobalLimit = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        [],
        ['export default { globalTimeout: 60_000 };'],
      ),
    );
    const removedGlobalLimit = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/playwright.config.ts',
        ['export default { globalTimeout: 60_000 };'],
        [],
      ),
    );

    expect(projectIncrease).toHaveLength(1);
    expect(projectIncrease[0]?.old.value).toBe(30_000);
    expect(addedGlobalLimit).toEqual([]);
    expect(removedGlobalLimit).toHaveLength(1);
  });

  test('uses the Playwright repeatEach default', () => {
    const increased = findTimeoutIncreaseViolations(
      diffFor('packages/testing/playwright.config.ts', [], ['export default { repeatEach: 2 };']),
    );
    const defaultValue = findTimeoutIncreaseViolations(
      diffFor('packages/testing/playwright.config.ts', [], ['export default { repeatEach: 1 };']),
    );

    expect(increased).toHaveLength(1);
    expect(increased[0]?.old.value).toBe(1);
    expect(defaultValue).toEqual([]);
  });

  test('ignores attempt-shaped domain data outside validation infrastructure', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/playground/src/examples/schema-form/json-schema.example.svelte',
        ["value={{ name: 'Import data', attempts: 2 }}"],
        ["value={{ name: 'Import data', attempts: 3 }}"],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('checks capped interaction press counts', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/testing/src/helpers/focus-ring.ts',
        ['async function tabUntilFocused(maxPresses = 50) {}'],
        ['async function tabUntilFocused(maxPresses = 80) {}'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.new.kind).toBe('retries');
  });

  test('does not connect a threshold assignment to a later conditional', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/check-suite.test.ts',
        ['const TEST_TIMEOUT_MS = 5_000;', 'const columns = compact ? 1 : 2;'],
        ['const TEST_TIMEOUT_MS = 5_000;', 'const columns = compact ? 1 : 3;'],
      ),
    );

    expect(violations).toEqual([]);
  });

  test('pairs a single renamed threshold across hunks in one file', () => {
    const diff = [
      'diff --git a/packages/components/scripts/validate-server.ts b/packages/components/scripts/validate-server.ts',
      '--- a/packages/components/scripts/validate-server.ts',
      '+++ b/packages/components/scripts/validate-server.ts',
      '@@ -10,1 +10,0 @@',
      '-const STARTUP_TIMEOUT_MS = 5_000;',
      '@@ -40,0 +40,1 @@',
      '+const SERVER_WAIT_MS = 10_000;',
      '',
    ].join('\n');

    expect(findTimeoutIncreaseViolations(diff)).toHaveLength(1);
  });

  test('checks nullish and logical threshold fallbacks', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/validate-consumers.ts',
        [
          'const requestTimeoutMs = input.requestTimeoutMs ?? 5_000;',
          'const retryAttempts = input.retryAttempts || 2;',
        ],
        [
          'const requestTimeoutMs = input.requestTimeoutMs ?? 10_000;',
          'const retryAttempts = input.retryAttempts || 4;',
        ],
      ),
    );

    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.new.kind)).toEqual(['timeout', 'retries']);
  });

  test('checks shell timeout command durations', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/probe.sh',
        ['timeout 30s bun test'],
        ['timeout 1m bun test'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.effectiveValue).toBe(30_000);
    expect(violations[0]?.new.effectiveValue).toBe(60_000);
  });

  test('treats shell timeout zero as unbounded', () => {
    const boundedAfterUnbounded = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/probe.sh',
        ['timeout 0 bun test'],
        ['timeout 30s bun test'],
      ),
    );

    expect(boundedAfterUnbounded).toEqual([]);
  });

  test('checks shell timeout options before the duration', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/probe.sh',
        ['timeout --foreground 30s bun test'],
        ['timeout --foreground 1m bun test'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.effectiveValue).toBe(30_000);
    expect(violations[0]?.new.effectiveValue).toBe(60_000);
  });

  test('checks each shell wait in a command chain', () => {
    const violations = findTimeoutIncreaseViolations(
      diffFor(
        'packages/components/scripts/probe.sh',
        ['sleep 5s && sleep 30s'],
        ['sleep 5s && sleep 1m'],
      ),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.old.effectiveValue).toBe(30_000);
    expect(violations[0]?.new.effectiveValue).toBe(60_000);
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
