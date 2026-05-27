/**
 * P7 acceptance pins for Callout's directional stripe, asserted against the
 * CSS source with `postcss` (the same parser-based approach as
 * `src/test/focus-ring-recipe.test.ts` — happy-dom does not compute styles
 * from stylesheets, and the package ships no browser-test harness).
 *
 * Rather than checking for the presence/absence of single properties, each
 * assertion folds every border-affecting declaration (shorthand, longhand,
 * physical, and logical) from the base rule then the variant rule, in source
 * order, into an effective per-side width/color model — the same resolution
 * the browser performs. This resists future shorthand escape hatches that
 * could quietly lift a non-start edge to the stripe width or mute the stripe.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { parse, type Declaration, type Root, type Rule } from 'postcss';

function loadCss(relativePath: string): string {
  const fullPath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(fullPath, 'utf8');
}

const calloutCss = loadCss('./callout.css');

type Side = 'inline-start' | 'inline-end' | 'block-start' | 'block-end';

const SIDES: Side[] = ['inline-start', 'inline-end', 'block-start', 'block-end'];

type BorderModel = Record<Side, { width?: string; color?: string }>;

function emptyModel(): BorderModel {
  return {
    'inline-start': {},
    'inline-end': {},
    'block-start': {},
    'block-end': {},
  };
}

function setAll(model: BorderModel, field: 'width' | 'color', value: string) {
  for (const side of SIDES) model[side][field] = value;
}

/**
 * Parse a `border` / `border-<side>` shorthand into width + color where they
 * appear. The grammar is `<width> || <style> || <color>` with width/color
 * optional. We only care about width and color. Width is the token that is a
 * length (ends in px/em/rem or is a keyword thin/medium/thick); style is one
 * of the named line styles; everything else (including `light-dark(...)` and
 * `var(...)` and named colors) is treated as the color.
 */
const LINE_STYLES = new Set([
  'none',
  'hidden',
  'dotted',
  'dashed',
  'solid',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
]);

function isWidthToken(token: string): boolean {
  return /^[\d.]+(px|em|rem|%)$/.test(token) || token === 'thin' || token === 'medium' || token === 'thick';
}

function splitTopLevel(value: string): string[] {
  // Split on whitespace but keep parenthesized groups (light-dark(...),
  // oklch(...), var(...)) intact.
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (/\s/.test(char) && depth === 0) {
      if (current) tokens.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function parseShorthand(value: string): { width?: string; color?: string } {
  const result: { width?: string; color?: string } = {};
  for (const token of splitTopLevel(value)) {
    if (isWidthToken(token)) {
      result.width = token;
    } else if (LINE_STYLES.has(token)) {
      // style — ignored
    } else {
      result.color = token;
    }
  }
  return result;
}

/** Fold one declaration into the per-side model. */
function foldDecl(model: BorderModel, decl: Declaration) {
  const property = decl.prop;
  const value = decl.value;

  // Whole-box shorthands.
  if (property === 'border') {
    const { width, color } = parseShorthand(value);
    if (width !== undefined) setAll(model, 'width', width);
    if (color !== undefined) setAll(model, 'color', color);
    return;
  }
  if (property === 'border-width') {
    setAll(model, 'width', value);
    return;
  }
  if (property === 'border-color') {
    setAll(model, 'color', value);
    return;
  }
  if (property === 'border-style') return;

  // Logical axis shorthands.
  const axisMap: Record<string, Side[]> = {
    'border-inline': ['inline-start', 'inline-end'],
    'border-block': ['block-start', 'block-end'],
  };
  for (const [prefix, sides] of Object.entries(axisMap)) {
    if (property === prefix) {
      const { width, color } = parseShorthand(value);
      for (const side of sides) {
        if (width !== undefined) model[side].width = width;
        if (color !== undefined) model[side].color = color;
      }
      return;
    }
    if (property === `${prefix}-width`) {
      for (const side of sides) model[side].width = value;
      return;
    }
    if (property === `${prefix}-color`) {
      for (const side of sides) model[side].color = value;
      return;
    }
  }

  // Per-side logical and physical longhands.
  const sideMap: Record<string, Side> = {
    'border-inline-start': 'inline-start',
    'border-inline-end': 'inline-end',
    'border-block-start': 'block-start',
    'border-block-end': 'block-end',
    // Physical sides map to logical sides under the default horizontal-tb,
    // ltr writing mode the components assume.
    'border-left': 'inline-start',
    'border-right': 'inline-end',
    'border-top': 'block-start',
    'border-bottom': 'block-end',
  };
  for (const [prefix, side] of Object.entries(sideMap)) {
    if (property === prefix) {
      const { width, color } = parseShorthand(value);
      if (width !== undefined) model[side].width = width;
      if (color !== undefined) model[side].color = color;
      return;
    }
    if (property === `${prefix}-width`) {
      model[side].width = value;
      return;
    }
    if (property === `${prefix}-color`) {
      model[side].color = value;
      return;
    }
  }
}

function findRule(root: Root, selector: string): Rule {
  let match: Rule | undefined;
  root.walkRules((rule) => {
    // Skip rules nested inside @media (forced-colors etc.) — we only resolve
    // the normal (non-forced) cascade the acceptance criteria reference.
    if (rule.parent?.type === 'atrule') return undefined;
    if (rule.selectors.includes(selector)) {
      match = rule;
      return false;
    }
    return undefined;
  });
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match;
}

function foldRule(model: BorderModel, rule: Rule) {
  rule.walkDecls((decl) => foldDecl(model, decl));
}

/** Resolve the effective border model for a variant: base then variant. */
function resolveVariant(root: Root, variant: string): BorderModel {
  const model = emptyModel();
  foldRule(model, findRule(root, '.cinder-callout'));
  foldRule(model, findRule(root, `.cinder-callout[data-cinder-variant='${variant}']`));
  return model;
}

function widthPx(value: string | undefined): number {
  if (!value) return 0;
  const match = /^([\d.]+)px$/.exec(value);
  if (!match) throw new Error(`expected a px width, got: ${value}`);
  return Number(match[1]);
}

/** Extract the two arms of a light-dark(a, b) value. */
function lightDarkArms(value: string): [string, string] {
  const match = /^light-dark\(([\s\S]+)\)$/.exec(value.trim());
  if (!match) throw new Error(`expected light-dark(), got: ${value}`);
  const inner = match[1];
  // Split on the top-level comma.
  let depth = 0;
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      return [inner.slice(0, index).trim(), inner.slice(index + 1).trim()];
    }
  }
  throw new Error(`light-dark() missing comma separator: ${value}`);
}

/** Pull the C (chroma) component out of an `oklch(from var(...) L C h)` arm. */
function oklchChroma(arm: string): number {
  const match = /oklch\(\s*from\s+var\([^)]+\)\s+[\d.%]+\s+([\d.]+)\s+h\s*\)/.exec(arm);
  if (!match) throw new Error(`expected oklch(from var(...) L C h), got: ${arm}`);
  return Number(match[1]);
}

const VARIANTS: Array<{ variant: string; token: string }> = [
  { variant: 'info', token: '--cinder-info' },
  { variant: 'success', token: '--cinder-success' },
  { variant: 'warning', token: '--cinder-warning' },
  { variant: 'danger', token: '--cinder-danger' },
];

const root = parse(calloutCss);

describe('callout stripe — directional treatment', () => {
  for (const { variant, token } of VARIANTS) {
    describe(`variant: ${variant}`, () => {
      const model = resolveVariant(root, variant);

      test('inline-start width is >= 4px and strictly greater than inline-end', () => {
        // Border widths are not theme-branched (no light-dark on widths), so
        // this dominance holds identically in light and dark.
        const start = widthPx(model['inline-start'].width);
        const end = widthPx(model['inline-end'].width);
        expect(start).toBeGreaterThanOrEqual(4);
        expect(start).toBeGreaterThan(end);
      });

      test('other borders are 1px', () => {
        expect(widthPx(model['inline-end'].width)).toBe(1);
        expect(widthPx(model['block-start'].width)).toBe(1);
        expect(widthPx(model['block-end'].width)).toBe(1);
      });

      test('stripe color derives from the matching status token in both schemes', () => {
        const color = model['inline-start'].color;
        expect(color).toBeDefined();
        const [light, dark] = lightDarkArms(color!);
        const pattern = new RegExp(`oklch\\(\\s*from\\s+var\\(${token}\\)`);
        expect(light).toMatch(pattern);
        expect(dark).toMatch(pattern);
      });

      test('stripe chroma strictly exceeds the soft border chroma in both schemes', () => {
        // The variant rule's border-color (soft border) and the stripe both
        // use oklch(from var(--cinder-<status>) L C h); pin C(stripe) > C(soft)
        // so a future edit can't mute the stripe to the soft border's chroma.
        const variantRule = findRule(root, `.cinder-callout[data-cinder-variant='${variant}']`);
        let softBorder: string | undefined;
        let stripe: string | undefined;
        variantRule.walkDecls('border-color', (decl) => {
          softBorder = decl.value;
        });
        variantRule.walkDecls('border-inline-start-color', (decl) => {
          stripe = decl.value;
        });
        expect(softBorder).toBeDefined();
        expect(stripe).toBeDefined();

        const [softLight, softDark] = lightDarkArms(softBorder!);
        const [stripeLight, stripeDark] = lightDarkArms(stripe!);
        expect(oklchChroma(stripeLight)).toBeGreaterThan(oklchChroma(softLight));
        expect(oklchChroma(stripeDark)).toBeGreaterThan(oklchChroma(softDark));
      });

      test('stripe color is declared after border-color so it wins the cascade', () => {
        const variantRule = findRule(root, `.cinder-callout[data-cinder-variant='${variant}']`);
        const props = variantRule.nodes
          .filter((node): node is Declaration => node.type === 'decl')
          .map((decl) => decl.prop);
        const borderColorIndex = props.indexOf('border-color');
        const stripeIndex = props.indexOf('border-inline-start-color');
        expect(borderColorIndex).toBeGreaterThanOrEqual(0);
        expect(stripeIndex).toBeGreaterThan(borderColorIndex);
      });
    });
  }
});
