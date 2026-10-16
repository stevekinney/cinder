/**
 * Measures one pairing against one context's property map.
 *
 * Colors come from the CSS the projection emits, evaluated by `css-color.ts`. A translucent
 * foreground is composited over its background, and a translucent background over its
 * declared backdrop, in gamma-encoded sRGB the way the browser paints. A value that cannot be
 * evaluated, a translucent background with no known backdrop, or a gradient or image is
 * reported as `needs-review`, never as a ratio.
 */

import { converter, type Oklch } from 'culori';

import { contrastRatio, decodeSrgb, relativeLuminance, type Rgb } from './color-math.ts';
import {
  evaluateCssColor,
  type CssColor,
  type CssColorFailureCode,
  type CssColorOptions,
} from './css-color.ts';
import type { ContrastPairing } from './pairings.ts';

const toSrgb = converter('rgb');
const toLinear = converter('lrgb');

export type NeedsReviewCode =
  CssColorFailureCode | 'unknown-background' | 'invalid-opacity' | 'unknown-opacity';

export type StackLayer = {
  role: 'foreground' | 'background' | 'backdrop';
  property: string;
  /** The CSS value as the context's property map holds it. */
  value: string;
  /** Gamma-encoded sRGB after clamping, with the alpha the layer carried. */
  rgb: { r: number; g: number; b: number; alpha: number };
  /** True when the color is outside the sRGB gamut and was clamped to measure it. */
  clamped: boolean;
};

export type PairingMeasurement =
  | {
      status: 'measured';
      /** The unrounded WCAG contrast ratio. */
      ratio: number;
      stack: StackLayer[];
      /** True when any layer was clamped into sRGB to be measured. */
      clamped: boolean;
      /** The foreground as painted over the ground, and the opaque ground, in gamma sRGB. */
      ink: StackLayer['rgb'];
      ground: StackLayer['rgb'];
    }
  | {
      status: 'needs-review';
      code: NeedsReviewCode;
      reason: string;
      /** The CSS property whose value could not be measured. */
      property: string;
    };

type Resolved =
  { ok: true; layer: StackLayer } | { ok: false; code: NeedsReviewCode; reason: string };

const GAMUT_EPSILON = 0.001;

function resolveLayer(
  role: StackLayer['role'],
  property: string,
  properties: Readonly<Record<string, string>>,
  options: CssColorOptions,
): Resolved {
  const value = properties[property];
  if (value === undefined) {
    return { ok: false, code: 'missing-property', reason: `${property} has no value here.` };
  }
  const evaluated = evaluateCssColor(value, properties, options);
  if (!evaluated.ok) return { ok: false, code: evaluated.code, reason: evaluated.reason };
  return { ok: true, layer: toLayer(role, property, value, evaluated.color) };
}

/** An OKLCH value for culori; an achromatic color has no hue, and the key is left off. */
function oklchSource(color: CssColor): Oklch {
  return color.h === undefined
    ? { mode: 'oklch', l: color.l, c: color.c }
    : { mode: 'oklch', l: color.l, c: color.c, h: color.h };
}

function toLayer(
  role: StackLayer['role'],
  property: string,
  value: string,
  color: CssColor,
): StackLayer {
  const source = oklchSource(color);
  const { r, g, b } = toSrgb(source);
  // The gamut test is on linear channels, with the same tolerance the Cinder gamut suite uses.
  const linear = toLinear(source);
  const inGamut = [linear.r, linear.g, linear.b].every(
    (channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON,
  );
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
  return {
    role,
    property,
    value,
    rgb: { r: clamp(r), g: clamp(g), b: clamp(b), alpha: Math.min(1, Math.max(0, color.alpha)) },
    clamped: !inGamut,
  };
}

/** Paint `top` over an opaque `under`, in gamma-encoded sRGB. */
function paint(top: StackLayer['rgb'], under: StackLayer['rgb']): StackLayer['rgb'] {
  const mix = (a: number, b: number) => a * top.alpha + b * (1 - top.alpha);
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), alpha: 1 };
}

function luminanceOf(rgb: StackLayer['rgb']): number {
  const linear: Rgb = [decodeSrgb(rgb.r), decodeSrgb(rgb.g), decodeSrgb(rgb.b)];
  return relativeLuminance(linear);
}

export function measurePairing(
  pairing: ContrastPairing,
  properties: Readonly<Record<string, string>>,
  options: CssColorOptions,
): PairingMeasurement {
  const review = (property: string, code: NeedsReviewCode, reason: string): PairingMeasurement => ({
    status: 'needs-review',
    code,
    reason,
    property,
  });

  const foreground = resolveLayer('foreground', pairing.foreground, properties, options);
  if (!foreground.ok) return review(pairing.foreground, foreground.code, foreground.reason);
  const background = resolveLayer('background', pairing.background, properties, options);
  if (!background.ok) return review(pairing.background, background.code, background.reason);

  const stack: StackLayer[] = [foreground.layer, background.layer];
  let ground = background.layer.rgb;
  if (ground.alpha < 1) {
    if (pairing.backdrop === undefined) {
      return review(
        pairing.background,
        'unknown-background',
        `${pairing.background} is translucent and the pairing names no surface beneath it.`,
      );
    }
    const backdrop = resolveLayer('backdrop', pairing.backdrop, properties, options);
    if (!backdrop.ok) return review(pairing.backdrop, backdrop.code, backdrop.reason);
    if (backdrop.layer.rgb.alpha < 1) {
      return review(
        pairing.backdrop,
        'unknown-background',
        `${pairing.backdrop} is translucent, so the surface beneath the pairing is unknown.`,
      );
    }
    stack.push(backdrop.layer);
    ground = paint(ground, backdrop.layer.rgb);
  }

  let ink = foreground.layer.rgb;
  if (pairing.opacity !== undefined) {
    const raw = properties[pairing.opacity];
    if (raw === undefined) {
      return review(pairing.opacity, 'unknown-opacity', `${pairing.opacity} has no value here.`);
    }
    const opacity = Number(raw);
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      return review(
        pairing.opacity,
        'invalid-opacity',
        `${pairing.opacity} is ${raw}, not 0 to 1.`,
      );
    }
    ink = { ...ink, alpha: ink.alpha * opacity };
  }
  const painted = ink.alpha < 1 ? paint(ink, ground) : ink;
  return {
    status: 'measured',
    ratio: contrastRatio(luminanceOf(painted), luminanceOf(ground)),
    stack,
    clamped: stack.some((layer) => layer.clamped),
    ink: painted,
    ground,
  };
}
