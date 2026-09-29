import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type OklchColor,
  type Rgb,
  clampRgb,
  compositeOver,
  contrastRatio,
  oklchToLinearSrgb,
} from './color-contrast-utilities.ts';

const TOKENS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', 'tokens');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readJsonRecord(...pathSegments: readonly string[]): Record<string, unknown> {
  const filePath = join(...pathSegments);
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!isRecord(parsed)) {
    throw new Error(`${filePath} is not a JSON object`);
  }
  return parsed;
}

/** The registry's `cssProperty -> corpus path` map, validated at load. */
export function readCssPropertyToPath(
  registryPath = join(TOKENS_DIRECTORY, 'registry.generated.json'),
): Record<string, string> {
  const map = readJsonRecord(registryPath)['cssPropertyToPath'];
  if (typeof map !== 'object' || map === null || Array.isArray(map)) {
    throw new Error('registry.generated.json has no cssPropertyToPath object');
  }
  const entries = Object.entries(map).map(([property, path]) => {
    if (typeof path !== 'string') {
      throw new Error(`registry.generated.json has a non-string path for ${property}`);
    }
    return [property, path] as const;
  });
  return Object.fromEntries(entries);
}

export const cssPropertyToPath = readCssPropertyToPath();

const resolvedContexts = {
  light: readJsonRecord(TOKENS_DIRECTORY, 'resolved', 'light.json'),
  dark: readJsonRecord(TOKENS_DIRECTORY, 'resolved', 'dark.json'),
};

/**
 * One token's `$value` from a resolved context, or `undefined` when the context
 * does not carry that path.
 */
export function readResolvedValue(arm: 'light' | 'dark', path: string): unknown {
  const token = resolvedContexts[arm][path];
  if (token === undefined) return undefined;
  if (typeof token !== 'object' || token === null) {
    throw new Error(`resolved ${arm} entry for ${path} is not an object`);
  }
  return (token as { $value?: unknown }).$value;
}

/**
 * The DTCG color subset these tokens are authored in: `oklch` with three
 * numeric components. Hard-fails on anything else -- a token that grows an
 * alpha channel, a `none` component, or a different color space trips the gate
 * loudly rather than being silently mis-read, which is the same contract the
 * old literal parser held.
 */
export function parseResolvedColor(value: unknown, tokenName: string, arm: string): OklchColor {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${tokenName} (${arm}) has no object $value`);
  }
  const color = value as { colorSpace?: unknown; components?: unknown; alpha?: unknown };
  if (color.colorSpace !== 'oklch') {
    throw new Error(`${tokenName} (${arm}) is not oklch: ${JSON.stringify(color.colorSpace)}`);
  }
  if (color.alpha !== undefined) {
    throw new Error(`${tokenName} (${arm}) carries an alpha channel this gate does not model`);
  }
  const components = color.components;
  if (!Array.isArray(components) || components.length !== 3) {
    throw new Error(`${tokenName} (${arm}) does not have three oklch components`);
  }
  const [l, c, h] = components;
  if (typeof l !== 'number' || typeof c !== 'number' || typeof h !== 'number') {
    throw new Error(`${tokenName} (${arm}) has a non-numeric oklch component`);
  }
  return { l, c, h };
}

/**
 * The same subset, but keeping an alpha channel instead of rejecting it.
 *
 * Deliberately a SECOND reader rather than a relaxation of the first. Since
 * CIN-245 the neutral structural border tiers are translucent by design, but
 * `--cinder-status-*-border` and the rest of the palette are opaque by
 * decision -- a translucent status border would take its hue from whatever it
 * happened to sit on. `parseResolvedColor`'s alpha rejection is what enforces
 * that decision, so it stays strict and only the handful of tokens that are
 * SUPPOSED to be translucent come through here.
 */
export function parseResolvedColorWithAlpha(
  value: unknown,
  tokenName: string,
  arm: string,
): TranslucentColor {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${tokenName} (${arm}) has no object $value`);
  }
  const { alpha, ...rest } = value as { alpha?: unknown };
  const color = parseResolvedColor({ ...rest }, tokenName, arm);
  // A MISSING alpha is not the same as an opaque one. This reader exists for
  // tokens that are supposed to be translucent, so defaulting to 1 would let a
  // tier that lost its alpha channel read as opaque and quietly pass every
  // assertion below -- the drift this file exists to catch. Demand it.
  if (alpha === undefined) {
    throw new Error(
      `${tokenName} (${arm}) has no alpha channel. Read an opaque token with ` +
        '`parseResolvedColor`; this reader is for the translucent tiers.',
    );
  }
  if (typeof alpha !== 'number') {
    throw new Error(`${tokenName} (${arm}) has a non-numeric alpha: ${JSON.stringify(alpha)}`);
  }
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new Error(
      `${tokenName} (${arm}) has alpha ${alpha}, which is not a finite number in [0, 1]. ` +
        'A NaN or out-of-range alpha composites to nonsense rather than failing.',
    );
  }
  return { ...color, alpha };
}

export type TokenArms = { light: OklchColor; dark: OklchColor };
export type TranslucentColor = OklchColor & { alpha: number };
export type TranslucentTokenArms = { light: TranslucentColor; dark: TranslucentColor };

/**
 * Both theme arms of one token, by its CSS custom-property name. Throws when a
 * property has no corpus token or is absent from a resolved context, so a
 * renamed or deleted token fails here instead of quietly dropping an assertion.
 */
export function readOklchToken(tokenName: string): TokenArms {
  const path = cssPropertyToPath[tokenName];
  if (path === undefined) {
    throw new Error(`${tokenName} has no corpus token in the generated registry`);
  }
  const read = (arm: 'light' | 'dark'): OklchColor => {
    const value = readResolvedValue(arm, path);
    if (value === undefined) {
      throw new Error(`${tokenName} (${path}) is absent from the resolved ${arm} context`);
    }
    return parseResolvedColor(value, tokenName, arm);
  };
  return { light: read('light'), dark: read('dark') };
}

/** As {@link readOklchToken}, for the tokens that carry an alpha channel by design. */
export function readTranslucentToken(tokenName: string): TranslucentTokenArms {
  const path = cssPropertyToPath[tokenName];
  if (path === undefined) {
    throw new Error(`${tokenName} has no corpus token in the generated registry`);
  }
  const read = (arm: 'light' | 'dark'): TranslucentColor => {
    const value = readResolvedValue(arm, path);
    if (value === undefined) {
      throw new Error(`${tokenName} (${path}) is absent from the resolved ${arm} context`);
    }
    return parseResolvedColorWithAlpha(value, tokenName, arm);
  };
  return { light: read('light'), dark: read('dark') };
}

/**
 * The contrast ratio between a translucent color painted over `ground` and
 * `ground` itself -- what a reader actually sees at a border/surface seam.
 */
export function translucentContrastOn(ink: TranslucentColor, ground: OklchColor): number {
  const groundRgb = clampRgb(oklchToLinearSrgb(ground.l, ground.c, ground.h));
  const painted = compositeOver(
    clampRgb(oklchToLinearSrgb(ink.l, ink.c, ink.h)),
    groundRgb,
    ink.alpha,
  );
  const luminance = (rgb: Rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return contrastRatio(luminance(painted), luminance(groundRgb));
}

/**
 * A number token's resolved value, e.g. `--cinder-opacity-disabled` -> 0.55.
 * Opacities participate in the contrast math (a muted foreground is composited
 * against its background), so they come from resolved output like the colors.
 */
export function readNumberToken(tokenName: string): number {
  const path = cssPropertyToPath[tokenName];
  if (path === undefined) {
    throw new Error(`${tokenName} has no corpus token in the generated registry`);
  }
  const value = readResolvedValue('light', path);
  if (typeof value !== 'number') {
    throw new Error(`${tokenName} is not a number token: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * The generated stylesheet, read ONLY for the handful of assertions that are
 * about CSS shape rather than about a color value: that one token is emitted as
 * a literal `var(--other)` alias rather than a duplicated value, and that
 * `--cinder-type-tab-size` is declared at all.
 *
 * Those cannot move to resolved output, and should not: resolution follows an
 * alias to the value it points at, which is exactly what these assertions exist
 * to distinguish. Every assertion about a color VALUE reads resolved output;
 * only assertions about the emitted CSS text read the CSS.
 */
/**
 * The full value of one custom property from the comment-stripped stylesheet,
 * balancing parentheses so a multiline value is captured whole. Throws when the
 * token is absent -- a silent miss would drop an assertion.
 */
export function readTokenValue(source: string, tokenName: string): string {
  const [first] = readAllTokenValues(source, tokenName);
  if (first === undefined) throw new Error(`token ${tokenName} not found in tokens-base.css`);
  return first;
}

/**
 * EVERY declaration of `tokenName`, in source order: the `:root` one first,
 * then each `[data-theme]` override block.
 *
 * `readTokenValue` returns only the first, which is the `:root` value. For an
 * assertion about a token's SHAPE that is not enough -- the theme blocks
 * redeclare the same tokens with their own `cssRecipe`, so a recipe that
 * drifted from its `$value` in one arm would pass a check that only ever read
 * `:root`. The contrast assertions measure resolved artifacts, and the browser
 * probe only proves a value parses, so nothing else would catch it either.
 */
export function readAllTokenValues(source: string, tokenName: string): string[] {
  const marker = `${tokenName}:`;
  const values: string[] = [];
  let searchFrom = 0;
  for (;;) {
    const start = source.indexOf(marker, searchFrom);
    if (start === -1) break;
    // `--cinder-border:` must not match inside `--cinder-border-muted:`; the
    // marker already ends in `:`, so only a preceding partial name can alias.
    const previous = source[start - 1] ?? '';
    if (/[A-Za-z0-9-]/.test(previous)) {
      searchFrom = start + marker.length;
      continue;
    }
    let depth = 0;
    let value = '';
    let index = start + marker.length;
    for (; index < source.length; index += 1) {
      const character = source[index];
      if (character === '(') depth += 1;
      else if (character === ')') depth -= 1;
      else if (character === ';' && depth === 0) break;
      value += character;
    }
    if (index >= source.length) {
      throw new Error(`token ${tokenName} value never terminated (unbalanced parens?)`);
    }
    values.push(value.trim().replace(/\s+/g, ' '));
    searchFrom = index;
  }
  return values;
}

/**
 * Resolve a relative-color derivation of the shape
 * `oklch(from var(--cinder-accent-solid) calc(l - X) c h)` against a parsed base color.
 * Retained because several assertions derive a value that has no token of its
 * own -- a hover state computed in a component rule rather than declared in the
 * corpus. Tokens that DO exist are read directly.
 */
export function deriveFromAccent(base: OklchColor, lDelta: number): OklchColor {
  return { l: base.l + lDelta, c: base.c, h: base.h };
}
