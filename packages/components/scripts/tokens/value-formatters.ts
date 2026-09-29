import { isPlainObject } from './corpus.ts';
import type { ValueResolver } from './resolve.ts';
import type { TokenType } from './types.ts';

export type DimensionOrDuration = { value: number; unit: string };
export type ColorValue = {
  colorSpace: string;
  components: Array<number | 'none'>;
  alpha?: number | 'none';
  hex?: string;
};
export type ShadowLayer = {
  color: ColorValue;
  offsetX: DimensionOrDuration;
  offsetY: DimensionOrDuration;
  blur: DimensionOrDuration;
  spread: DimensionOrDuration;
  inset?: boolean;
};

/** Matches both DTCG alias syntaxes: curly-brace (`{a.b.c}`) and JSON Pointer (`#/a/b/c`), the same two forms `validate.ts`'s `isReference` accepts and `resolve.ts` resolves. */
export function isAliasReference(value: unknown): value is string {
  return typeof value === 'string' && (/^\{[^{}]+\}$/.test(value) || value.startsWith('#/'));
}

// Runtime type guards narrow `unknown` `$value` payloads to their expected
// shape, matching validate.ts's own idiom -- ajv and validate-corpus.ts
// already checked the full corpus upstream, so these are a defensive second
// check plus the mechanism TypeScript needs to narrow safely, without a bare
// `as` type assertion on data that starts life as `unknown`.

function isDimensionOrDuration(value: unknown): value is DimensionOrDuration {
  return (
    isPlainObject(value) && typeof value['value'] === 'number' && typeof value['unit'] === 'string'
  );
}

function isNumberValue(value: unknown): value is number {
  return typeof value === 'number';
}

function isCubicBezierValue(value: unknown): value is readonly [number, number, number, number] {
  return (
    Array.isArray(value) && value.length === 4 && value.every((entry) => typeof entry === 'number')
  );
}

function isFontFamilyValue(value: unknown): value is string[] | string {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
  );
}

function isColorComponent(value: unknown): value is number | 'none' {
  return typeof value === 'number' || value === 'none';
}

function isColorValue(value: unknown): value is ColorValue {
  if (!isPlainObject(value)) return false;
  if (typeof value['colorSpace'] !== 'string') return false;
  const components = value['components'];
  if (!Array.isArray(components) || components.length !== 3 || !components.every(isColorComponent))
    return false;
  if (value['alpha'] !== undefined && !isColorComponent(value['alpha'])) return false;
  if (value['hex'] !== undefined && typeof value['hex'] !== 'string') return false;
  return true;
}

function isShadowLayerArray(value: unknown): value is readonly ShadowLayer[] {
  return (
    Array.isArray(value) &&
    value.every(
      (layer) =>
        isPlainObject(layer) &&
        isColorValue(layer['color']) &&
        isDimensionOrDuration(layer['offsetX']) &&
        isDimensionOrDuration(layer['offsetY']) &&
        isDimensionOrDuration(layer['blur']) &&
        isDimensionOrDuration(layer['spread']) &&
        (layer['inset'] === undefined || typeof layer['inset'] === 'boolean'),
    )
  );
}

/** `validate.ts` accepts a shadow `$value` as either a single layer object or an array of layers (DTCG allows both); normalize the single-object form to a one-element array before shape-checking so the generator accepts everything the validator does. */
function normalizeShadowValue(value: unknown): unknown {
  return isPlainObject(value) ? [value] : value;
}

/**
 * DTCG named font weights per the format module's fontWeight value schema
 * ("Represents a font weight as per the OpenType wght tag specification"),
 * mapped to the OpenType usWeightClass numbers the names stand for. CSS
 * `font-weight` has no keyword for most of these (only `normal`/`bold` are
 * CSS keywords, and they don't cover the other eight) but accepts any number
 * in [1, 1000], so every name -- including `normal`/`bold` -- is translated
 * to its number uniformly rather than passing a subset through as keywords.
 */
const DTCG_NAMED_FONT_WEIGHTS: Readonly<Record<string, number>> = {
  thin: 100,
  'extra-light': 200,
  light: 300,
  normal: 400,
  medium: 500,
  'semi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  black: 900,
  'extra-black': 950,
};

function isFontWeightValue(value: unknown): value is number | string {
  return isNumberValue(value) || (typeof value === 'string' && value in DTCG_NAMED_FONT_WEIGHTS);
}

function formatFontWeight(value: number | string): string {
  return formatNumber(typeof value === 'number' ? value : DTCG_NAMED_FONT_WEIGHTS[value]!);
}

/** Precision-safe number-to-string: plain `String()` round-trips every literal in this corpus (verified), EXCEPT results of real arithmetic (the oklch lightness-to-percentage conversion), which route through {@link roundForDisplay} first. */
function formatNumber(value: number): string {
  if (Object.is(value, -0)) return '0';
  return String(value);
}

/** Clears floating-point noise from a computed value (e.g. `0.994 * 100 === 99.39999999999999`) without touching values that were never computed. */
function roundForDisplay(value: number): number {
  return Number(value.toFixed(10));
}

function formatComponent(component: number | 'none'): string {
  return component === 'none' ? 'none' : formatNumber(component);
}

function formatOklchLightness(component: number | 'none'): string {
  if (component === 'none') return 'none';
  return `${formatNumber(roundForDisplay(component * 100))}%`;
}

/** Collapses a 6-digit hex literal to 3-digit shorthand when every channel pair is a doubled digit (`#ffffff` -> `#fff`), matching the shorthand already authored in tokens-base.css for the two checkerboard tokens. */
function collapseHex(hex: string): string {
  const normalized = hex.toLowerCase();
  const match = /^#([0-9a-f]{6})$/.exec(normalized);
  if (!match) return normalized;
  const digits = match[1]!;
  const [r1, r2, g1, g2, b1, b2] = digits;
  if (r1 === r2 && g1 === g2 && b1 === b2) return `#${r1}${g1}${b1}`;
  return normalized;
}

function formatColor(value: ColorValue): string {
  // A fully-transparent color is the `transparent` keyword regardless of its
  // base channels -- matches `--cinder-border-inverse`'s light-arm literal.
  if (typeof value.alpha === 'number' && value.alpha === 0) return 'transparent';

  // `hex` is optional metadata on `srgb` values; the `components` are the
  // source of truth EXCEPT here, where the current file's own literal is a
  // hex value (the two checkerboard tokens) -- so hex presence signals
  // "serialize as hex", not "here is a redundant fallback to ignore". A
  // 6-digit hex has no alpha channel, so it may only stand in for the color
  // when the value is fully opaque (no alpha, or alpha === 1); otherwise the
  // hex would silently discard the alpha, so fall through to the
  // component-based `color()` form below, which carries it explicitly.
  const isOpaque = value.alpha === undefined || value.alpha === 1;
  if (value.colorSpace === 'srgb' && typeof value.hex === 'string' && isOpaque) {
    return collapseHex(value.hex);
  }

  if (value.colorSpace === 'oklch') return formatOklch(value);
  if (value.colorSpace === 'srgb') return formatSrgb(value);

  throw new Error(
    `No direct CSS serialization implemented for color colorSpace "${value.colorSpace}". ` +
      'Every color in the corpus today is oklch (optionally with hex metadata) or fully ' +
      'transparent; extend formatColor before adding a new color space.',
  );
}

function formatOklch(value: ColorValue): string {
  const [lightness, chroma, hue] = value.components;
  if (lightness === undefined || chroma === undefined || hue === undefined)
    throw new Error(`oklch color value is missing a component: ${JSON.stringify(value)}`);
  const alpha = value.alpha === undefined ? '' : ` / ${formatComponent(value.alpha)}`;
  return `oklch(${formatOklchLightness(lightness)} ${formatComponent(chroma)} ${formatComponent(hue)}${alpha})`;
}

function formatSrgb(value: ColorValue): string {
  const [red, green, blue] = value.components;
  if (red === undefined || green === undefined || blue === undefined)
    throw new Error(`srgb color value is missing a component: ${JSON.stringify(value)}`);
  const alpha = value.alpha === undefined ? '' : ` / ${formatComponent(value.alpha)}`;
  return `color(srgb ${formatComponent(red)} ${formatComponent(green)} ${formatComponent(blue)}${alpha})`;
}

/**
 * `<length>` values (dimensions) may drop their unit only when the value is
 * exactly zero -- that's why `--cinder-space-0` and every shadow's
 * zero-valued `offsetX` are authored as bare `0`, not `0px`/`0rem`.
 */
function formatDimension(value: DimensionOrDuration): string {
  if (value.value === 0) return '0';
  return `${formatNumber(value.value)}${value.unit}`;
}

/**
 * `<time>` values (durations) always require a unit in CSS, even at zero --
 * `transition-duration: 0` is invalid. `--cinder-duration-instant` and every
 * reduced-motion override stay `0ms`, never bare `0`.
 */
function formatDuration(value: DimensionOrDuration): string {
  return `${formatNumber(value.value)}${value.unit}`;
}

function formatCubicBezier(value: readonly number[]): string {
  return `cubic-bezier(${value.map(formatNumber).join(', ')})`;
}

/** CSS Fonts Module generic-family keywords, which must stay bare (unquoted) even though they'd otherwise look like ordinary custom-idents -- quoting one of these turns it into a font named e.g. "sans-serif" instead of the generic fallback. */
const GENERIC_FONT_FAMILY_KEYWORDS = new Set([
  'serif',
  'sans-serif',
  'cursive',
  'fantasy',
  'monospace',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
]);

/** A conservative single-token CSS `<custom-ident>`: letters/digits/`-`/`_`, not digit-led. Every non-generic name in the corpus today (`-apple-system`, `SFMono-Regular`, `BlinkMacSystemFont`, `Roboto`, `Menlo`, `Consolas`) matches this and stays bare; anything that doesn't -- a space (`Segoe UI`), a comma (`ACME, Inc`), an apostrophe, a leading digit -- is not a valid bare identifier and must be quoted as a CSS string instead, per the `family-name = <custom-ident>+ | <string>` grammar. */
const SAFE_UNQUOTED_FONT_FAMILY_NAME = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * CSS-wide keywords (CSS Values and Units § 3.2), checked case-insensitively. Each one is
 * syntactically a valid bare `<custom-ident>` -- `inherit` matches
 * {@link SAFE_UNQUOTED_FONT_FAMILY_NAME} just as cleanly as `Roboto` does -- but emitted bare in
 * a `font-family` declaration it triggers cascade behavior (`inherit`, `initial`, `unset`,
 * `revert`, `revert-layer`) instead of naming a font with that literal name, silently changing
 * what the declaration means. Quoting forces the string interpretation.
 */
const CSS_WIDE_KEYWORDS = new Set(['inherit', 'initial', 'revert', 'revert-layer', 'unset']);

function escapeFontFamilyString(name: string): string {
  return name.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function formatFontFamilyName(name: string): string {
  if (GENERIC_FONT_FAMILY_KEYWORDS.has(name)) return name;
  if (CSS_WIDE_KEYWORDS.has(name.toLowerCase())) return `'${escapeFontFamilyString(name)}'`;
  if (SAFE_UNQUOTED_FONT_FAMILY_NAME.test(name)) return name;
  return `'${escapeFontFamilyString(name)}'`;
}

function formatFontFamily(value: string[] | string): string {
  const names = Array.isArray(value) ? value : [value];
  return names.map(formatFontFamilyName).join(', ');
}

function formatShadow(layers: readonly ShadowLayer[]): string {
  return layers
    .map((layer) => {
      const parts = [
        layer.inset ? 'inset' : undefined,
        formatDimension(layer.offsetX),
        formatDimension(layer.offsetY),
        formatDimension(layer.blur),
        // Spread is omitted (3-value shadow form) when it is exactly zero,
        // matching the authored style throughout tokens-base.css.
        layer.spread.value !== 0 ? formatDimension(layer.spread) : undefined,
        formatColor(layer.color),
      ];
      return parts.filter((part): part is string => part !== undefined).join(' ');
    })
    .join(', ');
}

/**
 * `validate.ts` permits a reference (`{a.b.c}` or `#/a/b/c`) at any composite leaf position --
 * a shadow layer's `color`, a color's individual `components`/`alpha`, a border's `width`, and
 * so on -- alongside the whole-value alias `serializeEntryValue` already handles before this
 * function is ever called. `resolveReferences` (identity by default, so existing callers that
 * pass literal, already-resolved values are unaffected) resolves every such reference, at any
 * depth, to its literal value before shape-checking and formatting proceed.
 */
export function serializeTypedValue(
  type: TokenType,
  value: unknown,
  path: string,
  resolveReferences: ValueResolver = (raw) => raw,
): string {
  const resolvedValue = resolveReferences(value);
  const serializer = typedSerializers[type];
  if (serializer === undefined) {
    throw new Error(
      `No direct CSS serialization implemented for token type "${type}" at "${path}". ` +
        'Add a cssRecipe extension in the corpus, or extend serializeTypedValue.',
    );
  }
  return serializer(resolvedValue, path);
}

type TypedSerializer = (value: unknown, path: string) => string;

function invalid(path: string, type: string, expected: string): never {
  throw new Error(
    `Token at "${path}" has $type "${type}" but its $value is not a valid ${expected}.`,
  );
}

const typedSerializers: Record<string, TypedSerializer> = {
  dimension: (value, path) =>
    isDimensionOrDuration(value)
      ? formatDimension(value)
      : invalid(path, 'dimension', '{value, unit} dimension'),
  duration: (value, path) =>
    isDimensionOrDuration(value)
      ? formatDuration(value)
      : invalid(path, 'duration', '{value, unit} duration'),
  number: (value, path) =>
    isNumberValue(value) ? formatNumber(value) : invalid(path, 'number', 'number'),
  fontWeight: (value, path) =>
    isFontWeightValue(value)
      ? formatFontWeight(value)
      : invalid(path, 'fontWeight', 'number in [1, 1000] or named DTCG font weight'),
  cubicBezier: (value, path) =>
    isCubicBezierValue(value)
      ? formatCubicBezier(value)
      : invalid(path, 'cubicBezier', 'four-number cubic-bezier'),
  fontFamily: (value, path) =>
    isFontFamilyValue(value)
      ? formatFontFamily(value)
      : invalid(path, 'fontFamily', 'string | string[] font family'),
  color: (value, path) =>
    isColorValue(value) ? formatColor(value) : invalid(path, 'color', 'color'),
  shadow: (value, path) => {
    const normalized = normalizeShadowValue(value);
    return isShadowLayerArray(normalized)
      ? formatShadow(normalized)
      : invalid(path, 'shadow', 'shadow layer object or array');
  },
};

/**
 * The `baseIndex` key a whole-token JSON Pointer alias names, beyond
 * `tokenPathFromReference`'s plain dot-join.
 *
 * A property-FORM pointer whose last segment is literally `$value` (e.g.
 * `#/dimension/hairline/$value`) names the referenced token's WHOLE value --
 * resolve.ts's own `resolveReference` special-cases a trailing `$value`
 * segment the same way (see resolve.test.ts's "resolves a property-level
 * JSON Pointer reference" case, which targets a whole dimension token via
 * `#/dimension/hairline/$value`). `tokenPathFromReference` has no such
 * special case -- it just dot-joins every segment -- so without stripping it
 * here, the exact-match `baseIndex` lookup misses the token entirely even
 * though `tokens:validate` accepts the identical reference. Gated on `#/`
 * (pointer syntax): a curly alias `{a.b.$value}` is a literal dotted path
 * through the corpus, not resolve.ts's pointer special case, so stripping it
 * there would just as wrongly make the generator and the validator disagree
 * the other way.
 *
 * A `$root` segment is a REDIRECT to the group's own root token, which
 * `collectEntries` indexes at the group's own path (`prefix`), not
 * `prefix.$root` -- the same redirect resolve.ts's `refTargetIndexPath`
 * applies for type inference. `#/group/$root` and `#/group/$root/$value`
 * both name the root token's whole identity and must strip to `group`;
 * `#/$root`/`#/$root/$value` strip to the document root's own path (`''`).
 */
