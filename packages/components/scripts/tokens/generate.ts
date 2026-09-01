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
import {
  expandContextSources,
  normalizeSourcePath,
  parseResolutionOrder,
  sourcesForEntry,
} from './validate-corpus.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDirectory, '..', '..');
const repoRoot = join(packageRoot, '..', '..');
export const tokensBaseCssPath = join(packageRoot, 'src', 'styles', 'tokens-base.css');
export const resolvedDirectory = join(tokenRoot, 'resolved');
export const registryJsonPath = join(tokenRoot, 'registry.generated.json');
/** The typed registry module published at `@lostgradient/cinder/tokens/registry`. */
export const registryModulePath = join(tokenRoot, 'registry.generated.ts');
/** The token-surface index published at `@lostgradient/cinder/tokens`. */
export const tokenIndexPath = join(tokenRoot, 'index.json');
export const tokensDocPath = join(repoRoot, 'docs', 'tokens.md');
export const colorTokenRegistryGeneratedPath = join(
  packageRoot,
  '..',
  'playground',
  'src',
  'shell-app',
  'color-token-registry.generated.ts',
);

export const REGENERATE_COMMAND = 'bun run --filter=@lostgradient/cinder tokens:generate';

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
export const PRETTIER_OPTIONS = {
  singleQuote: true,
  tabWidth: 2,
  printWidth: 100,
  endOfLine: 'lf',
} as const;

/** The `json` parser lives in the babel plugin; `estree` supplies its printer. */
export const JSON_PLUGINS = [babelPlugin, estreePlugin];
const CSS_PLUGINS = [postcssPlugin];
const DEFERRED_COMPONENT_ALIAS_FAMILIES = new Set(['accordion-item']);

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
  /**
   * The remaining `com.lostgradient.cinder` extension fields and the DTCG
   * `$deprecated` flag, carried through purely for {@link registry.ts}'s
   * `buildTokenRegistry` -- CSS generation in this file never reads them.
   * Kept on `CorpusEntry` itself (rather than a second, parallel tree walk)
   * so the registry reuses the exact same `collectEntries` traversal that
   * produces `tokens-base.css`, instead of re-deriving corpus structure.
   */
  public?: boolean | undefined;
  category?: string | undefined;
  component?: string | undefined;
  deprecated?: boolean | string | undefined;
  /**
   * True when `value` came from `$ref` rather than `$value`. `$ref` is a
   * generic JSON Pointer with no DTCG requirement that its target be a whole
   * token -- unlike an ordinary bare alias `$value`, which this generator has
   * always required to name a whole token (a deliberate, pre-existing
   * restriction; see `resolveAlias`'s own comment). `serializeEntryValue`
   * uses this flag to allow a `$ref` alone to fall through to typed
   * serialization when it targets a property rather than a whole token,
   * without loosening that restriction for ordinary `$value` aliases.
   */
  isRefAlias?: boolean | undefined;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToken(value: unknown): value is DesignToken {
  // Mirrors resolve.ts's `isToken`: a DTCG 2025.10 `$ref` whole-token alias
  // is mutually exclusive with `$value`, so a node declaring either is
  // token-shaped. This walker classifies the RAW, unresolved corpus (see the
  // module doc above) -- checking `$value` alone was the CIN-463 "live trap"
  // recurring a third time here, independent of resolve.ts's own copy: a
  // `$ref`-only node fell through to `isTokenGroup`, was walked as an empty
  // group, and silently vanished from `tokens-base.css` and the generated
  // registry (both of which reuse `collectEntries` below) even though it
  // validated and resolved correctly.
  return isPlainObject(value) && ('$value' in value || '$ref' in value);
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
  inheritedDeprecated: boolean | string | undefined,
): CorpusEntry {
  const extensions = cinderExtensions(token);
  const cssProperty =
    typeof extensions?.['cssProperty'] === 'string' ? extensions['cssProperty'] : undefined;
  const cssRecipe =
    typeof extensions?.['cssRecipe'] === 'string' ? extensions['cssRecipe'] : undefined;
  const category =
    typeof extensions?.['category'] === 'string' ? extensions['category'] : undefined;
  const component =
    typeof extensions?.['component'] === 'string' ? extensions['component'] : undefined;
  const isPublic = typeof extensions?.['public'] === 'boolean' ? extensions['public'] : undefined;
  // DTCG makes `$deprecated` inheritable the same way `$type` is, and the
  // flattened corpus keeps no group records -- so without carrying the
  // ancestor state down, a `$deprecated` group whose children do not repeat the
  // field loses it entirely and every descendant is reported `deprecated:
  // false`, letting registry consumers surface a deprecated group's tokens as
  // current. A token's own `$deprecated` still wins: a group can deprecate its
  // children, and a child can carry its own (more specific) reason string.
  const ownDeprecated =
    typeof token.$deprecated === 'boolean' || typeof token.$deprecated === 'string'
      ? token.$deprecated
      : undefined;
  const deprecated = ownDeprecated ?? inheritedDeprecated;
  // A `$ref` whole-token alias has no `$value` of its own -- the reference
  // string ITSELF is the raw, unresolved value this walker records (mirroring
  // how an ordinary embedded `{a.b.c}`/`#/a/b/c` alias is kept raw rather than
  // resolved here; see the module doc above). `isAliasReference` in
  // `serializeEntryValue` recognizes both forms identically, so a `$ref`
  // token flows through the exact same `var(--referenced-property)` emission
  // path as an ordinary aliased `$value`, rather than a second alias-handling
  // code path.
  const value = token.$ref ?? token.$value;
  return {
    path,
    value,
    type: token.$type ?? inheritedType,
    description: token.$description,
    cssProperty,
    cssRecipe,
    public: isPublic,
    category,
    component,
    deprecated,
    isRefAlias: token.$ref !== undefined,
  };
}

export function collectEntries(
  group: TokenGroup,
  prefix: string,
  inheritedType: TokenType | undefined,
  into: Map<string, CorpusEntry>,
  inheritedDeprecated?: boolean | string,
): void {
  const groupType = group.$type ?? inheritedType;
  // `false` on a group is a real value, not an absence: it un-deprecates a
  // subtree beneath a deprecated ancestor, so `??` rather than `||` here.
  const groupDeprecated =
    typeof group.$deprecated === 'boolean' || typeof group.$deprecated === 'string'
      ? group.$deprecated
      : inheritedDeprecated;
  if (isToken(group.$root)) {
    into.set(prefix, toEntry(prefix, group.$root, groupType, groupDeprecated));
  }
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isPlainObject(value)) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (isToken(value)) into.set(path, toEntry(path, value, groupType, groupDeprecated));
    else if (isTokenGroup(value)) collectEntries(value, path, groupType, into, groupDeprecated);
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
function wholeTokenIndexPath(reference: string): string {
  let path = tokenPathFromReference(reference);
  if (!reference.startsWith('#/')) return path;
  if (path.endsWith('.$value')) path = path.slice(0, -'.$value'.length);
  if (path === '$root') return '';
  return path.endsWith('.$root') ? path.slice(0, -'.$root'.length) : path;
}

export function resolveAlias(reference: string, baseIndex: Map<string, CorpusEntry>): string {
  const path = wholeTokenIndexPath(reference);
  const target = baseIndex.get(path);
  if (!target?.cssProperty) {
    throw new Error(
      `Alias reference "${reference}" does not resolve to a base token with a cssProperty ` +
        `(looked up path "${path}").`,
    );
  }
  return `var(${target.cssProperty})`;
}

/**
 * Whether `reference` names a whole token that `resolveAlias` can turn into a
 * `var(--property)` reference -- used by `serializeEntryValue` to decide
 * whether a `$ref` alias should take that path or fall through to typed
 * serialization instead of throwing (see `serializeEntryValue`'s doc comment).
 */
function isWholeTokenAlias(reference: string, baseIndex: Map<string, CorpusEntry>): boolean {
  return baseIndex.get(wholeTokenIndexPath(reference))?.cssProperty !== undefined;
}

/** cssRecipe (verbatim) > alias reference (`var(--referenced-property)`) > typed `$value` serialization. Applies identically to base `:root` tokens and theme/motion override tokens. */
export function serializeEntryValue(
  entry: CorpusEntry,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver = (raw) => raw,
): string {
  if (typeof entry.cssRecipe === 'string') return entry.cssRecipe;
  if (isAliasReference(entry.value)) {
    // An ordinary bare-alias `$value` has always been required to name a
    // WHOLE token here -- a deliberate restriction (see `wholeTokenIndexPath`'s
    // doc comment) -- so a miss still throws via `resolveAlias` below. `$ref`
    // is a generic JSON Pointer with no such requirement: a property-level
    // `$ref` (e.g. `#/dimension/hairline/$value/value`, aliasing one scalar
    // member of another token rather than the whole token) resolves fine at
    // `tokens:validate` time but is not a whole-token identity, so it falls
    // through to typed serialization instead, which resolves it (and any
    // further nested references) via `resolveReferences` and formats the
    // result per `entry.type` -- the same path an embedded property-level
    // reference inside a composite `$value` already takes.
    if (!entry.isRefAlias || isWholeTokenAlias(entry.value, baseIndex)) {
      return resolveAlias(entry.value, baseIndex);
    }
  }
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

export function isRootDeclaredEntry(entry: CorpusEntry): boolean {
  return !(
    entry.component &&
    DEFERRED_COMPONENT_ALIAS_FAMILIES.has(entry.component) &&
    !entry.cssRecipe &&
    isAliasReference(entry.value)
  );
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
    // Component aliases are defaults at their consumption sites, not root
    // declarations. Deferring them lets both the public component property and
    // its referenced foundation token respond to scoped ancestor overrides.
    if (!isRootDeclaredEntry(entry)) continue;
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

export function withDependentBaseAliases(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  baseResolveReferences: ValueResolver,
  resolveReferences: ValueResolver,
): Map<string, CorpusEntry> {
  const scoped = new Map(overrides);
  for (const [path, entry] of baseIndex) {
    if (scoped.has(path)) continue;
    if (entry.cssRecipe || !entryContainsReference(entry)) continue;
    if (
      serializeEntryValue(entry, baseIndex, baseResolveReferences) !==
      serializeEntryValue(entry, baseIndex, resolveReferences)
    ) {
      scoped.set(path, entry);
    }
  }
  return scoped;
}

function withThemeDependentOverrides(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  systemResolveReferences: ValueResolver,
  themeResolveReferences: ValueResolver,
): Map<string, CorpusEntry> {
  const scoped = withDependentBaseAliases(
    new Map(),
    baseIndex,
    systemResolveReferences,
    themeResolveReferences,
  );
  for (const [path, entry] of overrides) {
    if (
      serializeEntryValue(entry, baseIndex, systemResolveReferences) !==
      serializeEntryValue(entry, baseIndex, themeResolveReferences)
    ) {
      scoped.set(path, entry);
    }
  }
  return scoped;
}

function valueContainsReference(value: unknown): boolean {
  if (typeof value === 'string') return /^\{[^{}]+\}$/.test(value) || value.startsWith('#/');
  if (Array.isArray(value)) return value.some(valueContainsReference);
  return isPlainObject(value) && Object.values(value).some(valueContainsReference);
}

export function entryContainsReference(entry: CorpusEntry): boolean {
  return valueContainsReference(entry.value);
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
export function assertUniqueCssProperties(
  entries: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry> = entries,
  resolveReferences: ValueResolver = (value) => value,
  resolveReferencesFactory?: () => ValueResolver,
): void {
  const claimantsByProperty = new Map<string, Array<[string, CorpusEntry]>>();
  for (const [path, entry] of entries) {
    if (!entry.cssProperty) continue;
    const claimants = claimantsByProperty.get(entry.cssProperty) ?? [];
    claimants.push([path, entry]);
    claimantsByProperty.set(entry.cssProperty, claimants);
  }

  const byProperty = new Map<string, Map<string, string[]>>();
  let activeResolver = resolveReferences;
  if ([...claimantsByProperty.values()].some((claimants) => claimants.length > 1)) {
    activeResolver = resolveReferencesFactory?.() ?? resolveReferences;
  }
  for (const [cssProperty, claimants] of claimantsByProperty) {
    if (claimants.length < 2) continue;
    const byValue = new Map<string, string[]>();
    for (const [path, entry] of claimants) {
      // `type` belongs in the key, not just the value: serialization is
      // type-directed, so two entries can share a raw `$value` and still emit
      // different CSS -- `fontFamily: "normal"` emits `normal` while
      // `fontWeight: "normal"` emits `400`. Hashing the value alone called that
      // pair identical, and the disagreement then surfaced downstream, where the
      // first-claimant docs index documented one form while the CSS and the drift
      // test's last-write map used the other, so regeneration produced
      // documentation the required drift test rejected.
      const emitted = serializeEntryValue(entry, baseIndex, activeResolver);
      const fingerprint = `${entry.type ?? ''}\u0000${emitted}`;
      byValue.set(fingerprint, [...(byValue.get(fingerprint) ?? []), path]);
    }
    byProperty.set(cssProperty, byValue);
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

/**
 * The same conflict {@link assertUniqueCssProperties} catches for `baseIndex`,
 * applied to ONE override block (a theme or motion context) in isolation.
 * `$extends` can legitimately give two base paths the same `cssProperty` with
 * IDENTICAL base values (assertUniqueCssProperties already lets that through) --
 * but nothing stopped a theme or motion override from then explicitly
 * diverging those two paths to DIFFERENT values, because the base-only guard
 * ran exactly once, against `baseIndex`, and never again against an override
 * block.
 *
 * An override token does not always restate its own `cssProperty` extension --
 * it is inherited, immutable metadata; an override document typically states
 * only a new `$value` -- so grouping by `entry.cssProperty` alone would skip
 * most override entries as property-less. `baseIndex` supplies whichever
 * `cssProperty` (and `$type`, needed for the same type-directed fingerprint
 * `assertUniqueCssProperties` already keys on) an override entry left
 * unstated, so the same two-paths-one-property conflict this guards against
 * at the base level is caught here too.
 */
export function assertUniqueOverrideCssProperties(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  scopeIndex: Map<string, CorpusEntry>,
  blockName: string,
  resolveReferences: ValueResolver = (value) => value,
): void {
  // Comparing only the paths PRESENT in `overrides` misses a base claimant
  // that shares a `cssProperty` with an overridden path but is not itself
  // overridden in THIS block -- e.g. `$extends` gives "alias.a" and
  // "swatch.a" the same property, and this block overrides only "alias.a".
  // That claimant's effective value in this context is NOT necessarily its
  // raw base value: `documentsForResolutionOrder` composes each block's
  // scope from base PLUS whichever other modifier's document this block's
  // context implicitly includes (e.g. the `motion.reduced` block's scope
  // includes the default THEME document too) -- so a sibling untouched by
  // THIS block may already have been changed by a DIFFERENT modifier's
  // override earlier in that composed scope. Falling back to raw
  // `baseIndex` ignores that intermediate composition and can miss a real
  // divergence (light changes both paths 1 -> 2, motion changes only one
  // back to 1 -- comparing against base "1" for the untouched path sees no
  // conflict, even though the light+motion combination actually holds 1 and
  // 2). `scopeIndex` -- the FULLY composed, already-resolved-by-precedence
  // corpus for this exact block's scope -- is what an unoverridden sibling's
  // effective value must come from instead.
  const basePathsByCssProperty = new Map<string, string[]>();
  for (const [path, entry] of baseIndex) {
    if (!entry.cssProperty) continue;
    const paths = basePathsByCssProperty.get(entry.cssProperty) ?? [];
    paths.push(path);
    basePathsByCssProperty.set(entry.cssProperty, paths);
  }
  // `renderOverrideDeclarations` always emits an override under its BASE
  // token's `cssProperty` -- it never honors a `cssProperty` an override
  // document happens to restate (that only ever originates from a document
  // echoing inherited extension data, not a real per-context property
  // change). Grouping or resolving by an override's own restated
  // `cssProperty` instead of its base's would let this guard separate two
  // claimants that generation actually emits to the SAME property, missing
  // the exact conflict it exists to catch.
  const relevantPaths = new Set<string>();
  for (const [path, entry] of overrides) {
    relevantPaths.add(path);
    const cssProperty = baseIndex.get(path)?.cssProperty ?? entry.cssProperty;
    if (!cssProperty) continue;
    for (const sibling of basePathsByCssProperty.get(cssProperty) ?? []) relevantPaths.add(sibling);
  }
  const resolved = new Map<string, CorpusEntry>();
  for (const path of relevantPaths) {
    const base = baseIndex.get(path);
    // This block's own override wins; otherwise the path's value already
    // resolved into this block's fully composed scope (which may itself
    // reflect a DIFFERENT modifier's override applied earlier in that
    // scope's resolution order); only fall back to the raw base entry if
    // the path is somehow absent from the composed scope entirely.
    const entry = overrides.get(path) ?? scopeIndex.get(path) ?? base;
    if (!entry) continue;
    resolved.set(path, {
      ...entry,
      cssProperty: base?.cssProperty ?? entry.cssProperty,
      type: entry.type ?? base?.type,
    });
  }
  try {
    assertUniqueCssProperties(resolved, baseIndex, resolveReferences);
  } catch (error) {
    if (error instanceof Error)
      throw new Error(`[${blockName}] ${error.message}`, { cause: error });
    throw error;
  }
}

type OverrideScope = {
  name: string;
  resolveReferences: ValueResolver;
};

/** A single emitted override declaration must be valid in every scope its selector reaches. */
export function assertOverrideScopeConsistency(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
  scopes: readonly OverrideScope[],
  blockName: string,
): void {
  if (![...overrides.values()].some((entry) => entry.isRefAlias || entryContainsReference(entry)))
    return;
  for (const [path, entry] of overrides) {
    const values = scopes.map((scope) => ({
      scope: scope.name,
      value: serializeEntryValue(entry, baseIndex, scope.resolveReferences),
    }));
    const distinct = new Set(values.map(({ value }) => value));
    if (distinct.size <= 1) continue;
    throw new Error(
      `[${blockName}] override token "${path}" serializes differently across reachable scopes: ` +
        values.map(({ scope, value }) => `${scope}=${value}`).join(', '),
    );
  }
}

/**
 * `tokens-base.css`'s block structure is FIXED, not derived from
 * `resolver.resolutionOrder`: `:root` is always assembled from every `sets`
 * entry (regardless of where it sits in `resolutionOrder`), and the theme
 * override blocks (`[data-theme='dark']`/`[data-theme='light']`) are always
 * emitted before the motion override blocks (the `prefers-reduced-motion`
 * media block and the `data-reduced-motion='on'` override) -- see
 * `buildTokensBaseCss`'s `darkDeclarations`/`lightDeclarations` vs.
 * `reducedMotionDeclarations`/`forcedReducedMotionDeclarations` ordering in
 * the template below.
 *
 * DECISION (CIN-469 finding 5): rather than deriving CSS block order from
 * `resolutionOrder` at generation time -- a bigger, riskier change for a PR
 * whose whole point is a no-diff, tests-and-generator-only fix -- this
 * generator keeps its fixed block structure and instead REJECTS a resolver
 * document whose `resolutionOrder` the fixed structure cannot faithfully
 * express: every `sets` entry must precede every `modifiers` entry (so
 * `:root`'s "every set, unconditionally" assembly matches what
 * `resolutionOrder` actually says the base layer is), and the `theme`
 * modifier must precede the `motion` modifier (so theme-before-motion block
 * emission matches cascade precedence, i.e. a motion override still wins over
 * a theme override for a token both touch, the same way "last non-`:root`
 * block wins" already works today). `cinder.resolver.json`'s current
 * `resolutionOrder` -- foundation, then theme, then motion -- already
 * satisfies this, so the guard is presently a no-op; it exists so a future
 * resolver edit that would silently desync `resolutionOrder` from emission
 * order fails loudly at generate time instead of shipping a CSS cascade that
 * disagrees with the resolver's own stated precedence. If `resolutionOrder`
 * ever legitimately needs a different shape, deriving block order for real
 * -- not just validating it -- is the follow-up.
 */
export function assertResolutionOrderMatchesCssBlockStructure(resolver: ResolverDocument): void {
  const order = parseResolutionOrder(resolver);
  const lastSetsIndex = order.reduce(
    (last, entry, index) => (entry.kind === 'sets' ? index : last),
    -1,
  );
  const firstModifierIndex = order.findIndex((entry) => entry.kind === 'modifiers');
  if (firstModifierIndex !== -1 && lastSetsIndex > firstModifierIndex) {
    throw new Error(
      'resolver\'s resolutionOrder interleaves a "sets" entry after a "modifiers" entry, but ' +
        'tokens-base.css always assembles :root from every "sets" entry unconditionally, ' +
        'regardless of position -- reorder resolutionOrder so every "sets" entry precedes every ' +
        '"modifiers" entry, or teach buildTokensBaseCss to derive :root membership from position.',
    );
  }
  const themeIndex = order.findIndex(
    (entry) => entry.kind === 'modifiers' && entry.name === 'theme',
  );
  const motionIndex = order.findIndex(
    (entry) => entry.kind === 'modifiers' && entry.name === 'motion',
  );
  if (themeIndex !== -1 && motionIndex !== -1 && themeIndex > motionIndex) {
    throw new Error(
      'resolver\'s resolutionOrder has "motion" before "theme", but tokens-base.css always ' +
        "emits the theme override blocks ([data-theme='dark']/[data-theme='light']) before the " +
        'motion override blocks (prefers-reduced-motion / data-reduced-motion) -- reorder ' +
        'resolutionOrder so "theme" precedes "motion", or teach buildTokensBaseCss to derive ' +
        'override block order from resolutionOrder.',
    );
  }
  // `buildTokensBaseCss`'s override-block template is hardcoded to exactly two
  // modifiers, "theme" and "motion" -- it never reads `resolver.modifiers` generically,
  // so a third modifier's context documents would never reach ANY emitted CSS block,
  // while `buildResolvedContexts`/`modifierValuesForCombo` fill every declared
  // modifier (including a third one, at its own default) when composing each resolved
  // snapshot's document scope. A third modifier whose default context overrides
  // anything the base sets don't would then make a published resolved-context
  // snapshot disagree with what the actual CSS renders, for every combination, not just
  // a cross-modifier edge case -- the same class of artifact/CSS disagreement this
  // whole guard exists to prevent, just triggered structurally instead of by a specific
  // value collision. Reject a third modifier here rather than silently generating CSS
  // that can't express it.
  const unsupportedModifiers = Object.keys(resolver.modifiers).filter(
    (name) => name !== 'theme' && name !== 'motion',
  );
  if (unsupportedModifiers.length > 0) {
    throw new Error(
      `resolver declares modifier(s) ${unsupportedModifiers.map((name) => `"${name}"`).join(', ')}, ` +
        'but tokens-base.css\'s override-block template only knows how to emit "theme" and ' +
        '"motion" -- add support for the new modifier to buildTokensBaseCss (and to ' +
        "buildResolvedContexts's published combos) before adding it to the resolver, or the " +
        'generated CSS and published resolved-context snapshots will silently disagree.',
    );
  }
}

export async function buildTokensBaseCss(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Promise<string> {
  assertResolutionOrderMatchesCssBlockStructure(resolver);
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

  // Resolves a reference nested inside a composite member (a shadow layer's `inset`, one
  // component of a color, ...) to its literal value, for base entries -- base has no
  // overriding context, so a resolver built from the base documents alone is correct here.
  const baseResolveReferences = createValueResolver(baseDocuments);
  assertUniqueCssProperties(baseIndex, baseIndex, baseResolveReferences);

  const defaultMotionContext = resolver.modifiers['motion']?.default;
  if (!defaultMotionContext) {
    throw new Error('resolver modifier "motion" must declare a default context');
  }
  const defaultMotionDocuments = refsFor(
    documentsByPath,
    expandContextSources(resolver, 'motion', defaultMotionContext),
  );
  const nonEmptyDefaultMotionDocuments = defaultMotionDocuments.filter((document) =>
    Object.keys(document).some((key) => key !== '$schema' && key !== '$description'),
  );
  if (nonEmptyDefaultMotionDocuments.length > 0) {
    throw new Error(
      'motion.default must not declare token overrides or group metadata; it must be empty apart ' +
        'from $schema and $description because tokens-base.css emits the canonical set values in :root',
    );
  }
  const defaultMotionEntries = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(defaultMotionDocuments, [...baseDocuments, ...defaultMotionDocuments]),
    '',
    undefined,
    defaultMotionEntries,
  );
  if (defaultMotionEntries.size > 0) {
    throw new Error(
      `motion.default must not declare token overrides because tokens-base.css emits the ` +
        `canonical set values in :root: ${[...defaultMotionEntries.keys()].join(', ')}`,
    );
  }

  // `expandContextSources` (not a raw `resolver.modifiers['theme'].contexts[...]` read via
  // `refsFor`) -- a theme or motion context may itself list a
  // resolver-internal `#/sets/<name>` source rather than only plain document
  // `$ref`s, and that internal reference needs expanding to the document
  // `$ref`s it stands for before `refsFor`'s `requireDocument` lookup runs.
  // `requireDocument` looks for a literal ON-DISK document named
  // `#/sets/<name>` and throws otherwise, so a resolver `tokens:validate`
  // already accepts (`sourcesForEntry` in `validate-corpus.ts` expands the
  // identical reference for its own resolution-order walk) could not be
  // generated without this expansion happening here too.
  const lightDocuments = refsFor(documentsByPath, expandContextSources(resolver, 'theme', 'light'));
  const darkDocuments = refsFor(documentsByPath, expandContextSources(resolver, 'theme', 'dark'));
  // The `reduced` motion context backs the `prefers-reduced-motion` media
  // block and the `forced-reduced-motion` context backs the
  // `data-reduced-motion='on'` override -- two distinct resolver contexts,
  // matching the two distinct selectors below. They read identically today
  // only because `modes/motion-reduced.tokens.json` and
  // `modes/motion-forced-reduced.tokens.json` happen to hold the same
  // values; each block must still be built from its own context so the two
  // can diverge without silently mis-wiring the forced block to the
  // system-preference values.
  const reducedMotionDocuments = refsFor(
    documentsByPath,
    expandContextSources(resolver, 'motion', 'reduced'),
  );
  const forcedReducedMotionDocuments = refsFor(
    documentsByPath,
    expandContextSources(resolver, 'motion', 'forced-reduced-motion'),
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

  // Per-block, not just once for `baseIndex`: `$extends` can legitimately give
  // two base paths the same `cssProperty` with identical base values, and a
  // theme or motion override can then explicitly diverge them to different
  // values -- see `assertUniqueOverrideCssProperties`'s docstring. Each
  // block's `scopeIndex` is the SAME fully composed scope already used for
  // `$extends` lookup and nested-reference resolution above (base plus
  // whichever other modifier's document this block's context implicitly
  // includes), so an unoverridden sibling's comparison value reflects any
  // OTHER modifier's override already baked into that scope, not just base.
  const lightScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(mergeAndExpandExtends(lightScopeDocuments), '', undefined, lightScopeIndex);
  const darkScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(mergeAndExpandExtends(darkScopeDocuments), '', undefined, darkScopeIndex);

  // Use the exact composed scope for uniqueness serialization as well as CSS
  // emission. This matters for nested/property references: resolving against
  // base-only (or the wrong modifier combination) can produce a different
  // emitted value while the renderer uses the composed scope.
  const lightResolveReferences = createValueResolver(lightScopeDocuments);
  const darkResolveReferences = createValueResolver(darkScopeDocuments);

  assertUniqueOverrideCssProperties(
    lightOverrides,
    baseIndex,
    lightScopeIndex,
    'theme.light',
    lightResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    darkOverrides,
    baseIndex,
    darkScopeIndex,
    'theme.dark',
    darkResolveReferences,
  );
  // The motion blocks are emitted as a fixed `@media`/attribute selector that
  // applies regardless of which `[data-theme]` is active -- unlike theme
  // (which always cascades BEFORE motion, so a theme block's own internal
  // consistency never depends on which motion state is active), a motion
  // block's internal consistency must hold under EVERY theme it can combine
  // with at runtime. `reducedMotionScopeDocuments`/`forcedReducedMotionScopeDocuments`
  // above (used for `$extends` lookup and nested-reference resolution) compose
  // motion with the THEME axis defaulted to `resolver.modifiers.theme.default`
  // (`modifierValuesForContext`'s fill), which is 'light' in the corpus today
  // but is not schema-guaranteed to be -- an earlier version of this fix
  // wrongly assumed that default-filled scope WAS "light" and built only an
  // explicit "dark" counterpart to check alongside it, which would silently
  // validate the SAME theme twice (and leave light entirely unchecked) if
  // `theme.default` were ever changed to 'dark'. Build BOTH theme scopes
  // explicitly by name for the guard, instead of treating either as "whatever
  // the default happens to be".
  const lightReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForCombo(resolver, {
      name: 'light-reduced-motion',
      theme: 'light',
      motion: 'reduced',
    }),
  );
  const lightReducedMotionScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(lightReducedMotionScopeDocuments),
    '',
    undefined,
    lightReducedMotionScopeIndex,
  );
  const darkReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForCombo(resolver, {
      name: 'dark-reduced-motion',
      theme: 'dark',
      motion: 'reduced',
    }),
  );
  const darkReducedMotionScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(darkReducedMotionScopeDocuments),
    '',
    undefined,
    darkReducedMotionScopeIndex,
  );
  const lightForcedReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForCombo(resolver, {
      name: 'light-forced-reduced-motion',
      theme: 'light',
      motion: 'forced-reduced-motion',
    }),
  );
  const lightForcedReducedMotionScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(lightForcedReducedMotionScopeDocuments),
    '',
    undefined,
    lightForcedReducedMotionScopeIndex,
  );
  const darkForcedReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForCombo(resolver, {
      name: 'dark-forced-reduced-motion',
      theme: 'dark',
      motion: 'forced-reduced-motion',
    }),
  );
  const darkForcedReducedMotionScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(darkForcedReducedMotionScopeDocuments),
    '',
    undefined,
    darkForcedReducedMotionScopeIndex,
  );
  const lightReducedMotionResolveReferences = createValueResolver(lightReducedMotionScopeDocuments);
  const darkReducedMotionResolveReferences = createValueResolver(darkReducedMotionScopeDocuments);
  const lightForcedReducedMotionResolveReferences = createValueResolver(
    lightForcedReducedMotionScopeDocuments,
  );
  const darkForcedReducedMotionResolveReferences = createValueResolver(
    darkForcedReducedMotionScopeDocuments,
  );
  assertUniqueOverrideCssProperties(
    reducedMotionOverrides,
    baseIndex,
    lightReducedMotionScopeIndex,
    'motion.reduced (light theme)',
    lightReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    reducedMotionOverrides,
    baseIndex,
    darkReducedMotionScopeIndex,
    'motion.reduced (dark theme)',
    darkReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    forcedReducedMotionOverrides,
    baseIndex,
    lightForcedReducedMotionScopeIndex,
    'motion.forced-reduced-motion (light theme)',
    lightForcedReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    forcedReducedMotionOverrides,
    baseIndex,
    darkForcedReducedMotionScopeIndex,
    'motion.forced-reduced-motion (dark theme)',
    darkForcedReducedMotionResolveReferences,
  );

  const systemReducedMotionScopeDocuments = documentsForSystemMotionScope(
    resolver,
    documentsByPath,
    'reduced',
  );
  const systemForcedReducedMotionScopeDocuments = documentsForSystemMotionScope(
    resolver,
    documentsByPath,
    'forced-reduced-motion',
  );
  const systemReducedMotionResolveReferences = createValueResolver(
    systemReducedMotionScopeDocuments,
  );
  const systemForcedReducedMotionResolveReferences = createValueResolver(
    systemForcedReducedMotionScopeDocuments,
  );
  assertUniqueOverrideCssProperties(
    reducedMotionOverrides,
    baseIndex,
    scopeIndexFromDocuments(systemReducedMotionScopeDocuments),
    'motion.reduced (system theme)',
    systemReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    forcedReducedMotionOverrides,
    baseIndex,
    scopeIndexFromDocuments(systemForcedReducedMotionScopeDocuments),
    'motion.forced-reduced-motion (system theme)',
    systemForcedReducedMotionResolveReferences,
  );
  assertOverrideScopeConsistency(
    lightOverrides,
    baseIndex,
    [
      { name: 'motion.default', resolveReferences: lightResolveReferences },
      {
        name: 'motion.reduced',
        resolveReferences: lightReducedMotionResolveReferences,
      },
      {
        name: 'motion.forced-reduced-motion',
        resolveReferences: lightForcedReducedMotionResolveReferences,
      },
    ],
    'theme.light',
  );
  assertOverrideScopeConsistency(
    darkOverrides,
    baseIndex,
    [
      { name: 'motion.default', resolveReferences: darkResolveReferences },
      {
        name: 'motion.reduced',
        resolveReferences: darkReducedMotionResolveReferences,
      },
      {
        name: 'motion.forced-reduced-motion',
        resolveReferences: darkForcedReducedMotionResolveReferences,
      },
    ],
    'theme.dark',
  );

  const rootDeclarations = renderBaseDeclarations(baseIndex, baseResolveReferences);
  const darkAliases = withDependentBaseAliases(
    darkOverrides,
    baseIndex,
    baseResolveReferences,
    darkResolveReferences,
  );
  const lightAliases = withDependentBaseAliases(
    lightOverrides,
    baseIndex,
    baseResolveReferences,
    lightResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    darkAliases,
    baseIndex,
    darkScopeIndex,
    'theme.dark dependent aliases',
    darkResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    lightAliases,
    baseIndex,
    lightScopeIndex,
    'theme.light dependent aliases',
    lightResolveReferences,
  );
  const darkDeclarations = renderOverrideDeclarations(
    darkAliases,
    baseIndex,
    darkResolveReferences,
  );
  const lightDeclarations = renderOverrideDeclarations(
    lightAliases,
    baseIndex,
    lightResolveReferences,
  );
  const reducedMotionAliases = withDependentBaseAliases(
    reducedMotionOverrides,
    baseIndex,
    baseResolveReferences,
    systemReducedMotionResolveReferences,
  );
  const forcedReducedMotionAliases = withDependentBaseAliases(
    forcedReducedMotionOverrides,
    baseIndex,
    baseResolveReferences,
    systemForcedReducedMotionResolveReferences,
  );
  const lightReducedMotionAliases = withThemeDependentOverrides(
    reducedMotionOverrides,
    baseIndex,
    systemReducedMotionResolveReferences,
    lightReducedMotionResolveReferences,
  );
  const darkReducedMotionAliases = withThemeDependentOverrides(
    reducedMotionOverrides,
    baseIndex,
    systemReducedMotionResolveReferences,
    darkReducedMotionResolveReferences,
  );
  const lightForcedReducedMotionAliases = withThemeDependentOverrides(
    forcedReducedMotionOverrides,
    baseIndex,
    systemForcedReducedMotionResolveReferences,
    lightForcedReducedMotionResolveReferences,
  );
  const darkForcedReducedMotionAliases = withThemeDependentOverrides(
    forcedReducedMotionOverrides,
    baseIndex,
    systemForcedReducedMotionResolveReferences,
    darkForcedReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    reducedMotionAliases,
    baseIndex,
    scopeIndexFromDocuments(systemReducedMotionScopeDocuments),
    'motion.reduced dependent aliases',
    systemReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    forcedReducedMotionAliases,
    baseIndex,
    scopeIndexFromDocuments(systemForcedReducedMotionScopeDocuments),
    'motion.forced-reduced-motion dependent aliases',
    systemForcedReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    lightReducedMotionAliases,
    baseIndex,
    lightReducedMotionScopeIndex,
    'motion.reduced dependent aliases (light theme)',
    lightReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    darkReducedMotionAliases,
    baseIndex,
    darkReducedMotionScopeIndex,
    'motion.reduced dependent aliases (dark theme)',
    darkReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    lightForcedReducedMotionAliases,
    baseIndex,
    lightForcedReducedMotionScopeIndex,
    'motion.forced-reduced-motion dependent aliases (light theme)',
    lightForcedReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    darkForcedReducedMotionAliases,
    baseIndex,
    darkForcedReducedMotionScopeIndex,
    'motion.forced-reduced-motion dependent aliases (dark theme)',
    darkForcedReducedMotionResolveReferences,
  );
  const reducedMotionDeclarations = renderOverrideDeclarations(
    reducedMotionAliases,
    baseIndex,
    systemReducedMotionResolveReferences,
  );
  const forcedReducedMotionDeclarations = renderOverrideDeclarations(
    forcedReducedMotionAliases,
    baseIndex,
    systemForcedReducedMotionResolveReferences,
  );
  const lightReducedMotionDeclarations = renderOverrideDeclarations(
    lightReducedMotionAliases,
    baseIndex,
    lightReducedMotionResolveReferences,
  );
  const darkReducedMotionDeclarations = renderOverrideDeclarations(
    darkReducedMotionAliases,
    baseIndex,
    darkReducedMotionResolveReferences,
  );
  const lightForcedReducedMotionDeclarations = renderOverrideDeclarations(
    lightForcedReducedMotionAliases,
    baseIndex,
    lightForcedReducedMotionResolveReferences,
  );
  const darkForcedReducedMotionDeclarations = renderOverrideDeclarations(
    darkForcedReducedMotionAliases,
    baseIndex,
    darkForcedReducedMotionResolveReferences,
  );
  const reducedDarkThemeBlock = darkReducedMotionDeclarations
    ? `:root:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) [data-theme='dark'],
:root[data-theme='dark']:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${darkReducedMotionDeclarations}
}`
    : '';
  const reducedLightThemeBlock = lightReducedMotionDeclarations
    ? `:root:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) [data-theme='light'],
:root[data-theme='light']:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${lightReducedMotionDeclarations}
}`
    : '';
  const reducedSystemDarkBlock = darkReducedMotionDeclarations
    ? `@media (prefers-color-scheme: dark) {
  :root:not([data-theme]):not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${darkReducedMotionDeclarations}
  }
}`
    : '';
  const reducedSystemLightBlock = lightReducedMotionDeclarations
    ? `@media (prefers-color-scheme: light) {
  :root:not([data-theme]):not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${lightReducedMotionDeclarations}
  }
}`
    : '';
  const forcedDarkThemeBlock = darkForcedReducedMotionDeclarations
    ? `:root[data-reduced-motion='on'] [data-theme='dark'],
:root[data-reduced-motion='on'][data-theme='dark'] {
${darkForcedReducedMotionDeclarations}
}`
    : '';
  const forcedLightThemeBlock = lightForcedReducedMotionDeclarations
    ? `:root[data-reduced-motion='on'] [data-theme='light'],
:root[data-reduced-motion='on'][data-theme='light'] {
${lightForcedReducedMotionDeclarations}
}`
    : '';
  const forcedSystemDarkBlock = darkForcedReducedMotionDeclarations
    ? `@media (prefers-color-scheme: dark) {
  :root[data-reduced-motion='on']:not([data-theme]) {
${darkForcedReducedMotionDeclarations}
  }
}`
    : '';
  const forcedSystemLightBlock = lightForcedReducedMotionDeclarations
    ? `@media (prefers-color-scheme: light) {
  :root[data-reduced-motion='on']:not([data-theme]) {
${lightForcedReducedMotionDeclarations}
  }
}`
    : '';

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
  :root:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${reducedMotionDeclarations}
  }
${reducedDarkThemeBlock}
${reducedLightThemeBlock}
${reducedSystemDarkBlock}
${reducedSystemLightBlock}
}

:root[data-reduced-motion='on'] {
${forcedReducedMotionDeclarations}
}
${forcedDarkThemeBlock}
${forcedLightThemeBlock}
${forcedSystemDarkBlock}
${forcedSystemLightBlock}
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

export const RESOLVED_CONTEXT_COMBOS: readonly ResolvedContextCombo[] = [
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

function scopeIndexFromDocuments(documents: readonly TokenDocument[]): Map<string, CorpusEntry> {
  const index = new Map<string, CorpusEntry>();
  collectEntries(mergeAndExpandExtends([...documents]), '', undefined, index);
  return index;
}

function documentsForSystemMotionScope(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
  motion: string,
): TokenDocument[] {
  const modifierValues = { motion };
  return parseResolutionOrder(resolver)
    .filter(
      (entry) => entry.kind === 'sets' || (entry.kind === 'modifiers' && entry.name === 'motion'),
    )
    .flatMap((entry) => refsFor(documentsByPath, sourcesForEntry(resolver, entry, modifierValues)));
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
    // A token whose `$value` cannot honestly represent its real CSS value in
    // DTCG's type system (e.g. `auto`, a bare `16 / 9` ratio, `currentColor`)
    // carries `nonRepresentableValue` in its extension data -- `cssRecipe`
    // governs its real CSS emission (tokens-base.css) and registry coverage
    // (registry.generated.json, which never publishes a raw `$value`), but a
    // generic DTCG consumer of THESE resolved-context JSON files has no way
    // to know `$value` here is a placeholder rather than the real resolved
    // value, and applying it literally actively breaks (e.g. `0rem` collapses
    // a block that should size to its content). Omit these paths from the
    // published resolved-context artifacts entirely rather than publish a
    // value known to be wrong.
    for (const path of Object.keys(resolved)) {
      if (cinderExtensions(resolved[path]!)?.['nonRepresentableValue'] === true) {
        delete resolved[path];
      }
    }
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

/**
 * Reads the currently-committed content at each of `paths` (`undefined` for a
 * missing/unreadable file). Exported so `generate-artifacts.ts` -- the actual
 * `tokens:generate` CLI entry point, which also writes the docs, registry,
 * and playground-data outputs this file knows nothing about -- can compare
 * ALL generated outputs (this file's CSS/JSON plus its own) against the
 * committed tree with one shared helper instead of two divergent ones.
 */
export async function readExisting(
  paths: Iterable<string>,
): Promise<Map<string, string | undefined>> {
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
