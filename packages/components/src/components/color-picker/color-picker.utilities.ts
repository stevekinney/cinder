import { parseColor } from '../../utilities/color-luminance.ts';

export type Hsla = { h: number; s: number; l: number; a: number };

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function toHex2(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

function normalizeHue(hue: number): number {
  return Math.min(((hue % 360) + 360) % 360, 359);
}

function rgbToHsl(r: number, g: number, b: number): Omit<Hsla, 'a'> {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) / 2;
  if (maximum === minimum) return { h: 0, s: 0, l: lightness * 100 };
  const delta = maximum - minimum;
  const saturation =
    lightness > 0.5 ? delta / (2 - maximum - minimum) : delta / (maximum + minimum);
  let hue = 0;
  if (maximum === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
  else if (maximum === green) hue = ((blue - red) / delta + 2) * 60;
  else hue = ((red - green) / delta + 4) * 60;
  return { h: hue, s: saturation * 100, l: lightness * 100 };
}

export function hslToRgb(hue: number, saturation: number, lightness: number) {
  const normalizedSaturation = clamp(saturation, 0, 100) / 100;
  const normalizedLightness = clamp(lightness, 0, 100) / 100;
  const normalizedHue = (((hue % 360) + 360) % 360) / 360;
  if (normalizedSaturation === 0) {
    const value = Math.round(normalizedLightness * 255);
    return { r: value, g: value, b: value };
  }
  const q =
    normalizedLightness < 0.5
      ? normalizedLightness * (1 + normalizedSaturation)
      : normalizedLightness + normalizedSaturation - normalizedLightness * normalizedSaturation;
  const p = 2 * normalizedLightness - q;
  const channel = (offset: number): number => {
    let position = offset;
    if (position < 0) position += 1;
    if (position > 1) position -= 1;
    if (position < 1 / 6) return p + (q - p) * 6 * position;
    if (position < 1 / 2) return q;
    if (position < 2 / 3) return p + (q - p) * (2 / 3 - position) * 6;
    return p;
  };
  return {
    r: Math.round(channel(normalizedHue + 1 / 3) * 255),
    g: Math.round(channel(normalizedHue) * 255),
    b: Math.round(channel(normalizedHue - 1 / 3) * 255),
  };
}

export function formatHex(
  hue: number,
  saturation: number,
  lightness: number,
  alpha: number,
  withAlpha: boolean,
): string {
  const { r, g, b } = hslToRgb(hue, saturation, lightness);
  const base = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  return withAlpha ? base + toHex2(alpha * 255) : base;
}

export function parseToHsla(input: string): Hsla | null {
  const parsed = parseColor(input);
  if (!parsed) return null;
  const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
  return { h: normalizeHue(h), s, l, a: parsed.a };
}

export function hueFromKeyboard(current: Hsla, key: string, shiftKey: boolean): Hsla | null {
  const step = shiftKey ? 10 : 1;
  const delta =
    key === 'ArrowLeft' || key === 'ArrowDown'
      ? -step
      : key === 'ArrowRight' || key === 'ArrowUp'
        ? step
        : key === 'PageUp'
          ? 36
          : key === 'PageDown'
            ? -36
            : null;
  if (key === 'Home') return { ...current, h: 0 };
  if (key === 'End') return { ...current, h: 359 };
  if (delta === null) return null;
  return { ...current, h: (((current.h + delta) % 360) + 360) % 360 };
}

export function alphaFromKeyboard(current: Hsla, key: string, shiftKey: boolean): Hsla | null {
  const step = shiftKey ? 0.1 : 0.01;
  const delta =
    key === 'ArrowLeft' || key === 'ArrowDown'
      ? -step
      : key === 'ArrowRight' || key === 'ArrowUp'
        ? step
        : key === 'PageUp'
          ? 0.1
          : key === 'PageDown'
            ? -0.1
            : null;
  if (key === 'Home') return { ...current, a: 0 };
  if (key === 'End') return { ...current, a: 1 };
  if (delta === null) return null;
  return { ...current, a: clamp(current.a + delta, 0, 1) };
}

export function gradientFromKeyboard(current: Hsla, key: string, shiftKey: boolean): Hsla | null {
  const step = shiftKey ? 10 : 1;
  if (key === 'ArrowLeft') return { ...current, s: clamp(current.s - step, 0, 100) };
  if (key === 'ArrowRight') return { ...current, s: clamp(current.s + step, 0, 100) };
  if (key === 'ArrowUp') return { ...current, l: clamp(current.l + step, 0, 100) };
  if (key === 'ArrowDown') return { ...current, l: clamp(current.l - step, 0, 100) };
  return null;
}
