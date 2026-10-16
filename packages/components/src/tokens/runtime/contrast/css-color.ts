/**
 * A deliberately small evaluator for the CSS color syntax the token projection emits:
 * literals (`oklch()`, hex, `rgb()`, `transparent`), `var()` aliases resolved through the same
 * property map, `light-dark()`, `color-mix(in oklch, ...)` and relative `oklch(from ...)`.
 *
 * Anything else (another interpolation space, a gradient, an image, an unsupported function) is
 * returned as a typed failure so the caller reports Needs review. It never guesses a color.
 */

import { converter, parse, type Oklch } from 'culori';

export type CssColorFailureCode =
  'missing-property' | 'unsupported-syntax' | 'gradient-or-image' | 'reference-cycle';

export type CssColor = { l: number; c: number; h: number | undefined; alpha: number };
export type CssColorResult =
  { ok: true; color: CssColor } | { ok: false; code: CssColorFailureCode; reason: string };

export type CssColorOptions = {
  /** Selects the arm of `light-dark()`. */
  theme: 'light' | 'dark';
};

const toOklch = converter('oklch');
const MAX_DEPTH = 32;

const fail = (code: CssColorFailureCode, reason: string): CssColorResult => ({
  ok: false,
  code,
  reason,
});

/** Split on top-level separators, keeping parenthesised groups whole. */
function splitTopLevel(input: string, separator: 'comma' | 'space'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of input) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    const isSeparator =
      depth === 0 && (separator === 'comma' ? character === ',' : /\s/.test(character));
    if (isSeparator) {
      if (current.trim() !== '') parts.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

/** The inside of `name( ... )` when `value` is exactly one such call. */
function callArguments(value: string, name: string): string | null {
  const lower = value.toLowerCase();
  if (!lower.startsWith(`${name}(`) || !value.endsWith(')')) return null;
  let depth = 0;
  for (let index = name.length; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth -= 1;
    if (depth === 0 && index < value.length - 1) return null;
  }
  return value.slice(name.length + 1, -1);
}

const CHANNELS = ['l', 'c', 'h', 'alpha'] as const;
type Variables = { l: number; c: number; h: number; alpha: number };

/** `calc()`, `min()`, `max()` over numbers and the relative-color channel keywords. */
function evaluateExpression(source: string, variables: Variables): number | null {
  const tokens = source.match(
    /min\(|max\(|calc\(|[A-Za-z]+|\d*\.?\d+(?:e[+-]?\d+)?%?|[()+\-*/,]/gi,
  );
  if (tokens === null || tokens.join('') !== source.replace(/\s+/g, '')) return null;
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];

  function primary(): number | null {
    const token = take();
    if (token === undefined) return null;
    if (token === '(') return group();
    if (/^calc\($/i.test(token)) return group();
    if (/^(min|max)\($/i.test(token)) {
      const values: number[] = [];
      do {
        const value = sum();
        if (value === null) return null;
        values.push(value);
      } while (peek() === ',' && take() !== undefined);
      if (take() !== ')') return null;
      return token.toLowerCase().startsWith('min') ? Math.min(...values) : Math.max(...values);
    }
    if (token === '-') {
      const value = primary();
      return value === null ? null : -value;
    }
    const channel = CHANNELS.find((name) => name === token);
    if (channel !== undefined) return variables[channel];
    const number = Number.parseFloat(token);
    if (/^\d|^\./.test(token) && Number.isFinite(number))
      return token.endsWith('%') ? number : number;
    return null;
  }
  function group(): number | null {
    const value = sum();
    return take() === ')' ? value : null;
  }
  function product(): number | null {
    let value = primary();
    while (value !== null && (peek() === '*' || peek() === '/')) {
      const operator = take();
      const right = primary();
      if (right === null) return null;
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }
  function sum(): number | null {
    let value = product();
    while (value !== null && (peek() === '+' || peek() === '-')) {
      const operator = take();
      const right = product();
      if (right === null) return null;
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }
  const result = sum();
  return position === tokens.length ? result : null;
}

function channelValue(
  token: string,
  variables: Variables,
  channel: 'l' | 'c' | 'h' | 'alpha',
): number | null {
  if (token === 'none') return 0;
  if (/^[\d.]+%$/.test(token)) {
    const fraction = Number.parseFloat(token) / 100;
    if (channel === 'l' || channel === 'alpha') return fraction;
    if (channel === 'c') return fraction * 0.4;
    return null;
  }
  return evaluateExpression(token, variables);
}

function mixColors(
  first: { color: CssColor; weight: number },
  second: { color: CssColor; weight: number },
): CssColor {
  const total = first.weight + second.weight;
  if (total <= 0) return { ...first.color, alpha: 0 };
  const a = first.weight / total;
  const b = second.weight / total;
  // The alpha multiplier applies when the percentages sum to less than 100%.
  const multiplier = Math.min(1, total / 100);
  const alpha = (first.color.alpha * a + second.color.alpha * b) * multiplier;
  const premultiplied = (x: number, y: number) =>
    alpha === 0
      ? 0
      : (x * first.color.alpha * a + y * second.color.alpha * b) / (alpha / multiplier);
  const l = premultiplied(first.color.l, second.color.l);
  const c = premultiplied(first.color.c, second.color.c);
  // An achromatic color has a missing hue, so the other color's hue is used as is.
  const firstHue = first.color.h ?? second.color.h ?? 0;
  const secondHue = second.color.h ?? first.color.h ?? 0;
  let delta = secondHue - firstHue;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const hueWeight = first.color.alpha * a + second.color.alpha * b;
  const hue =
    hueWeight === 0 ? firstHue : firstHue + (delta * (second.color.alpha * b)) / hueWeight;
  return { l, c, h: ((hue % 360) + 360) % 360, alpha };
}

function fromCulori(parsed: ReturnType<typeof parse>): CssColor | null {
  if (parsed === undefined) return null;
  const oklch: Oklch = toOklch(parsed);
  return { l: oklch.l, c: oklch.c, h: oklch.h, alpha: oklch.alpha ?? 1 };
}

function mixArgument(argument: string): { color: string; percent: number | null } | null {
  const parts = splitTopLevel(argument, 'space');
  const percentAt = parts.findIndex((part) => /^[\d.]+%$/.test(part));
  if (percentAt === -1) return { color: parts.join(' '), percent: null };
  if (percentAt !== 0 && percentAt !== parts.length - 1) return null;
  const percent = Number.parseFloat(parts[percentAt]!);
  const rest = parts.filter((_, index) => index !== percentAt).join(' ');
  return { color: rest, percent };
}

function evaluate(
  value: string,
  properties: Readonly<Record<string, string>>,
  options: CssColorOptions,
  seen: readonly string[],
): CssColorResult {
  const source = value.trim();
  if (seen.length > MAX_DEPTH)
    return fail('reference-cycle', `Too many nested references in ${value}.`);
  if (/gradient\(|url\(|image-set\(|image\(/i.test(source)) {
    return fail('gradient-or-image', `${value} is a gradient or an image.`);
  }

  const variable = callArguments(source, 'var');
  if (variable !== null) {
    const [name, ...fallback] = splitTopLevel(variable, 'comma');
    if (name === undefined) return fail('unsupported-syntax', `${value} names no property.`);
    if (seen.includes(name)) return fail('reference-cycle', `${name} refers to itself.`);
    const target = properties[name];
    if (target === undefined) {
      if (fallback.length > 0) return evaluate(fallback.join(','), properties, options, seen);
      return fail('missing-property', `${name} has no value in this context.`);
    }
    return evaluate(target, properties, options, [...seen, name]);
  }

  const lightDark = callArguments(source, 'light-dark');
  if (lightDark !== null) {
    const arms = splitTopLevel(lightDark, 'comma');
    const arm = arms[options.theme === 'light' ? 0 : 1];
    if (arms.length !== 2 || arm === undefined) {
      return fail('unsupported-syntax', `${value} is not a two-argument light-dark().`);
    }
    return evaluate(arm, properties, options, seen);
  }

  const mix = callArguments(source, 'color-mix');
  if (mix !== null) {
    const [space, ...rest] = splitTopLevel(mix, 'comma');
    if (space?.replace(/\s+/g, ' ').toLowerCase() !== 'in oklch' || rest.length !== 2) {
      return fail('unsupported-syntax', `${value} mixes outside oklch or has not two colors.`);
    }
    const mixArguments = rest.map(mixArgument);
    const [firstArgument, secondArgument] = mixArguments;
    if (!firstArgument || !secondArgument) {
      return fail('unsupported-syntax', `${value} has a misplaced percentage.`);
    }
    const evaluated = [firstArgument, secondArgument].map((argument) =>
      evaluate(argument.color, properties, options, seen),
    );
    const [first, second] = evaluated;
    if (first === undefined || !first.ok) return first ?? fail('unsupported-syntax', value);
    if (second === undefined || !second.ok) return second ?? fail('unsupported-syntax', value);
    let firstWeight = firstArgument.percent;
    let secondWeight = secondArgument.percent;
    if (firstWeight === null && secondWeight === null) {
      firstWeight = 50;
      secondWeight = 50;
    } else if (firstWeight === null) firstWeight = 100 - (secondWeight ?? 0);
    else if (secondWeight === null) secondWeight = 100 - firstWeight;
    return {
      ok: true,
      color: mixColors(
        { color: first.color, weight: firstWeight },
        { color: second.color, weight: secondWeight ?? 0 },
      ),
    };
  }

  const oklchCall = callArguments(source, 'oklch');
  if (oklchCall !== null && /^\s*from\s/i.test(oklchCall)) {
    const tokens = splitTopLevel(oklchCall, 'space');
    const origin = tokens[1];
    const slash = tokens.indexOf('/');
    const channels = tokens.slice(2, slash === -1 ? undefined : slash);
    if (origin === undefined || channels.length !== 3) {
      return fail('unsupported-syntax', `${value} is not a three-channel relative color.`);
    }
    const base = evaluate(origin, properties, options, seen);
    if (!base.ok) return base;
    const variables: Variables = {
      l: base.color.l,
      c: base.color.c,
      h: base.color.h ?? 0,
      alpha: base.color.alpha,
    };
    const [l, c, h] = [
      channelValue(channels[0]!, variables, 'l'),
      channelValue(channels[1]!, variables, 'c'),
      channelValue(channels[2]!, variables, 'h'),
    ];
    const alphaToken = slash === -1 ? undefined : tokens[slash + 1];
    const alpha =
      alphaToken === undefined ? variables.alpha : channelValue(alphaToken, variables, 'alpha');
    if (l === null || c === null || h === null || alpha === null) {
      return fail(
        'unsupported-syntax',
        `${value} uses an expression this evaluator does not support.`,
      );
    }
    return { ok: true, color: { l, c: Math.max(0, c), h, alpha } };
  }

  if (/\bfrom\b|\bvar\(|\bcalc\(|\bcolor-mix\(|\blight-dark\(/i.test(source)) {
    return fail('unsupported-syntax', `${value} uses syntax this evaluator does not support.`);
  }
  const color = fromCulori(parse(source));
  if (color === null) return fail('unsupported-syntax', `${value} is not a supported color.`);
  return { ok: true, color };
}

/** Evaluate one CSS color value against a context's property map. */
export function evaluateCssColor(
  value: string,
  properties: Readonly<Record<string, string>>,
  options: CssColorOptions,
): CssColorResult {
  return evaluate(value, properties, options, []);
}
