/**
 * Unit tests for resolveVisualDiffMode() — the env-var parsing logic extracted
 * from screenshot.ts. These tests deliberately avoid spinning up a Playwright
 * browser; they only exercise the pure string-to-mode mapping.
 */

import type { FullConfig } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
  blockBaselineGuard,
  resolveVisualDiffMode,
  type UpdateSnapshotsState,
} from './screenshot.ts';

// ---------------------------------------------------------------------------
// Env-var helpers
// ---------------------------------------------------------------------------

let originalValue: string | undefined;

beforeEach(() => {
  originalValue = process.env['CINDER_VISUAL_DIFF'];
});

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env['CINDER_VISUAL_DIFF'];
  } else {
    process.env['CINDER_VISUAL_DIFF'] = originalValue;
  }
});

function setMode(value: string | undefined): void {
  if (value === undefined) {
    delete process.env['CINDER_VISUAL_DIFF'];
  } else {
    process.env['CINDER_VISUAL_DIFF'] = value;
  }
}

// ---------------------------------------------------------------------------
// Valid modes
// ---------------------------------------------------------------------------

describe('resolveVisualDiffMode — valid values', () => {
  it("returns 'off' when CINDER_VISUAL_DIFF is 'off'", () => {
    setMode('off');
    expect(resolveVisualDiffMode()).toBe('off');
  });

  it("returns 'report' when CINDER_VISUAL_DIFF is 'report'", () => {
    setMode('report');
    expect(resolveVisualDiffMode()).toBe('report');
  });

  it("returns 'block' when CINDER_VISUAL_DIFF is 'block'", () => {
    setMode('block');
    expect(resolveVisualDiffMode()).toBe('block');
  });
});

// ---------------------------------------------------------------------------
// Default (unset / empty)
// ---------------------------------------------------------------------------

describe("resolveVisualDiffMode — defaults to 'off'", () => {
  it("returns 'off' when env var is unset", () => {
    setMode(undefined);
    expect(resolveVisualDiffMode()).toBe('off');
  });

  it("returns 'off' when env var is an empty string", () => {
    setMode('');
    expect(resolveVisualDiffMode()).toBe('off');
  });
});

// ---------------------------------------------------------------------------
// Invalid values — fall back to 'off' with a warning
// ---------------------------------------------------------------------------

describe("resolveVisualDiffMode — invalid values fall back to 'off'", () => {
  it("returns 'off' for an unrecognised value ('turbo')", () => {
    setMode('turbo');
    expect(resolveVisualDiffMode()).toBe('off');
  });

  it("returns 'off' for a numeric string ('1')", () => {
    setMode('1');
    expect(resolveVisualDiffMode()).toBe('off');
  });

  it("returns 'off' for uppercase 'OFF'", () => {
    // Mode matching is case-sensitive; 'OFF' ≠ 'off'.
    setMode('OFF');
    expect(resolveVisualDiffMode()).toBe('off');
  });

  it("returns 'off' for 'BLOCK' (wrong case)", () => {
    setMode('BLOCK');
    expect(resolveVisualDiffMode()).toBe('off');
  });

  it('emits a console.warn for an invalid value', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => undefined);
    setMode('invalid-value');

    resolveVisualDiffMode();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [firstArg] = warnSpy.mock.calls[0] as [string];
    expect(firstArg).toContain('CINDER_VISUAL_DIFF');
    expect(firstArg).toContain('invalid-value');

    warnSpy.mockRestore();
  });

  it('does NOT emit a console.warn for a valid value', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => undefined);
    setMode('block');

    resolveVisualDiffMode();

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does NOT emit a console.warn when the var is unset', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => undefined);
    setMode(undefined);

    resolveVisualDiffMode();

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// blockBaselineGuard — actionable "update baselines" failure in block mode
// ---------------------------------------------------------------------------

const BASELINE = '/repo/packages/testing/snapshots/button/light-desktop-default.png';

describe('blockBaselineGuard — validating (updateSnapshots: none)', () => {
  it('passes when the baseline exists', () => {
    expect(blockBaselineGuard(BASELINE, true, 'none')).toEqual({ ok: true });
  });

  it('fails with an actionable message when the baseline is missing', () => {
    const result = blockBaselineGuard(BASELINE, false, 'none');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected guard to fail');

    // Names the missing file so the offending case is identifiable.
    expect(result.message).toContain(BASELINE);
    // Names the block-mode env var that triggered the comparison.
    expect(result.message).toContain('CINDER_VISUAL_DIFF=block');
    // Points at the Docker update workflow rather than Playwright's generic text.
    expect(result.message).toContain('test:browser:update:docker');
    expect(result.message).toContain('update-baselines');
    expect(result.message).toContain('docs/visual-regression/baselines.md');
  });
});

describe('blockBaselineGuard — authoring (updateSnapshots !== none)', () => {
  it("stays silent for 'all' even when the baseline is missing", () => {
    // --update-snapshots is active; toHaveScreenshot legitimately writes the file.
    expect(blockBaselineGuard(BASELINE, false, 'all')).toEqual({ ok: true });
  });

  it("stays silent for 'missing' when the baseline is missing", () => {
    expect(blockBaselineGuard(BASELINE, false, 'missing')).toEqual({ ok: true });
  });

  it("stays silent for 'changed' when the baseline is missing", () => {
    expect(blockBaselineGuard(BASELINE, false, 'changed')).toEqual({ ok: true });
  });

  it('passes when authoring and the baseline already exists', () => {
    expect(blockBaselineGuard(BASELINE, true, 'all')).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Type-level contract: UpdateSnapshotsState must stay pinned to Playwright's
// `FullConfig['updateSnapshots']` union, NOT a bare `string`. The guard's
// correctness hinges on the `'none'` sentinel; if the param widened back to
// `string`, an arbitrary string would type-check as an "authoring" run and
// silently skip the missing-baseline check. These checks fail to compile (and
// thus fail `bun run typecheck`) if the contract regresses.
// ---------------------------------------------------------------------------

// Assignable to/from Playwright's union — proves the alias resolves to exactly
// `'all' | 'changed' | 'missing' | 'none'` and not a wider/narrower type.
{
  const fromPlaywright: FullConfig['updateSnapshots'] = 'none';
  const asState: UpdateSnapshotsState = fromPlaywright;
  const backToPlaywright: FullConfig['updateSnapshots'] = asState;
  void backToPlaywright;
}

// All four valid literals are accepted by the guard's parameter.
blockBaselineGuard(BASELINE, false, 'all');
blockBaselineGuard(BASELINE, false, 'changed');
blockBaselineGuard(BASELINE, false, 'missing');
blockBaselineGuard(BASELINE, false, 'none');

// A non-union string must be rejected by the compiler. If UpdateSnapshotsState
// ever widens to `string`, this line stops erroring and typecheck fails on the
// now-unused @ts-expect-error directive, surfacing the regression.
// @ts-expect-error 'nonee' is not a valid FullConfig['updateSnapshots'] value
blockBaselineGuard(BASELINE, false, 'nonee');
// @ts-expect-error 'NONE' (wrong case) is not assignable to the union
blockBaselineGuard(BASELINE, false, 'NONE');
