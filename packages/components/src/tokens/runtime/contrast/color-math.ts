import { converter } from 'culori';

export type Rgb = [number, number, number];
export type Lab = [number, number, number];
export type OklchColor = { l: number; c: number; h: number };

const toLinearSrgb = converter('lrgb');

/** OKLCH (l in 0..1, chroma, hue degrees) → linear sRGB (may be out of [0,1]). */
export function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
  const { r, g, b } = toLinearSrgb({ mode: 'oklch', l, c, h: hDeg });
  return [r, g, b];
}

const GAMUT_EPSILON = 0.001;

/** True when every linear-sRGB channel is within [0,1] (so no chroma clamping occurs). */
export function isInSrgbGamut(color: OklchColor): boolean {
  return oklchToLinearSrgb(color.l, color.c, color.h).every(
    (channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON,
  );
}

/** Clamp each channel of a linear-sRGB triple into [0,1], preserving the tuple type. */
export function clampRgb([r, g, b]: Rgb): Rgb {
  return [clampChannel(r), clampChannel(g), clampChannel(b)];
}

function clampChannel(channel: number): number {
  return Math.min(1, Math.max(0, channel));
}

/** The sRGB transfer function and its inverse, used to move between the two spaces below. */
export function encodeSrgb(channel: number): number {
  const clamped = Math.min(1, Math.max(0, channel));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

export function decodeSrgb(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * A translucent `foreground` painted over an opaque `background`, in and out of
 * LINEAR sRGB.
 *
 * The composite itself happens on GAMMA-ENCODED channels, because that is what
 * the browser does -- and until CIN-245 this function did it on the linear
 * channels it is handed, which is a different color and, in the dark arm, a
 * materially more optimistic one. Measured in Chromium (`page.screenshot` +
 * pixel read-back, both arms, the exact tokens this file gates):
 *
 *   white @ 35% over `#1a2430`  ->  rendered 105,112,120
 *                                   gamma composite 106,113,120   (matches)
 *                                   linear composite 161,162,164  (does not)
 *
 * Compositing black over white in linear light OVERSTATES the result's
 * lightness and so understates contrast; compositing white over a dark surface
 * understates it and so OVERSTATES contrast. The second direction is the
 * dangerous one: it is exactly the dark-arm, light-ink case the border tiers
 * now use, and the old model reported ~1.5x more contrast than ships. Every
 * assertion here that composites reads the browser's number now.
 */
export function compositeOver(foreground: Rgb, background: Rgb, opacity: number): Rgb {
  const compositeChannel = (channel: number, backdrop: number): number =>
    decodeSrgb(encodeSrgb(channel) * opacity + encodeSrgb(backdrop) * (1 - opacity));
  return [
    compositeChannel(foreground[0], background[0]),
    compositeChannel(foreground[1], background[1]),
    compositeChannel(foreground[2], background[2]),
  ];
}

/** WCAG relative luminance of an OKLCH color (computed on its clamped sRGB output). */
export function wcagLuminance(color: OklchColor): number {
  return relativeLuminance(clampRgb(oklchToLinearSrgb(color.l, color.c, color.h)));
}

/** WCAG relative luminance of a linear-sRGB triple, unrounded. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two relative luminances. */
export function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}
