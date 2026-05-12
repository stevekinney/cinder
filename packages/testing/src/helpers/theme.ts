import type { BrowserContextOptions } from '@playwright/test';
import type { Theme } from './manifest.ts';

export function themeContextOptions(theme: Theme): BrowserContextOptions {
  return { colorScheme: theme, reducedMotion: 'reduce' };
}

export const THEME_STORAGE_KEY = 'cinder-playground-theme';
