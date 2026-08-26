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
 * the same is true of the two motion contexts. Reading source documents also
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
import { mergeDocuments, resolveDocuments } from './resolve.ts';
import type {
  DesignToken,
  ResolverDocument,
  TokenDocument,
  TokenGroup,
  TokenType,
} from './types.ts';

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

type CorpusEntry = {
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

function isAliasReference(value: unknown): value is string {
  return typeof value === 'string' && /^\{[^{}]+\}$/.test(value);
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

function isCubicBezierValue(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'number');
}

function isFontFamilyValue(value: unknown): value is string[] | string {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
  );
}

function isColorValue(value: unknown): value is ColorValue {
  return (
    isPlainObject(value) &&
    typeof value['colorSpace'] === 'string' &&
    Array.isArray(value['components'])
  );
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
        isDimensionOrDuration(layer['spread']),
    )
  );
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
  // "serialize as hex", not "here is a redundant fallback to ignore".
  if (value.colorSpace === 'srgb' && typeof value.hex === 'string') return collapseHex(value.hex);

  if (value.colorSpace === 'oklch') {
    const [lightness, chroma, hue] = value.components;
    if (lightness === undefined || chroma === undefined || hue === undefined) {
      throw new Error(`oklch color value is missing a component: ${JSON.stringify(value)}`);
    }
    const alpha = typeof value.alpha === 'number' ? ` / ${formatComponent(value.alpha)}` : '';
    return `oklch(${formatOklchLightness(lightness)} ${formatComponent(chroma)} ${formatComponent(hue)}${alpha})`;
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

function formatFontFamily(value: string[] | string): string {
  const names = Array.isArray(value) ? value : [value];
  // The DTCG value stores clean, unquoted names; quoting any name containing
  // a space is required CSS syntax, not a formatting choice.
  return names.map((name) => (name.includes(' ') ? `'${name}'` : name)).join(', ');
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

function serializeTypedValue(type: TokenType, value: unknown, path: string): string {
  const malformed = (expected: string): never => {
    throw new Error(
      `Token at "${path}" has $type "${type}" but its $value is not a valid ${expected}.`,
    );
  };

  switch (type) {
    case 'dimension':
      return isDimensionOrDuration(value)
        ? formatDimension(value)
        : malformed('{value, unit} dimension');
    case 'duration':
      return isDimensionOrDuration(value)
        ? formatDuration(value)
        : malformed('{value, unit} duration');
    case 'number':
    case 'fontWeight':
      return isNumberValue(value) ? formatNumber(value) : malformed('number');
    case 'cubicBezier':
      return isCubicBezierValue(value)
        ? formatCubicBezier(value)
        : malformed('number[] cubic-bezier');
    case 'fontFamily':
      return isFontFamilyValue(value)
        ? formatFontFamily(value)
        : malformed('string | string[] font family');
    case 'color':
      return isColorValue(value) ? formatColor(value) : malformed('color');
    case 'shadow':
      return isShadowLayerArray(value) ? formatShadow(value) : malformed('shadow layer array');
    default:
      throw new Error(
        `No direct CSS serialization implemented for token type "${type}" at "${path}". ` +
          'Add a cssRecipe extension in the corpus, or extend serializeTypedValue.',
      );
  }
}

function resolveAlias(reference: string, baseIndex: Map<string, CorpusEntry>): string {
  const path = reference.slice(1, -1);
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
function serializeEntryValue(entry: CorpusEntry, baseIndex: Map<string, CorpusEntry>): string {
  if (typeof entry.cssRecipe === 'string') return entry.cssRecipe;
  if (isAliasReference(entry.value)) return resolveAlias(entry.value, baseIndex);
  if (entry.type === undefined) {
    throw new Error(`Token at "${entry.path}" has no $type and no cssRecipe; cannot serialize.`);
  }
  return serializeTypedValue(entry.type, entry.value, entry.path);
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

function requireDocument(documentsByPath: Map<string, TokenDocument>, ref: string): TokenDocument {
  const document = documentsByPath.get(ref);
  if (!document) {
    throw new Error(`Resolver references "${ref}" but no loaded token document has that path.`);
  }
  return document;
}

function refsFor(
  documentsByPath: Map<string, TokenDocument>,
  refs: readonly { $ref: string }[],
): TokenDocument[] {
  return refs.map((ref) => requireDocument(documentsByPath, ref.$ref));
}

function renderBaseDeclarations(baseIndex: Map<string, CorpusEntry>): string {
  const lines: string[] = [];
  for (const entry of baseIndex.values()) {
    if (!entry.cssProperty) {
      throw new Error(`Base corpus token at "${entry.path}" has no cssProperty extension.`);
    }
    if (entry.description) lines.push(`/* ${sanitizeComment(entry.description)} */`);
    const value = serializeEntryValue(entry, baseIndex);
    const stylelintDisable = stylelintDisableCommentFor(value);
    if (stylelintDisable) lines.push(stylelintDisable);
    lines.push(`${entry.cssProperty}: ${value};`);
  }
  return lines.join('\n');
}

function renderOverrideDeclarations(
  overrides: Map<string, CorpusEntry>,
  baseIndex: Map<string, CorpusEntry>,
): string {
  const lines: string[] = [];
  for (const [path, entry] of overrides) {
    const base = baseIndex.get(path);
    if (!base?.cssProperty) {
      throw new Error(`Override token at "${path}" has no matching base token with a cssProperty.`);
    }
    const value = serializeEntryValue(entry, baseIndex);
    const stylelintDisable = stylelintDisableCommentFor(value);
    if (stylelintDisable) lines.push(stylelintDisable);
    lines.push(`${base.cssProperty}: ${value};`);
  }
  return lines.join('\n');
}

async function buildTokensBaseCss(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Promise<string> {
  const baseDocuments = refsFor(documentsByPath, resolver.sets['foundation']!.sources);
  const mergedBase = mergeDocuments(baseDocuments);
  const baseIndex = new Map<string, CorpusEntry>();
  collectEntries(mergedBase, '', undefined, baseIndex);

  const themeModifier = resolver.modifiers['theme']!;
  const motionModifier = resolver.modifiers['motion']!;

  const lightOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeDocuments(refsFor(documentsByPath, themeModifier.contexts['light']!)),
    '',
    undefined,
    lightOverrides,
  );
  const darkOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeDocuments(refsFor(documentsByPath, themeModifier.contexts['dark']!)),
    '',
    undefined,
    darkOverrides,
  );

  // Only the `reduced` motion context feeds tokens-base.css: it backs both
  // the `prefers-reduced-motion` media block and the `data-reduced-motion`
  // override, matching the file today. `forced-reduced-motion` is a distinct
  // resolver context with no corresponding selector in this file.
  const reducedMotionOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeDocuments(refsFor(documentsByPath, motionModifier.contexts['reduced']!)),
    '',
    undefined,
    reducedMotionOverrides,
  );

  const rootDeclarations = renderBaseDeclarations(baseIndex);
  const darkDeclarations = renderOverrideDeclarations(darkOverrides, baseIndex);
  const lightDeclarations = renderOverrideDeclarations(lightOverrides, baseIndex);
  const reducedMotionDeclarations = renderOverrideDeclarations(reducedMotionOverrides, baseIndex);

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
${reducedMotionDeclarations}
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

async function buildResolvedContexts(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Promise<Map<string, string>> {
  const baseDocuments = refsFor(documentsByPath, resolver.sets['foundation']!.sources);
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
    const documents = [
      ...baseDocuments,
      ...refsFor(documentsByPath, themeContext),
      ...refsFor(documentsByPath, motionContext),
    ];
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
