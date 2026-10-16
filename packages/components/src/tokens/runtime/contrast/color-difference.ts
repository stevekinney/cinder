import { clampRgb, oklchToLinearSrgb, type Lab, type OklchColor, type Rgb } from './color-math.ts';

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
