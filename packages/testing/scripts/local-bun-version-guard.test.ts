import { describe, expect, test } from 'bun:test';

import { localBunVersionNotice } from './local-bun-version-guard.ts';

describe('localBunVersionNotice', () => {
  test('is silent when the running Bun matches the pin', () => {
    expect(localBunVersionNotice('1.4.0', '1.4.0')).toBeUndefined();
  });

  test('warns, without failing, when the running Bun differs from the pin', () => {
    const notice = localBunVersionNotice('1.4.2', '1.4.0');
    expect(notice).toContain('1.4.2');
    expect(notice).toContain('1.4.0');
    expect(notice).toContain('CI');
  });

  test('defaults the pinned version to the workspace packageManager pin', () => {
    // readPinnedBunVersion() reads the real root package.json, which pins
    // bun@1.4.0 — see packages/testing/scripts/pinned-bun-version.test.ts.
    expect(localBunVersionNotice('1.4.0')).toBeUndefined();
    const notice = localBunVersionNotice('9.9.9');
    expect(notice).toContain('9.9.9');
    expect(notice).toContain('1.4.0');
  });
});
