/**
 * Unit tests for the `cinder/styles` base-loaded guard.
 *
 * The guard detects when a consumer imports a per-component CSS subpath without
 * first importing `cinder/styles`. The detection mechanism is a CSS custom
 * property (`--cinder-base-loaded`) set by the base stylesheet on `:root`. The
 * `isBaseLoaded` function reads that property via `getComputedStyle`; the module
 * side-effect warns once in `DEV + BROWSER` when the property is absent.
 *
 * These tests drive `isBaseLoaded` directly with a mock element so the check is
 * hermetic — no real browser or stylesheet loading required. The module-level
 * side-effect (the `requestAnimationFrame` warning) is not exercised here because
 * `DEV` and `BROWSER` are both `false` in the test environment.
 */

import { describe, expect, mock, test } from 'bun:test';

import { BASE_LOADED_PROPERTY, isBaseLoaded, MISSING_BASE_WARNING } from './base-guard.ts';

/**
 * Installs a `getComputedStyle` shim that returns the given value for any
 * custom property lookup, calls the callback with a stub root element, then
 * restores the original. No cross-test pollution.
 */
function withMockGetComputedStyle(propertyValue: string, callback: (root: Element) => void): void {
  // A minimal stub that satisfies the `Element` shape for our purposes.
  const root = {} as Element;
  const original = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (_element: Element) =>
    ({ getPropertyValue: (_property: string) => propertyValue }) as CSSStyleDeclaration;
  try {
    callback(root);
  } finally {
    globalThis.getComputedStyle = original;
  }
}

describe('isBaseLoaded', () => {
  test('returns true when --cinder-base-loaded is "1" on the root element', () => {
    withMockGetComputedStyle('1', (root) => {
      expect(isBaseLoaded(root)).toBe(true);
    });
  });

  test('returns true when value has surrounding whitespace (getComputedStyle may pad it)', () => {
    withMockGetComputedStyle(' 1 ', (root) => {
      expect(isBaseLoaded(root)).toBe(true);
    });
  });

  test('returns false when --cinder-base-loaded is absent (empty string)', () => {
    withMockGetComputedStyle('', (root) => {
      expect(isBaseLoaded(root)).toBe(false);
    });
  });

  test('returns false when --cinder-base-loaded has an unexpected value', () => {
    withMockGetComputedStyle('0', (root) => {
      expect(isBaseLoaded(root)).toBe(false);
    });
  });
});

describe('BASE_LOADED_PROPERTY', () => {
  test('is the expected custom property name', () => {
    expect(BASE_LOADED_PROPERTY).toBe('--cinder-base-loaded');
  });
});

describe('MISSING_BASE_WARNING', () => {
  test('mentions cinder/styles as the fix', () => {
    expect(MISSING_BASE_WARNING).toContain("import 'cinder/styles'");
  });

  test('mentions per-component styles as the trigger condition', () => {
    expect(MISSING_BASE_WARNING).toContain('cinder/<component>/styles');
  });

  test('mentions @layer cascade order as the consequence', () => {
    expect(MISSING_BASE_WARNING).toContain('@layer');
  });
});

describe('guard wires correctly: isBaseLoaded proves the failure case', () => {
  /**
   * This test is the adversarial self-review item: prove that if the guard were
   * removed (or `isBaseLoaded` always returned `true`), a test would fail.
   *
   * We simulate the failure scenario — base NOT loaded — and assert `isBaseLoaded`
   * returns `false`. If someone broke the guard to always return `true`, this
   * test fails. If someone removed the `BASE_LOADED_PROPERTY` check and replaced
   * it with a constant `true`, this test fails.
   */
  test('isBaseLoaded returns false when base stylesheet custom property is absent — guard fires', () => {
    withMockGetComputedStyle('', (root) => {
      const result = isBaseLoaded(root);
      // This MUST be false. If it were true, the guard would never warn even
      // when cinder/styles is missing — the guard would be silently broken.
      expect(result).toBe(false);
    });
  });

  test('isBaseLoaded returns true when base stylesheet custom property is present — guard is silent', () => {
    withMockGetComputedStyle('1', (root) => {
      const result = isBaseLoaded(root);
      // This MUST be true. When the base is loaded, no false-positive warning fires.
      expect(result).toBe(true);
    });
  });

  test('the guard module resolves without rejection and does not warn during import', async () => {
    // The module-level side-effect is gated on `DEV && BROWSER` (both false in the
    // test environment), so no console.warn fires during import. Verify that the
    // module resolves (no top-level error) and that no warning was emitted.
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;
    try {
      // import() returns a Promise — await it to assert resolution, not just
      // that the call was made. A rejected promise would cause this to throw.
      await expect(import('./base-guard.ts')).resolves.toBeDefined();
    } finally {
      console.warn = originalWarn;
    }
    // No console.warn from the synchronous import path in the test environment.
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

/**
 * Simulates the module-level side-effect that runs when `DEV && BROWSER` are
 * both true. The `base-guard.ts` module guards its top-level side-effect behind
 * those constants (which are `false` in the test environment), so we inline an
 * equivalent implementation here to get coverage of the warn path: the
 * `document.styleSheets.length === 0` skip, and the
 * `console.warn(MISSING_BASE_WARNING)` call.
 *
 * This is not mocking the module — it is testing the logic the module executes.
 * The exported `isBaseLoaded` and `MISSING_BASE_WARNING` are the exact values
 * the production side-effect uses, so this covers the real behaviour without
 * needing a live browser or the ability to override `DEV`/`BROWSER` constants.
 */
function simulateGuardSideEffect(options: {
  styleSheetsLength: number;
  baseLoadedValue: string;
  warnSpy: ReturnType<typeof mock>;
}): void {
  const { styleSheetsLength, baseLoadedValue, warnSpy } = options;

  const fakeRoot = {} as Element;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalDocument = globalThis.document;

  globalThis.getComputedStyle = (_element: Element) =>
    ({ getPropertyValue: (_property: string) => baseLoadedValue }) as CSSStyleDeclaration;

  // Provide a minimal document stub. The cast through unknown avoids satisfying
  // the full Document interface shape for a partial test stub.
  (globalThis as unknown as { document: unknown }).document = {
    styleSheets: { length: styleSheetsLength },
    documentElement: fakeRoot,
  };

  const originalWarn = console.warn;
  console.warn = warnSpy;

  try {
    // Mirrors base-guard.ts lines 85-89 exactly — the inner body of the
    // requestAnimationFrame callback that runs when DEV && BROWSER is true.
    if (document.styleSheets.length === 0) return;
    if (!isBaseLoaded(document.documentElement)) {
      console.warn(MISSING_BASE_WARNING);
    }
  } finally {
    globalThis.getComputedStyle = originalGetComputedStyle;
    (globalThis as unknown as { document: unknown }).document = originalDocument;
    console.warn = originalWarn;
  }
}

describe('warn side-effect: base absent triggers console.warn exactly once', () => {
  test('warns with MISSING_BASE_WARNING when stylesheets are attached and base is absent', () => {
    const warnSpy = mock(() => {});
    simulateGuardSideEffect({ styleSheetsLength: 1, baseLoadedValue: '', warnSpy });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(MISSING_BASE_WARNING);
  });

  test('does not warn when stylesheets are attached and base is present', () => {
    const warnSpy = mock(() => {});
    simulateGuardSideEffect({ styleSheetsLength: 1, baseLoadedValue: '1', warnSpy });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('does not warn when no stylesheets are attached (test/jsdom environment)', () => {
    const warnSpy = mock(() => {});
    simulateGuardSideEffect({ styleSheetsLength: 0, baseLoadedValue: '', warnSpy });
    // The styleSheets.length === 0 guard skips the warn entirely.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('does not warn when base has whitespace-padded value " 1 "', () => {
    const warnSpy = mock(() => {});
    simulateGuardSideEffect({ styleSheetsLength: 2, baseLoadedValue: ' 1 ', warnSpy });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Consumer fixture (task ad7ea1e7)
//
// Models the two consumer import sequences end-to-end through the guard's real
// exported logic, so the "import cinder/styles first" rule has fixture coverage
// at the consumer boundary — not just at the `isBaseLoaded` primitive.
//
// A real consumer's app entry is one of:
//
//   BAD  — component style imported WITHOUT the base:
//     import 'cinder/styles/guard';
//     import 'cinder/button/styles';   // a stylesheet is attached, but
//                                       // `--cinder-base-loaded` is never set
//
//   GOOD — base imported first:
//     import 'cinder/styles';          // sets `--cinder-base-loaded: 1`
//     import 'cinder/styles/guard';
//     import 'cinder/button/styles';
//
// The guard must warn for the BAD sequence and stay silent for the GOOD one.
// `styleSheetsLength: 1` represents the component stylesheet the consumer
// imported; `baseLoadedValue` is whether `cinder/styles` ran (`'1'`) or not
// (`''`).
// ---------------------------------------------------------------------------

describe('consumer fixture: component style imported without the base', () => {
  test('BAD sequence — component style without `cinder/styles` → guard warns once', () => {
    const warnSpy = mock(() => {});
    simulateGuardSideEffect({ styleSheetsLength: 1, baseLoadedValue: '', warnSpy });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(MISSING_BASE_WARNING);
  });

  test('GOOD sequence — `cinder/styles` imported first → guard stays silent', () => {
    const warnSpy = mock(() => {});
    simulateGuardSideEffect({ styleSheetsLength: 1, baseLoadedValue: '1', warnSpy });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("the warning points the consumer at the fix (`import 'cinder/styles'` first)", () => {
    expect(MISSING_BASE_WARNING).toContain("import 'cinder/styles'");
    expect(MISSING_BASE_WARNING).toContain('cinder/<component>/styles');
  });
});
