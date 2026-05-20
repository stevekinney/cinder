/**
 * Unit tests for resolveVisualDiffMode() — the env-var parsing logic extracted
 * from screenshot.ts. These tests deliberately avoid spinning up a Playwright
 * browser; they only exercise the pure string-to-mode mapping.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { resolveVisualDiffMode } from './screenshot.ts';

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
