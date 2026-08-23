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
