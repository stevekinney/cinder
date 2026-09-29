import { expect, test } from 'bun:test';

import { THEME_STORAGE_KEY, themeContextOptions } from './theme.ts';

test('uses a host-neutral theme storage key', () => {
  expect(THEME_STORAGE_KEY).toBe('browser-fixture-theme');
});

test('requests deterministic reduced motion for each theme', () => {
  expect(themeContextOptions('light')).toEqual({ colorScheme: 'light', reducedMotion: 'reduce' });
  expect(themeContextOptions('dark')).toEqual({ colorScheme: 'dark', reducedMotion: 'reduce' });
});
