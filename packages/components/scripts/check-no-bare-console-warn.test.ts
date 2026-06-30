import { describe, expect, test } from 'bun:test';

import { scanBareConsoleWarn } from './check-no-bare-console-warn.ts';

describe('check-no-bare-console-warn', () => {
  test('component source contains no bare console.warn (all route through devWarn)', async () => {
    // If this fails, replace the bare console.warn with devWarn(...) from
    // utilities/dev-warn.ts.
    expect(await scanBareConsoleWarn()).toEqual([]);
  });
});
