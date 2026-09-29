import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readNumberToken,
  readOklchToken,
  readTranslucentToken,
} from './token-contrast-test-readers.ts';

export * from './color-contrast-utilities.ts';
export * from './token-contrast-test-readers.ts';

export const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'tokens-base.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');
export const accent = readOklchToken('--cinder-accent-solid');
export const accentContrast = readOklchToken('--cinder-accent-contrast');
export const accentText = readOklchToken('--cinder-accent-text');
export const info = readOklchToken('--cinder-status-info-solid');
export const infoContrast = readOklchToken('--cinder-status-info-contrast');
export const neutralBg = readOklchToken('--cinder-status-neutral-background');
export const infoBg = readOklchToken('--cinder-status-info-background');
export const infoFg = readOklchToken('--cinder-status-info-text');
export const successBg = readOklchToken('--cinder-status-success-background');
export const successFg = readOklchToken('--cinder-status-success-text');
export const warningBg = readOklchToken('--cinder-status-warning-background');
export const warningFg = readOklchToken('--cinder-status-warning-text');
export const dangerBg = readOklchToken('--cinder-status-danger-background');
export const dangerFg = readOklchToken('--cinder-status-danger-text');
export const success = readOklchToken('--cinder-status-success-solid');
export const warning = readOklchToken('--cinder-status-warning-solid');
export const danger = readOklchToken('--cinder-status-danger-solid');
export const successContrast = readOklchToken('--cinder-status-success-contrast');
export const warningContrast = readOklchToken('--cinder-status-warning-contrast');
export const dangerContrast = readOklchToken('--cinder-status-danger-contrast');
export const infoBorder = readOklchToken('--cinder-status-info-border');
export const successBorder = readOklchToken('--cinder-status-success-border');
export const warningBorder = readOklchToken('--cinder-status-warning-border');
export const dangerBorder = readOklchToken('--cinder-status-danger-border');
export const dangerHover = readOklchToken('--cinder-status-danger-solid-hover');
export const dangerActive = readOklchToken('--cinder-status-danger-solid-active');
export const infoHover = readOklchToken('--cinder-status-info-solid-hover');
export const infoActive = readOklchToken('--cinder-status-info-solid-active');
export const successHover = readOklchToken('--cinder-status-success-solid-hover');
export const successActive = readOklchToken('--cinder-status-success-solid-active');
export const warningHover = readOklchToken('--cinder-status-warning-solid-hover');
export const warningActive = readOklchToken('--cinder-status-warning-solid-active');
export const bg = readOklchToken('--cinder-surface-canvas');
export const surface = readOklchToken('--cinder-surface');
export const surfaceInset = readOklchToken('--cinder-surface-inset');
export const surfaceRaised = readOklchToken('--cinder-surface-raised');
export const text = readOklchToken('--cinder-text-default');
export const borderFaint = readOklchToken('--cinder-border-faint');
export const borderInk = readOklchToken('--cinder-border-ink');
export const polarityInk = readOklchToken('--cinder-polarity-ink');
export const borderMuted = readTranslucentToken('--cinder-border-muted');
export const border = readTranslucentToken('--cinder-border');
export const borderStrong = readTranslucentToken('--cinder-border-strong');
export const opacityDisabled = readNumberToken('--cinder-opacity-disabled');
export const opacityMuted = readNumberToken('--cinder-opacity-muted');
export const opacityFaint = readNumberToken('--cinder-opacity-faint');
export const chartSeries = Array.from({ length: 8 }, (_, i) =>
  readOklchToken(`--cinder-chart-series-${i + 1}`),
);

export const AA_TEXT = 4.5;
export const NON_TEXT = 3.0;
