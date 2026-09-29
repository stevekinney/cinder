import { describe, expect, test } from 'bun:test';

import { localBunVersionNotice, readPinnedBunVersion } from './local-bun-version-guard.ts';

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
    const pinnedVersion = readPinnedBunVersion();
    expect(pinnedVersion).toBe('1.4.2');
    expect(localBunVersionNotice(pinnedVersion)).toBeUndefined();
    const notice = localBunVersionNotice('9.9.9');
    expect(notice).toContain('9.9.9');
    expect(notice).toContain(pinnedVersion);
  });
});
