/**
 * Generates `src/styles/tokens-base.css` and the resolved-context JSON files
 * under `src/tokens/resolved/` from the DTCG token corpus at
 * `src/tokens/`.
 *
 * ARCHITECTURE NOTE: this generator reads the corpus SOURCE documents (the
 * `sets/`, `themes/`, and `modes/` token files), not resolved output. To emit
 * a `[data-theme='dark']` block we need to know WHICH tokens that theme
 * overrides -- resolved output is a flat merged map where an inherited token
 * and an overridden token look identical, so it cannot answer that question.
 * The theme document itself is the list of what to emit in that block, and
 * the same is true of the `reduced` and `forced-reduced-motion` motion
 * contexts, each of which backs its own selector (the `prefers-reduced-motion`
 * media block and the `data-reduced-motion='on'` override, respectively).
 * Reading source documents also
 * sidesteps a known limitation of `resolve.ts`'s `mergeGroup`: it replaces a
 * colliding token wholesale, which drops `$description` and `$extensions`
 * (including `cssProperty`) for overridden tokens in fully-resolved output.
 * `resolve.ts` is still used for exactly one thing here: standing up the
 * resolved-context JSON files (see {@link buildResolvedContexts}), which are
 * a deliberately flat, fully-resolved view and do not feed CSS generation.
 *
 * VALUE EMISSION RULE: the generator does no independent unit selection or
 * precision rounding. If a token's `cssRecipe` extension is a non-null
 * string, it is emitted verbatim. Otherwise the typed `$value` is serialized
 * with straightforward, non-lossy formatting -- the few conversions below
 * (dimension/duration units, oklch lightness-to-percentage, hex shorthand,
 * font-family quoting) are required CSS syntax, not formatting choices. If a
 * serialized value would ever disagree with the current file with no
 * `cssRecipe` explaining why, the fix is correcting the corpus value, not
 * adding generator formatting logic.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';
import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import postcssPlugin from 'prettier/plugins/postcss';

import { loadResolverDocument, loadTokenDocuments, tokenRoot } from './load.ts';
import {
  createValueResolver,
  mergeAndExpandExtends,
  resolveDocuments,
  tokenPathFromReference,
  type ValueResolver,
} from './resolve.ts';
import type {
  DesignToken,
  ResolverDocument,
  ResolverReference,
  TokenDocument,
  TokenGroup,
  TokenType,
} from './types.ts';
import { normalizeSourcePath, parseResolutionOrder, sourcesForEntry } from './validate-corpus.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDirectory, '..', '..');
export const tokensBaseCssPath = join(packageRoot, 'src', 'styles', 'tokens-base.css');
export const resolvedDirectory = join(tokenRoot, 'resolved');

const REGENERATE_COMMAND = 'bun run --filter=@lostgradient/cinder tokens:generate';

/**
 * Prettier is used here in a way that has to survive two different builds of it.
 *
 * The full test suite runs under `--conditions browser --conditions svelte`, and
 * that resolves `prettier` to `standalone.mjs` — which has no `resolveConfig`
 * (a Node-only filesystem API) and, more importantly, ships no parsers at all.
 * Relying on either would pass in isolation and fail in the suite. So the config
 * that shapes this file's output is mirrored from `.prettierrc.json` explicitly,
 * and the parser plugins are imported and passed explicitly, which works
 * identically under both builds.
 */
const PRETTIER_OPTIONS = {
  singleQuote: true,
  tabWidth: 2,
  printWidth: 100,
  endOfLine: 'lf',
} as const;

/** The `json` parser lives in the babel plugin; `estree` supplies its printer. */
const JSON_PLUGINS = [babelPlugin, estreePlugin];
const CSS_PLUGINS = [postcssPlugin];

// ---------------------------------------------------------------------------
// Corpus tree walking. Collects every `$value`-bearing node in a merged
// document into a flat `path -> entry` map, preserving RAW (unresolved)
// values -- alias references stay as `{a.b.c}` strings rather than being
// resolved to a literal, since a raw alias tells us to emit `var(...)`
// against the referenced token's OWN `cssProperty`, matching how
// tokens-base.css is hand-authored today. This mirrors resolve.ts's
// `collectTokens` (group `$root` handling, `$type` inheritance through
// nested groups) but deliberately stops short of alias resolution.
// ---------------------------------------------------------------------------

export type CorpusEntry = {
  path: string;
  value: unknown;
  type: TokenType | undefined;
  description: string | undefined;
  cssProperty: string | undefined;
  cssRecipe: string | undefined;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToken(value: unknown): value is DesignToken {
  return isPlainObject(value) && '$value' in value;
}

function isTokenGroup(value: unknown): value is TokenGroup {
  return isPlainObject(value) && !isToken(value);
}

function cinderExtensions(token: DesignToken): Record<string, unknown> | undefined {
  const extensions = token.$extensions;
  if (!isPlainObject(extensions)) return undefined;
  const own = extensions['com.lostgradient.cinder'];
  return isPlainObject(own) ? own : undefined;
}

function toEntry(
  path: string,
  token: DesignToken,
  inheritedType: TokenType | undefined,
): CorpusEntry {
  const extensions = cinderExtensions(token);
  const cssProperty =
    typeof extensions?.['cssProperty'] === 'string' ? extensions['cssProperty'] : undefined;
  const cssRecipe =
    typeof extensions?.['cssRecipe'] === 'string' ? extensions['cssRecipe'] : undefined;
  return {
    path,
    value: token.$value,
    type: token.$type ?? inheritedType,
    description: token.$description,
    cssProperty,
    cssRecipe,
  };
}

function collectEntries(
  group: TokenGroup,
  prefix: string,
  inheritedType: TokenType | undefined,
  into: Map<string, CorpusEntry>,
): void {
  const groupType = group.$type ?? inheritedType;
  if (isToken(group.$root)) into.set(prefix, toEntry(prefix, group.$root, groupType));
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isPlainObject(value)) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (isToken(value)) into.set(path, toEntry(path, value, groupType));
    else if (isTokenGroup(value)) collectEntries(value, path, groupType, into);
  }
}

// ---------------------------------------------------------------------------
// Value serialization.
// ---------------------------------------------------------------------------

type DimensionOrDuration = { value: number; unit: string };
type ColorValue = {
  colorSpace: string;
  components: Array<number | 'none'>;
  alpha?: number | 'none';
  hex?: string;
};
type ShadowLayer = {
  color: ColorValue;
  offsetX: DimensionOrDuration;
  offsetY: DimensionOrDuration;
  blur: DimensionOrDuration;
  spread: DimensionOrDuration;
  inset?: boolean;
};

/** Matches both DTCG alias syntaxes: curly-brace (`{a.b.c}`) and JSON Pointer (`#/a/b/c`), the same two forms `validate.ts`'s `isReference` accepts and `resolve.ts` resolves. */
function isAliasReference(value: unknown): value is string {
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

  if (value.colorSpace === 'oklch') {
    const [lightness, chroma, hue] = value.components;
    if (lightness === undefined || chroma === undefined || hue === undefined) {
      throw new Error(`oklch color value is missing a component: ${JSON.stringify(value)}`);
    }
    const alpha = value.alpha !== undefined ? ` / ${formatComponent(value.alpha)}` : '';
    return `oklch(${formatOklchLightness(lightness)} ${formatComponent(chroma)} ${formatComponent(hue)}${alpha})`;
  }

  if (value.colorSpace === 'srgb') {
    const [red, green, blue] = value.components;
    if (red === undefined || green === undefined || blue === undefined) {
      throw new Error(`srgb color value is missing a component: ${JSON.stringify(value)}`);
    }
    const alpha = value.alpha !== undefined ? ` / ${formatComponent(value.alpha)}` : '';
    return `color(srgb ${formatComponent(red)} ${formatComponent(green)} ${formatComponent(blue)}${alpha})`;
  }

  throw new Error(
    `No direct CSS serialization implemented for color colorSpace "${value.colorSpace}". ` +
      'Every color in the corpus today is oklch (optionally with hex metadata) or fully ' +
      'transparent; extend formatColor before adding a new color space.',
  );
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
  const malformed = (expected: string): never => {
    throw new Error(
      `Token at "${path}" has $type "${type}" but its $value is not a valid ${expected}.`,
    );
  };

  switch (type) {
    case 'dimension':
      return isDimensionOrDuration(resolvedValue)
        ? formatDimension(resolvedValue)
        : malformed('{value, unit} dimension');
    case 'duration':
      return isDimensionOrDuration(resolvedValue)
        ? formatDuration(resolvedValue)
        : malformed('{value, unit} duration');
    case 'number':
      return isNumberValue(resolvedValue) ? formatNumber(resolvedValue) : malformed('number');
    case 'fontWeight':
      return isFontWeightValue(resolvedValue)
        ? formatFontWeight(resolvedValue)
        : malformed('number in [1, 1000] or named DTCG font weight');
    case 'cubicBezier':
      return isCubicBezierValue(resolvedValue)
        ? formatCubicBezier(resolvedValue)
        : malformed('four-number cubic-bezier');
    case 'fontFamily':
      return isFontFamilyValue(resolvedValue)
        ? formatFontFamily(resolvedValue)
        : malformed('string | string[] font family');
    case 'color':
      return isColorValue(resolvedValue) ? formatColor(resolvedValue) : malformed('color');
    case 'shadow': {
      const normalizedShadow = normalizeShadowValue(resolvedValue);
      return isShadowLayerArray(normalizedShadow)
        ? formatShadow(normalizedShadow)
        : malformed('shadow layer object or array');
    }
    default:
      throw new Error(
        `No direct CSS serialization implemented for token type "${type}" at "${path}". ` +
          'Add a cssRecipe extension in the corpus, or extend serializeTypedValue.',
      );
  }
}

export function resolveAlias(reference: string, baseIndex: Map<string, CorpusEntry>): string {
  // `tokenPathFromReference` (reused from resolve.ts, the resolver's own
  // reference parser) handles both curly-brace and `#/` JSON Pointer syntax,
  // including percent- and tilde-decoding for the latter -- reusing it here
  // keeps this the single place that turns a reference string into a dotted
  // token path, matching how the corpus is actually resolved.
  let path = tokenPathFromReference(reference);
  // A property-FORM JSON Pointer whose last segment is literally `$value` (e.g.
  // `#/dimension/hairline/$value`) names the referenced token's WHOLE value -- resolve.ts's own
  // `resolveReference` special-cases a trailing `$value` segment the same way (see
  // resolve.test.ts's "resolves a property-level JSON Pointer reference" case, which targets a
  // whole dimension token via `#/dimension/hairline/$value`). `tokenPathFromReference` has no
  // such special case -- it just dot-joins every segment -- so without stripping it here, the
  // exact-match `baseIndex` lookup below misses the token entirely and this throws, even though
  // `tokens:validate` accepts the identical reference. Gated on `#/` (pointer syntax): a curly
  // alias `{a.b.$value}` is a literal dotted path through the corpus, not resolve.ts's pointer
  // special case, so stripping it there would just as wrongly make the generator and the
  // validator disagree the other way. Any OTHER terminal property segment (a composite member
  // such as `/width`) names a PIECE of the token's value, not the whole token -- resolveAlias
  // only knows how to emit `var(--property)` for a whole-token identity, so those are left to
  // fail the lookup below with today's existing, clear error rather than being silently (and
  // wrongly) treated as a whole-token alias.
  if (reference.startsWith('#/') && path.endsWith('.$value')) {
    path = path.slice(0, -'.$value'.length);
  }
  const target = baseIndex.get(path);
  if (!target?.cssProperty) {
    throw new Error(
      `Alias reference "${reference}" does not resolve to a base token with a cssProperty ` +
        `(looked up path "${path}").`,
    );
  }
  return `var(${target.cssProperty})`;
}

/** cssRecipe (verbatim) > alias reference (`var(--referenced-property)`) > typed `$value` serialization. Applies identically to base `:root` tokens and theme/motion override tokens. */
export function serializeEntryValue(
  entry: CorpusEntry,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver = (raw) => raw,
): string {
  if (typeof entry.cssRecipe === 'string') return entry.cssRecipe;
  if (isAliasReference(entry.value)) return resolveAlias(entry.value, baseIndex);
  if (entry.type === undefined) {
    throw new Error(`Token at "${entry.path}" has no $type and no cssRecipe; cannot serialize.`);
  }
  return serializeTypedValue(entry.type, entry.value, entry.path, resolveReferences);
}

/**
 * Mirrors `.stylelintrc.json`'s `declaration-property-value-disallowed-list`
 * pattern for `color-mix()` mixing a status color directly: a declaration
 * whose serialized value matches this needs a `stylelint-disable-next-line`
 * immediately above it, or stylelint fails on the eight canonical
 * `--cinder-color-{info,success,warning,danger}-{muted,subtle}` formulas
 * (each of which legitimately recreates this shape as the shared,
 * polarity-aware status-mixing contract) wherever they appear -- the base
 * `:root` recipe and both theme overrides.
 */
const STYLELINT_STATUS_COLOR_MIX_PATTERN =
  /color-mix\([\s\S]*?var\(\s*--cinder-(?:info|success|warning|danger)\s*(?:[,)])/;

function stylelintDisableCommentFor(value: string): string | undefined {
  if (!STYLELINT_STATUS_COLOR_MIX_PATTERN.test(value)) return undefined;
  return (
    '/* stylelint-disable-next-line declaration-property-value-disallowed-list -- ' +
    'canonical status-mixing formula, the intentional shared contract; component CSS ' +
    'must still use the named tier instead of recreating it. */'
  );
}

function sanitizeComment(description: string): string {
  return description.replaceAll('*/', '*\\/').replaceAll(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// tokens-base.css assembly.
// ---------------------------------------------------------------------------

/**
 * `documentsByPath` is keyed by the normalized relative path `loadTokenDocuments`
 * reports (see `load.ts`'s `Glob` scan), but a resolver `$ref` is a URI reference
 * that may spell the same file differently (`./sets/x.tokens.json`, a percent-escaped
 * path). `normalizeSourcePath` -- reused from `validate-corpus.ts`, which faces the
 * identical lookup and already normalizes before comparing -- collapses both to the
 * same key, so a schema-valid ref that validation accepts also resolves here.
 */
export function requireDocument(
  documentsByPath: Map<string, TokenDocument>,
  ref: string,
): TokenDocument {
  const normalizedRef = normalizeSourcePath(ref);
  const document = documentsByPath.get(normalizedRef);
  if (!document) {
    throw new Error(`Resolver references "${ref}" but no loaded token document has that path.`);
  }
  return document;
}

function refsFor(
  documentsByPath: Map<string, TokenDocument>,
  refs: readonly ResolverReference[],
): TokenDocument[] {
  return refs.map((ref) => requireDocument(documentsByPath, ref.$ref));
}

function renderBaseDeclarations(
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver,
): string {
  const lines: string[] = [];
  for (const entry of baseIndex.values()) {
    if (!entry.cssProperty) {
      throw new Error(`Base corpus token at "${entry.path}" has no cssProperty extension.`);
    }
    if (entry.description) lines.push(`/* ${sanitizeComment(entry.description)} */`);
    const value = serializeEntryValue(entry, baseIndex, resolveReferences);
    const stylelintDisable = stylelintDisableCommentFor(value);
    if (stylelintDisable) lines.push(stylelintDisable);
    lines.push(`${entry.cssProperty}: ${value};`);
  }
  return lines.join('\n');
}

function renderOverrideDeclarations(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver,
): string {
  const lines: string[] = [];
  for (const [path, entry] of overrides) {
    const base = baseIndex.get(path);
    if (!base?.cssProperty) {
      throw new Error(`Override token at "${path}" has no matching base token with a cssProperty.`);
    }
    const value = serializeEntryValue(entry, baseIndex, resolveReferences);
    const stylelintDisable = stylelintDisableCommentFor(value);
    if (stylelintDisable) lines.push(stylelintDisable);
    lines.push(`${base.cssProperty}: ${value};`);
  }
  return lines.join('\n');
}

/**
 * Two tokens mapping to one `cssProperty` with DIFFERENT values is not something
 * `tokens:validate` can catch -- the mapping lives in vendor extension data, which
 * the DTCG schema treats as free-form. Left undetected, both declarations are
 * emitted, CSS silently keeps whichever lands last, and the resolved snapshots go
 * on exposing both token paths, so `tokens:check` approves two artifacts that
 * disagree about the same custom property.
 *
 * Sharing a `cssProperty` is only a conflict when the values differ. `$extends`
 * inheritance legitimately produces two paths for one property -- the extending
 * group inherits members verbatim, extension metadata included -- and those emit
 * an identical declaration twice, which is redundant but harmless.
 */
export function assertUniqueCssProperties(entries: Map<string, CorpusEntry>): void {
  const byProperty = new Map<string, Map<string, string[]>>();
  for (const [path, entry] of entries) {
    if (!entry.cssProperty) continue;
    const emitted = JSON.stringify({ value: entry.value, cssRecipe: entry.cssRecipe });
    const paths = byProperty.get(entry.cssProperty) ?? new Map<string, string[]>();
    paths.set(emitted, [...(paths.get(emitted) ?? []), path]);
    byProperty.set(entry.cssProperty, paths);
  }
  const conflicts = [...byProperty.entries()].filter(([, byValue]) => byValue.size > 1);
  if (conflicts.length === 0) return;
  const detail = conflicts
    .map(
      ([property, byValue]) =>
        `${property} is claimed with conflicting values by ${[...byValue.values()].flat().sort().join(', ')}`,
    )
    .join('; ');
  throw new Error(`Conflicting cssProperty mappings in the token corpus: ${detail}`);
}

export async function buildTokensBaseCss(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Promise<string> {
  // Every set the resolver orders, not just `foundation`. Naming one set here would
  // silently drop a second set's tokens from `:root` while the resolved snapshots --
  // which walk `resolutionOrder` -- still exposed them, and an override targeting one
  // would fail for want of a `baseIndex` entry.
  const baseDocuments = parseResolutionOrder(resolver)
    .filter((entry) => entry.kind === 'sets')
    .flatMap((entry) => refsFor(documentsByPath, sourcesForEntry(resolver, entry, {})));
  // `mergeAndExpandExtends` (rather than a bare merge) applies `$extends` group inheritance --
  // a locally overridden member that relies on the extended group's `$type`, and a member the
  // extending group never redefines at all -- before the raw tree is walked below. Reused from
  // resolve.ts's `buildTokenIndex` so this structural walk and `createValueResolver`'s alias
  // resolution (built from these same `baseDocuments` just below) agree on what `$extends`
  // expands to, matching what `tokens:validate` already accepts.
  const mergedBase = mergeAndExpandExtends(baseDocuments);
  const baseIndex = new Map<string, CorpusEntry>();
  collectEntries(mergedBase, '', undefined, baseIndex);
  assertUniqueCssProperties(baseIndex);

  // Resolves a reference nested inside a composite member (a shadow layer's `inset`, one
  // component of a color, ...) to its literal value, for base entries -- base has no
  // overriding context, so a resolver built from the base documents alone is correct here.
  const baseResolveReferences = createValueResolver(baseDocuments);

  const themeModifier = resolver.modifiers['theme']!;
  const motionModifier = resolver.modifiers['motion']!;

  const lightDocuments = refsFor(documentsByPath, themeModifier.contexts['light']!);
  const darkDocuments = refsFor(documentsByPath, themeModifier.contexts['dark']!);
  // The `reduced` motion context backs the `prefers-reduced-motion` media
  // block and the `forced-reduced-motion` context backs the
  // `data-reduced-motion='on'` override -- two distinct resolver contexts,
  // matching the two distinct selectors below. They read identically today
  // only because `modes/motion-reduced.tokens.json` and
  // `modes/motion-forced-reduced.tokens.json` happen to hold the same
  // values; each block must still be built from its own context so the two
  // can diverge without silently mis-wiring the forced block to the
  // system-preference values.
  const reducedMotionDocuments = refsFor(documentsByPath, motionModifier.contexts['reduced']!);
  const forcedReducedMotionDocuments = refsFor(
    documentsByPath,
    motionModifier.contexts['forced-reduced-motion']!,
  );

  // For EACH override context, "the documents in scope" are exactly what `resolutionOrder`
  // composes for it -- the base sets, then the theme document, then the motion document, in
  // resolver order -- with the ONE other modifier this block doesn't name filled from its own
  // declared default (`modifierValuesForContext`, the same default-fill `modifierValuesForCombo`
  // already applies for the resolved-context snapshots). This single composed scope feeds BOTH
  // `$extends` expansion just below (so an override's `$extends` can reach a foundation group
  // that the override document alone would never contain) and nested-reference resolution
  // further down (so a composite value's nested reference can see whichever other modifier's
  // document is in scope, not just the base) -- the same scope `tokens:validate` resolves for the
  // equivalent full combo, so the generator agrees with it in both places instead of composing
  // documents differently for structure than for lookup.
  const lightScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForContext(resolver, 'theme', 'light'),
  );
  const darkScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForContext(resolver, 'theme', 'dark'),
  );
  const reducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForContext(resolver, 'motion', 'reduced'),
  );
  const forcedReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForContext(resolver, 'motion', 'forced-reduced-motion'),
  );

  // `mergeAndExpandExtends(ownDocuments, scopeDocuments)` still merges and returns only the
  // override's OWN documents (so this context's membership -- which tokens it actually overrides
  // -- and declaration order are unchanged from before), but now looks up `$extends` TARGETS
  // against the wider composed scope, so a theme or motion document's `$extends` can reach a
  // foundation group.
  const lightOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(lightDocuments, lightScopeDocuments),
    '',
    undefined,
    lightOverrides,
  );
  const darkOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(darkDocuments, darkScopeDocuments),
    '',
    undefined,
    darkOverrides,
  );
  const reducedMotionOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(reducedMotionDocuments, reducedMotionScopeDocuments),
    '',
    undefined,
    reducedMotionOverrides,
  );
  const forcedReducedMotionOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(forcedReducedMotionDocuments, forcedReducedMotionScopeDocuments),
    '',
    undefined,
    forcedReducedMotionOverrides,
  );

  // A per-context resolver, each built from the SAME composed scope used for `$extends` above --
  // a nested reference inside a context's composite value may target a token that a DIFFERENT
  // modifier's document overrides (a reduced-motion composite referencing a token the dark theme
  // also overrides), and a resolver built from base-plus-this-context-alone would miss that
  // override entirely and silently substitute the base/foundation value.
  const lightResolveReferences = createValueResolver(lightScopeDocuments);
  const darkResolveReferences = createValueResolver(darkScopeDocuments);
  const reducedMotionResolveReferences = createValueResolver(reducedMotionScopeDocuments);
  const forcedReducedMotionResolveReferences = createValueResolver(
    forcedReducedMotionScopeDocuments,
  );

  const rootDeclarations = renderBaseDeclarations(baseIndex, baseResolveReferences);
  const darkDeclarations = renderOverrideDeclarations(
    darkOverrides,
    baseIndex,
    darkResolveReferences,
  );
  const lightDeclarations = renderOverrideDeclarations(
    lightOverrides,
    baseIndex,
    lightResolveReferences,
  );
  const reducedMotionDeclarations = renderOverrideDeclarations(
    reducedMotionOverrides,
    baseIndex,
    reducedMotionResolveReferences,
  );
  const forcedReducedMotionDeclarations = renderOverrideDeclarations(
    forcedReducedMotionOverrides,
    baseIndex,
    forcedReducedMotionResolveReferences,
  );

  const css = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Source: packages/components/src/tokens/ (the DTCG token corpus).
 * Regenerate: ${REGENERATE_COMMAND}
 */

:root {
  /* Structural: not a design token. */
  color-scheme: light dark;

${rootDeclarations}
}

:root[data-theme='dark'] {
  /* Structural: not a design token. */
  color-scheme: dark;
}

:root[data-theme='light'] {
  /* Structural: not a design token. */
  color-scheme: light;
}

[data-theme='dark'] {
  /* Structural: not a design token. */
  color-scheme: dark;

${darkDeclarations}
}

[data-theme='light'] {
  /* Structural: not a design token. */
  color-scheme: light;

${lightDeclarations}
}

@media (prefers-reduced-motion: reduce) {
  :root:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']) {
${reducedMotionDeclarations}
  }
}

:root[data-reduced-motion='on'] {
${forcedReducedMotionDeclarations}
}
`;

  return format(css, { ...PRETTIER_OPTIONS, parser: 'css', plugins: CSS_PLUGINS });
}

// ---------------------------------------------------------------------------
// Resolved-context JSON files (deliverable 3). Uses resolve.ts's full
// alias-resolving `resolveDocuments` -- unlike tokens-base.css generation,
// there is no need here to know which tokens a context overrides, only the
// final flat resolved value at every path.
// ---------------------------------------------------------------------------

type ResolvedContextCombo = {
  name: string;
  theme: string;
  motion: string;
};

const RESOLVED_CONTEXT_COMBOS: readonly ResolvedContextCombo[] = [
  { name: 'light', theme: 'light', motion: 'default' },
  { name: 'dark', theme: 'dark', motion: 'default' },
  { name: 'light-reduced-motion', theme: 'light', motion: 'reduced' },
  { name: 'dark-reduced-motion', theme: 'dark', motion: 'reduced' },
];

/**
 * The token documents one modifier-value combination contributes, in
 * `resolver.resolutionOrder` order rather than a hardcoded [sets, theme,
 * motion] order. Mirrors `validate-corpus.ts`'s own per-combination assembly
 * (`parseResolutionOrder` / `sourcesForEntry`) so the resolved snapshots and
 * the validator agree on ordering even if the resolver ever reorders or adds
 * a set/modifier -- `mergeDocuments` keeps only the LAST occurrence of a
 * colliding token path, so document order determines the resolved value.
 */
export function documentsForResolutionOrder(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
  modifierValues: Record<string, string>,
): TokenDocument[] {
  return parseResolutionOrder(resolver).flatMap((entry) =>
    refsFor(documentsByPath, sourcesForEntry(resolver, entry, modifierValues)),
  );
}

/**
 * The full modifier-value map when only SOME modifiers are named explicitly: every OTHER
 * modifier the resolver declares is filled from its own declared `default` context. Shared by
 * `modifierValuesForCombo` (a resolved-context snapshot, which names `theme` and `motion`
 * together) and `modifierValuesForContext` (a single override block, which names only the one
 * modifier it varies) so both describe "the rest of the corpus" identically. A modifier with no
 * declared default AND not named by the caller is a genuine authoring gap -- the caller can't say
 * what to resolve -- so this fails with a clear, named error rather than letting `sourcesForEntry`
 * look up `contexts[undefined]` and throw an unhelpful one.
 */
function modifierValuesWithDefaults(
  resolver: ResolverDocument,
  named: Record<string, string>,
  describeCaller: string,
): Record<string, string> {
  const modifierValues: Record<string, string> = {};
  for (const modifierName of Object.keys(resolver.modifiers)) {
    const value = named[modifierName] ?? resolver.modifiers[modifierName]!.default;
    if (value === undefined) {
      throw new Error(
        `${describeCaller} does not name a value for modifier "${modifierName}", and modifier ` +
          `"${modifierName}" has no declared default context.`,
      );
    }
    modifierValues[modifierName] = value;
  }
  return modifierValues;
}

/**
 * The full modifier-value map for one `RESOLVED_CONTEXT_COMBO`: the combo's own named
 * modifiers (`theme`/`motion`), plus a value for every OTHER modifier the resolver declares.
 * `RESOLVED_CONTEXT_COMBOS` is deliberately not generalized to every modifier combination --
 * the set of published resolved contexts is a packaging decision (CIN-31), and the four named
 * snapshots stay an explicit list.
 */
export function modifierValuesForCombo(
  resolver: ResolverDocument,
  combo: ResolvedContextCombo,
): Record<string, string> {
  return modifierValuesWithDefaults(
    resolver,
    { theme: combo.theme, motion: combo.motion },
    `Resolved-context combo "${combo.name}"`,
  );
}

/**
 * The full modifier-value map for building ONE override context in isolation -- e.g. the "dark"
 * theme block or the "reduced" motion block in `tokens-base.css`, each of which varies a single
 * modifier while every other modifier stays at its own declared default. This is the same
 * default-fill `modifierValuesForCombo` applies for the resolved-context snapshots, so an
 * override block's composed document scope and a snapshot's agree on what "the rest of the
 * corpus" means whenever a block only varies one axis.
 */
export function modifierValuesForContext(
  resolver: ResolverDocument,
  modifierName: string,
  contextName: string,
): Record<string, string> {
  return modifierValuesWithDefaults(
    resolver,
    { [modifierName]: contextName },
    `Override context "${modifierName}.${contextName}"`,
  );
}

export async function buildResolvedContexts(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Promise<Map<string, string>> {
  const themeModifier = resolver.modifiers['theme']!;
  const motionModifier = resolver.modifiers['motion']!;

  const outputs = new Map<string, string>();
  for (const combo of RESOLVED_CONTEXT_COMBOS) {
    const themeContext = themeModifier.contexts[combo.theme];
    const motionContext = motionModifier.contexts[combo.motion];
    if (!themeContext || !motionContext) {
      throw new Error(
        `Resolver has no "${combo.theme}"/"${combo.motion}" context for "${combo.name}".`,
      );
    }
    const modifierValues = modifierValuesForCombo(resolver, combo);
    const documents = documentsForResolutionOrder(resolver, documentsByPath, modifierValues);
    const resolved = resolveDocuments(documents);
    const json = await format(JSON.stringify(resolved), {
      ...PRETTIER_OPTIONS,
      parser: 'json',
      plugins: JSON_PLUGINS,
    });
    outputs.set(combo.name, json);
  }
  return outputs;
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

export async function loadCorpus(): Promise<{
  resolver: ResolverDocument;
  documentsByPath: Map<string, TokenDocument>;
}> {
  const resolver = await loadResolverDocument();
  const loaded = await loadTokenDocuments();
  const documentsByPath = new Map(loaded.map(({ path, document }) => [path, document]));
  return { resolver, documentsByPath };
}

/** Absolute output path -> generated file content, for every file `tokens:generate` produces. */
export async function buildGeneratedOutputs(): Promise<Map<string, string>> {
  const { resolver, documentsByPath } = await loadCorpus();
  const css = await buildTokensBaseCss(resolver, documentsByPath);
  const resolvedContexts = await buildResolvedContexts(resolver, documentsByPath);

  const outputs = new Map<string, string>();
  outputs.set(tokensBaseCssPath, css);
  for (const [name, content] of resolvedContexts) {
    outputs.set(join(resolvedDirectory, `${name}.json`), content);
  }
  return outputs;
}

/**
 * Compares freshly generated output against the committed content at each
 * output path (`undefined` for a missing/unreadable file) and returns the
 * absolute paths that drifted. Empty means everything committed matches what
 * the generator produces right now -- exactly what `--check` gates on.
 */
export function findDriftedPaths(
  generated: ReadonlyMap<string, string>,
  existing: ReadonlyMap<string, string | undefined>,
): string[] {
  const drifted: string[] = [];
  for (const [path, content] of generated) {
    if (existing.get(path) !== content) drifted.push(path);
  }
  return drifted;
}

async function readExisting(paths: Iterable<string>): Promise<Map<string, string | undefined>> {
  const existing = new Map<string, string | undefined>();
  for (const path of paths) {
    existing.set(
      path,
      await Bun.file(path)
        .text()
        .catch(() => undefined),
    );
  }
  return existing;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const generated = await buildGeneratedOutputs();

  if (check) {
    const existing = await readExisting(generated.keys());
    const drifted = findDriftedPaths(generated, existing);
    if (drifted.length > 0) {
      throw new Error(
        `Generated token output drifted from the committed files:\n${drifted
          .map((path) => `  - ${path}`)
          .join('\n')}\nRun ${REGENERATE_COMMAND}.`,
      );
    }
    return;
  }

  await mkdir(resolvedDirectory, { recursive: true });
  for (const [path, content] of generated) await Bun.write(path, content);
}

if (import.meta.main) await main();
