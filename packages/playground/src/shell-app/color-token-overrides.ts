import {
  COLOR_TOKEN_NAMES,
  isColorTokenName,
  isSafeColorTokenValue,
  type ColorTokenOverrides,
} from './color-token-registry.ts';
import type { ThemeChoice } from './routing.ts';

export type ColorTokenOverrideState = Record<ThemeChoice, ColorTokenOverrides>;

export const COLOR_TOKEN_SESSION_KEY = 'cinder-playground-color-token-overrides';

const THEME_VALUES: ReadonlySet<ThemeChoice> = new Set(['light', 'dark']);

export function readSessionColorTokenOverrides(): ColorTokenOverrideState {
  const empty: ColorTokenOverrideState = { light: {}, dark: {} };
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(COLOR_TOKEN_SESSION_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const result: ColorTokenOverrideState = { light: {}, dark: {} };
    for (const theme of THEME_VALUES) {
      const entries = Reflect.get(parsed, theme);
      if (typeof entries !== 'object' || entries === null) continue;
      for (const [tokenName, value] of Object.entries(entries)) {
        if (
          isColorTokenName(tokenName) &&
          typeof value === 'string' &&
          isSafeColorTokenValue(value)
        ) {
          result[theme][tokenName] = value.trim();
        }
      }
    }
    return result;
  } catch {
    return empty;
  }
}

export function writeSessionColorTokenOverrides(overrides: ColorTokenOverrideState): void {
  try {
    sessionStorage.setItem(COLOR_TOKEN_SESSION_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore — degraded but functional */
  }
}

export function applyColorTokenOverridesToDocument(
  doc: Document,
  overrides: ColorTokenOverrides,
): void {
  for (const tokenName of COLOR_TOKEN_NAMES) {
    doc.documentElement.style.removeProperty(tokenName);
  }

  for (const [tokenName, value] of Object.entries(overrides)) {
    if (!isColorTokenName(tokenName)) continue;
    if (typeof value !== 'string' || !isSafeColorTokenValue(value)) continue;
    doc.documentElement.style.setProperty(tokenName, value.trim());
  }
}
