/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { computeLineDiff, groupIntoHunks } = await import('@lostgradient/markdown');
const { formatComputedUnifiedDiff } = await import('../../export/unified-diff-format.ts');
const { generateUnifiedDiff } = await import('../../export/unified-diff-generation.ts');

describe('DiffViewer: unified diff clipboard handling', () => {
  test('handles clipboard rejection and clears the prior reset timer', async () => {
    const source = await Bun.file(new URL('./diff-viewer.svelte', import.meta.url)).text();

    expect(source).toMatch(
      /try\s*\{[\s\S]*navigator\.clipboard\.writeText\(diff\)[\s\S]*\}\s*catch\s*\{/,
    );
    expect(source).toContain('window.clearTimeout(copyStatusResetTimer)');
    expect(source).toContain('onDestroy(() => {');
  });

  test('copy is always a full-document unified diff, independent of viewMode (CIN-134)', async () => {
    const source = await Bun.file(new URL('./diff-viewer.svelte', import.meta.url)).text();

    // The decision is recorded as a comment, not just left implicit.
    expect(source).toMatch(/Decision \(CIN-134\)[\s\S]*always a full-document unified/);

    // The function body itself never branches on viewMode: extract it and
    // assert it only reads displayedOriginal/displayedCurrent.
    // Brace-matched rather than regex-terminated. The previous form ended on
    // `/\n  \}\n/`, which pins the closing brace to exactly two spaces of indentation --
    // a formatter change, or nesting the function one level deeper, would silently
    // match nothing (or the wrong span) and the assertions below would then pass or
    // fail for reasons unrelated to what the test is about.
    const signature = 'async function copyUnifiedDiff(): Promise<void> {';
    const start = source.indexOf(signature);
    expect(start).toBeGreaterThan(-1);

    let depth = 0;
    let end = -1;
    for (let index = start + signature.length - 1; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).not.toContain('viewMode');
    expect(body).toContain('displayedOriginal');
    expect(body).toContain('displayedCurrent');
  });

  test('the realtime/debounced-tier generator (generateUnifiedDiff) emits real unified-diff syntax', () => {
    const diff = generateUnifiedDiff(
      {
        schemaVersion: 1,
        content: 'first\nSECOND CHANGED\nthird',
        original: 'first\nsecond\nthird',
        threads: [],
        updatedAt: '',
      },
      { normalizeInputs: false },
    ).diff;

    expect(diff).toContain('--- a/document.md');
    expect(diff).toContain('+++ b/document.md');
    expect(diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(diff).toContain('-second');
    expect(diff).toContain('+SECOND CHANGED');
  });

  test('the manual-tier generator (formatComputedUnifiedDiff) emits real unified-diff syntax from reused hunks', () => {
    const diffs = computeLineDiff('first\nsecond\nthird', 'first\nSECOND CHANGED\nthird');
    const hunks = groupIntoHunks(diffs);

    const diff = formatComputedUnifiedDiff(hunks, {
      original: 'first\nsecond\nthird',
      current: 'first\nSECOND CHANGED\nthird',
    });

    expect(diff).toContain('--- a/document.md');
    expect(diff).toContain('+++ b/document.md');
    expect(diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(diff).toContain('-second');
    expect(diff).toContain('+SECOND CHANGED');
  });
});
