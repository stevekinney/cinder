import type { OklchColor } from './color-math.ts';

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
