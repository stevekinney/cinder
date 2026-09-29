export type Rgb = [number, number, number];
export type Lab = [number, number, number];
export type OklchColor = { l: number; c: number; h: number };

/** OKLCH (l in 0..1, chroma, hue degrees) → linear sRGB (may be out of [0,1]). */
export function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const longCone = l + 0.3963377774 * a + 0.2158037573 * b;
  const mediumCone = l - 0.1055613458 * a - 0.0638541728 * b;
  const shortCone = l - 0.0894841775 * a - 1.291485548 * b;
  const lCubed = longCone ** 3;
  const mCubed = mediumCone ** 3;
  const sCubed = shortCone ** 3;
  return [
    4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed,
    -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed,
    -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed,
  ];
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

export function mixOklch(base: OklchColor, target: OklchColor, targetPercent: number): OklchColor {
  const weight = targetPercent / 100;
  const baseHue = base.c === 0 ? target.h : base.h;
  const targetHue = target.c === 0 ? base.h : target.h;
  let hueDelta = targetHue - baseHue;
  if (hueDelta > 180) hueDelta -= 360;
  if (hueDelta < -180) hueDelta += 360;
  return {
    l: base.l + (target.l - base.l) * weight,
    c: base.c + (target.c - base.c) * weight,
    h: baseHue + hueDelta * weight,
  };
}

export function deriveStatusTier(base: OklchColor, target: OklchColor): OklchColor {
  const mixed = mixOklch(base, target, 36);
  return { ...mixed, c: Math.min(mixed.c, 0.05) };
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
  const [r, g, b] = clampRgb(oklchToLinearSrgb(color.l, color.c, color.h));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two relative luminances. */
export function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** CIE L*a*b* (D65) of an OKLCH color, computed on its clamped sRGB output. */
export function toCieLab(color: OklchColor): Lab {
  const [r, g, b] = clampRgb(oklchToLinearSrgb(color.l, color.c, color.h));
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const xn = 0.95047;
  const yn = 1;
  const zn = 1.08883;
  const fx = labTransfer(x / xn);
  const fy = labTransfer(y / yn);
  const fz = labTransfer(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 color difference between two CIE Lab triples. */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const [bigL1, a1, b1] = lab1;
  const [bigL2, a2, b2] = lab2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  // Reference (Sharma et al.) normalizes hue angles to [0, 360); atan2 returns (-180, 180].
  const h1p = c1p === 0 ? 0 : ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360;
  const h2p = c2p === 0 ? 0 : ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;
  const dLp = bigL2 - bigL1;
  const dCp = c2p - c1p;
  // Zero-chroma branch (CIEDE2000 reference): when either adjusted chroma is zero, hue is
  // undefined — set the hue delta to 0 and skip the ±360 wrap. Without this, atan2(0, 0)
  // is treated as a real angle and produces a nonstandard ΔE00 for grayscale pairs.
  const chromaProduct = c1p * c2p;
  let dhp = 0;
  if (chromaProduct !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * Math.PI) / 360);
  const lBarP = (bigL1 + bigL2) / 2;
  const cBarP = (c1p + c2p) / 2;
  // Mean hue: again undefined at zero chroma — the reference sets it to the sum (one of the
  // two angles is 0), with no ±360 wrap and no halving when the product is zero.
  let hBarP: number;
  if (chromaProduct === 0) {
    hBarP = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hBarP = (h1p + h2p) / 2;
  } else {
    hBarP = (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos(((hBarP - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hBarP * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hBarP + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hBarP - 63) * Math.PI) / 180);
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBarP - 50) ** 2) / Math.sqrt(20 + (lBarP - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin((2 * dTheta * Math.PI) / 180) * rc;
  return Math.sqrt(
    (dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh),
  );
}

/**
 * Brettel-1997-style dichromacy simulation matrices applied in linear sRGB. Used only
 * for the non-blocking CVD diagnostic, never for a hard assertion.
 */
const CVD_MATRICES = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} satisfies Record<string, [Rgb, Rgb, Rgb]>;

export function simulateCvd(color: OklchColor, type: keyof typeof CVD_MATRICES): Lab {
  const [r, g, b] = clampRgb(oklchToLinearSrgb(color.l, color.c, color.h));
  const [row0, row1, row2] = CVD_MATRICES[type];
  const dot = (row: Rgb): number => row[0] * r + row[1] * g + row[2] * b;
  const [sr, sg, sb] = clampRgb([dot(row0), dot(row1), dot(row2)]);
  // Reuse the Lab path on already-linear rgb.
  const x = 0.4124564 * sr + 0.3575761 * sg + 0.1804375 * sb;
  const y = 0.2126729 * sr + 0.7151522 * sg + 0.072175 * sb;
  const z = 0.0193339 * sr + 0.119192 * sg + 0.9503041 * sb;
  const fx = labTransfer(x / 0.95047);
  const fy = labTransfer(y / 1);
  const fz = labTransfer(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labTransfer(value: number): number {
  return value > (6 / 29) ** 3 ? Math.cbrt(value) : value / (3 * (6 / 29) ** 2) + 4 / 29;
}
