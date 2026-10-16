/**
 * WCAG 2.2 AA contrast thresholds and the Cinder floors that sit beside them.
 *
 * Every comparison here is on the unrounded ratio: 4.499 does not meet 4.5 and 2.999 does not
 * meet 3. Nothing rounds before comparing.
 */

/** WCAG 1.4.3: body text. */
export const AA_TEXT = 4.5;
/** WCAG 1.4.3 for large text, and 1.4.11 for meaningful non-text contrast. */
export const NON_TEXT = 3.0;
/** The large-text threshold, named for what it applies to. */
export const AA_LARGE_TEXT = 3.0;

/** Large text is at least 24 CSS px, or at least 18.6667 CSS px (14pt) and bold. */
export const LARGE_TEXT_PX = 24;
export const LARGE_BOLD_TEXT_PX = 18.6667;
export const BOLD_FONT_WEIGHT = 700;

/**
 * Cinder's own floors for decorative separators. They are stricter than WCAG asks for (WCAG
 * exempts a purely decorative separator), so they are advisory: visible, never able to change
 * pass or fail.
 */
export const DECORATIVE_BORDER = 1.4;
export const FAINT_BORDER = 1.1;
/** Border tiers must read within this fraction of the larger ratio across the legal surfaces. */
export const BORDER_TIER_MAX_SPREAD = 0.15;
/** Chart series: the minimum pairwise CIEDE2000 distance and CIE L* separation. */
export const CHART_MIN_DELTA_E = 12;
export const CHART_MIN_DELTA_L = 4;
export const CHART_MIN_CHROMA = 0.06;

export const CONTRAST_CLASSIFICATIONS = [
  'text',
  'large-text',
  'non-text-indicator',
  'decorative-separator',
  'disabled',
] as const;
export type ContrastClassification = (typeof CONTRAST_CLASSIFICATIONS)[number];

/** The rendered size of a piece of text, in CSS px and a numeric font weight. */
export type RenderedTextSize = { fontSizePx: number; fontWeight: number };

/** WCAG's large-text definition. An unknown size is never large. */
export function isLargeText(size: RenderedTextSize | undefined): boolean {
  if (size === undefined) return false;
  const { fontSizePx, fontWeight } = size;
  if (!Number.isFinite(fontSizePx) || !Number.isFinite(fontWeight)) return false;
  if (fontSizePx >= LARGE_TEXT_PX) return true;
  return fontSizePx >= LARGE_BOLD_TEXT_PX && fontWeight >= BOLD_FONT_WEIGHT;
}

/** The text classification a rendered size earns: only a known large size earns the 3:1 floor. */
export function classifyText(size: RenderedTextSize | undefined): 'text' | 'large-text' {
  return isLargeText(size) ? 'large-text' : 'text';
}

/**
 * The normative WCAG minimum for a classification, or `null` when WCAG sets none (a purely
 * decorative separator and an inactive component are exempt from contrast requirements).
 */
export function requiredContrast(classification: ContrastClassification): number | null {
  switch (classification) {
    case 'text':
      return AA_TEXT;
    case 'large-text':
      return AA_LARGE_TEXT;
    case 'non-text-indicator':
      return NON_TEXT;
    case 'decorative-separator':
    case 'disabled':
      return null;
  }
}

/** Whether a measured ratio meets a required one. Both stay unrounded. */
export function meetsContrast(measured: number, required: number): boolean {
  return measured >= required;
}
