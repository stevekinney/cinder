/**
 * Block-mode comparison contract.
 *
 * The acceptance criterion for `CINDER_VISUAL_DIFF=block` is that, against a
 * committed baseline, the gate (a) passes when the rendered output matches the
 * baseline and (b) fails when it differs. The pixel-level decision is owned by
 * Playwright's `toHaveScreenshot`, which delegates to `pixelmatch` under the
 * `threshold`/`maxDiffPixels` tolerance declared in `SNAPSHOT_DIFF_OPTIONS`.
 *
 * Authentic per-component baselines must be authored on native amd64 inside the
 * canonical `cinder-playwright` Docker image (host/QEMU pixels are flaky — see
 * docs/visual-regression/baselines.md), so they are produced by the CI
 * `update-baselines` dispatch, NOT here. This suite instead pins the gate's
 * comparison behaviour against a small, committed, deterministically-generated
 * baseline fixture so the "passes on match / catches a change" contract is
 * demonstrated and runs green on a clean checkout, mirroring the same
 * pixelmatch-over-committed-PNG approach used by `determinism-check.test.ts`.
 *
 * The fixture lives under `__fixtures__/` — deliberately NOT under the live
 * `packages/testing/snapshots/` comparison set — because a synthetic image must
 * never be compared against real browser-rendered component pixels in CI.
 */

import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { blockBaselineGuard, SNAPSHOT_DIFF_OPTIONS } from './screenshot.ts';

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_FIXTURE = join(here, '__fixtures__', 'block-baseline-fixture.png');

/** The block-mode tolerance, sourced from production config (no duplicated literals). */
const THRESHOLD = SNAPSHOT_DIFF_OPTIONS.threshold ?? 0.1;
const MAX_DIFF_PIXELS = SNAPSHOT_DIFF_OPTIONS.maxDiffPixels ?? 0;

/** Decodes the committed baseline PNG fresh on each call. */
function readBaseline(): PNG {
  return PNG.sync.read(readFileSync(BASELINE_FIXTURE));
}

/**
 * Runs the same comparison `toHaveScreenshot` performs: pixelmatch at the
 * production threshold, then compares the changed-pixel count against
 * `maxDiffPixels`. Returns whether the candidate is within tolerance.
 */
function withinTolerance(baseline: PNG, candidate: PNG): { passes: boolean; diffPixels: number } {
  const { width, height } = baseline;
  const out = new PNG({ width, height });
  const diffPixels = pixelmatch(baseline.data, candidate.data, out.data, width, height, {
    threshold: THRESHOLD,
  });
  return { passes: diffPixels <= MAX_DIFF_PIXELS, diffPixels };
}

describe('block-mode comparison contract — committed baseline', () => {
  it('commits a decodable, non-empty baseline fixture on a clean checkout', () => {
    // git ls-files would show this PNG; existsSync proves the on-disk artifact
    // the guard's `baselineExists` argument is derived from in production.
    expect(existsSync(BASELINE_FIXTURE)).toBe(true);
    const baseline = readBaseline();
    expect(baseline.width).toBeGreaterThan(0);
    expect(baseline.height).toBeGreaterThan(0);
  });

  it('PASSES when the rendered output matches the committed baseline', () => {
    const baseline = readBaseline();
    const identical = readBaseline();
    const { passes, diffPixels } = withinTolerance(baseline, identical);
    expect(diffPixels).toBe(0);
    expect(passes).toBe(true);
  });

  it('CATCHES an intentional visual change (diff exceeds tolerance)', () => {
    const baseline = readBaseline();
    const changed = readBaseline();

    // Repaint far more pixels than `maxDiffPixels` (2) allows — an obvious,
    // unambiguous regression the gate must reject.
    const pixelsToBreak = MAX_DIFF_PIXELS + 50;
    for (let p = 0; p < pixelsToBreak; p++) {
      const i = p << 2;
      // Invert each channel so the delta is well above the per-pixel threshold.
      changed.data[i] = 255 - changed.data[i]!;
      changed.data[i + 1] = 255 - changed.data[i + 1]!;
      changed.data[i + 2] = 255 - changed.data[i + 2]!;
    }

    const { passes, diffPixels } = withinTolerance(baseline, changed);
    expect(diffPixels).toBeGreaterThan(MAX_DIFF_PIXELS);
    expect(passes).toBe(false);
  });

  it('tolerates a sub-threshold change within maxDiffPixels', () => {
    const baseline = readBaseline();
    const candidate = readBaseline();

    // Flip exactly maxDiffPixels pixels — at the boundary, still a pass.
    for (let p = 0; p < MAX_DIFF_PIXELS; p++) {
      const i = p << 2;
      candidate.data[i] = 255 - candidate.data[i]!;
      candidate.data[i + 1] = 255 - candidate.data[i + 1]!;
      candidate.data[i + 2] = 255 - candidate.data[i + 2]!;
    }

    const { passes, diffPixels } = withinTolerance(baseline, candidate);
    expect(diffPixels).toBeLessThanOrEqual(MAX_DIFF_PIXELS);
    expect(passes).toBe(true);
  });
});

describe('block-mode guard against the committed baseline path', () => {
  it('does NOT fire the missing-baseline guard when the baseline exists on disk', () => {
    // Real existsSync against the committed fixture — the same wiring
    // captureBlockMode uses (existsSync(snapshotPath(key))).
    expect(blockBaselineGuard(BASELINE_FIXTURE, existsSync(BASELINE_FIXTURE), 'none')).toEqual({
      ok: true,
    });
  });

  it('fires the actionable guard for an absent baseline path while validating', () => {
    const missing = join(here, '__fixtures__', 'does-not-exist.png');
    const result = blockBaselineGuard(missing, existsSync(missing), 'none');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected guard to fail');
    expect(result.message).toContain(missing);
    expect(result.message).toContain('CINDER_VISUAL_DIFF=block');
  });
});
