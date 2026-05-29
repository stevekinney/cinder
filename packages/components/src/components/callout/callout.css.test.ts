/**
 * P7 acceptance pins for Callout's directional stripe, asserted against the
 * CSS source with `postcss` (the same parser-based approach as
 * `src/test/focus-ring-recipe.test.ts` — happy-dom does not compute styles
 * from stylesheets, and the package ships no browser-test harness).
 *
 * The Callout CSS is deliberate and narrow: the base rule sets the box border
 * plus the 4px inline-start stripe width, and each variant rule sets exactly
 * the soft `border-color` and the saturated `border-inline-start-color`. So
 * rather than simulating the full cascade, the tests pin that exact shape — a
 * variant rule may only touch those two border properties (any other
 * border-affecting declaration, shorthand or longhand, fails the test), the
 * stripe color is declared after the soft border so it wins the cascade, both
 * derive from the matching status token, and the stripe's chroma is strictly
 * higher than the soft border's so the stripe reads as "visibly stronger."
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { parse, type AtRule, type Declaration, type Rule } from 'postcss';

function loadCss(relativePath: string): string {
  const fullPath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(fullPath, 'utf8');
}

const calloutCss = loadCss('./callout.css');
const root = parse(calloutCss);

/**
 * Every property that can paint or size a border edge — shorthands, longhands,
 * physical sides, logical sides, and the `border-image` family (which can draw
 * a directional stripe without touching `border-color`/`border-width` at all).
 * A variant rule is allowed to use only the subset in `ALLOWED_VARIANT_BORDER`;
 * anything else here is an escape hatch the tests must reject.
 */
const BORDER_AFFECTING = new Set([
  'border',
  'border-width',
  'border-color',
  'border-style',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-inline',
  'border-inline-start',
  'border-inline-end',
  'border-inline-width',
  'border-inline-color',
  'border-inline-start-width',
  'border-inline-end-width',
  'border-inline-start-color',
  'border-inline-end-color',
  'border-block',
  'border-block-start',
  'border-block-end',
  'border-block-width',
  'border-block-color',
  'border-block-start-width',
  'border-block-end-width',
  'border-block-start-color',
  'border-block-end-color',
  'border-image',
  'border-image-source',
  'border-image-slice',
  'border-image-width',
  'border-image-outset',
  'border-image-repeat',
]);

/**
 * The only border declarations a Callout variant rule may carry: the soft box
 * border color and the saturated inline-start stripe color. Everything else in
 * BORDER_AFFECTING would either lift a non-start edge to the stripe width, mute
 * the stripe, or paint a competing border-image — all regressions.
 */
const ALLOWED_VARIANT_BORDER = ['border-color', 'border-inline-start-color'];

/**
 * Find the single non-`@media` rule for a selector. The forced-colors block
 * reuses `.cinder-callout`, so skipping `atrule` parents keeps us on the base
 * rule whose cascade the acceptance criteria reference.
 */
/**
 * A rule is "effectively top-level" when the only at-rules between it and the
 * stylesheet root are `@layer` wrappers. Component CSS now self-declares
 * `@layer cinder.components { … }`, so the base rules sit one `@layer` deep;
 * that wrapper is transparent for cascade purposes. Rules nested under
 * `@media` / `@supports` / `@container` (e.g. the forced-colors block) are NOT
 * top-level and must still be skipped.
 */
function isEffectivelyTopLevel(rule: Rule): boolean {
  let ancestor = rule.parent;
  while (ancestor && ancestor.type !== 'root') {
    if (ancestor.type === 'atrule' && (ancestor as AtRule).name !== 'layer') return false;
    ancestor = ancestor.parent;
  }
  return true;
}

function findRule(selector: string): Rule {
  let match: Rule | undefined;
  root.walkRules((rule) => {
    if (!isEffectivelyTopLevel(rule)) return undefined;
    if (rule.selectors.includes(selector)) {
      match = rule;
      return false;
    }
    return undefined;
  });
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match;
}

function declValue(rule: Rule, property: string): string | undefined {
  let value: string | undefined;
  rule.walkDecls(property, (decl) => {
    value = decl.value;
  });
  return value;
}

function borderProps(rule: Rule): string[] {
  return rule.nodes
    .filter((node): node is Declaration => node.type === 'decl')
    .map((decl) => decl.prop)
    .filter((prop) => BORDER_AFFECTING.has(prop));
}

/**
 * Pull the chroma (C) out of an `oklch(from var(--token) L C h)` color. Only
 * this exact relative-color form is accepted — a literal `oklch(L C h)` or a
 * differently shaped value returns NaN, so a malformed stripe color fails the
 * comparison cleanly instead of silently matching.
 */
function oklchChroma(arm: string): number {
  const match = /oklch\(\s*from\s+var\([^)]+\)\s+[\d.%]+\s+([\d.]+)\s+h\s*\)/.exec(arm);
  return match ? Number(match[1]) : Number.NaN;
}

/** Split a `light-dark(a, b)` value into its two arms on the top-level comma. */
function lightDarkArms(value: string): [string, string] {
  const match = /^light-dark\(([\s\S]+)\)$/.exec(value.trim());
  if (!match?.[1]) throw new Error(`expected light-dark(), got: ${value}`);
  const inner = match[1];
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

const VARIANTS: Array<{ variant: string; token: string }> = [
  { variant: 'info', token: '--cinder-info' },
  { variant: 'success', token: '--cinder-success' },
  { variant: 'warning', token: '--cinder-warning' },
  { variant: 'danger', token: '--cinder-danger' },
];

/**
 * Parse a CSS length like `4px`, `1px`, or `0.5rem` into a number of pixels.
 * Only `px` and unitless `0` are accepted — every border width in this sheet is
 * authored in px. Keyword widths (`thin`, `medium`, `thick`) and relative units
 * (em/rem/%) return NaN, which fails the relationship comparison cleanly instead
 * of silently passing with a wrong value.
 */
function pxWidth(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '0') return 0;
  const match = /^([\d.]+)px$/.exec(trimmed);
  return match ? Number(match[1]) : Number.NaN;
}

/**
 * Extract the width from a `border` shorthand like `1px solid var(--cinder-border)`.
 * The width is the first space-separated component that parses as a px length;
 * `solid`, `var(...)`, and keyword widths are skipped (keywords return NaN from
 * pxWidth, causing the test to fail rather than silently pass with a wrong value).
 */
function borderShorthandWidth(value: string): number {
  for (const part of value.trim().split(/\s+/)) {
    const width = pxWidth(part);
    if (!Number.isNaN(width)) return width;
  }
  return Number.NaN;
}

describe('callout stripe — directional treatment', () => {
  test('base rule sets the box border and the 4px inline-start stripe width', () => {
    // Stripe width is not theme-branched (no light-dark on widths), so the 4px
    // dominance holds identically in light and dark.
    const base = findRule('.cinder-callout');
    expect(declValue(base, 'border')).toBe('1px solid var(--cinder-border)');
    expect(declValue(base, 'border-inline-start-width')).toBe('4px');
  });

  test('inline-start width is strictly GREATER than inline-end width (relationship, not magic number)', () => {
    // P6-C2 acceptance: Callout's start edge must dominate its end edge. Derive
    // both widths from the source rather than hardcoding 4px > 1px so a token
    // change (e.g. base border 1px → 2px, stripe 4px → 6px) keeps the test green
    // as long as the start-dominates-end RELATIONSHIP holds. No variant rule
    // touches a width longhand (asserted below), so the inline-end width is the
    // base `border` shorthand width and the inline-start width is the explicit
    // base longhand. Widths are not theme-branched, so this holds in both
    // schemes and is asserted once.
    const base = findRule('.cinder-callout');
    const endWidth = borderShorthandWidth(declValue(base, 'border')!);
    const startWidth = pxWidth(declValue(base, 'border-inline-start-width')!);
    expect(Number.isNaN(endWidth)).toBe(false);
    expect(Number.isNaN(startWidth)).toBe(false);
    expect(startWidth).toBeGreaterThan(endWidth);
  });

  for (const { variant, token } of VARIANTS) {
    const tokenPattern = new RegExp(`oklch\\(\\s*from\\s+var\\(${token}\\)`);

    describe(`variant: ${variant}`, () => {
      const rule = findRule(`.cinder-callout[data-cinder-variant='${variant}']`);

      test('touches only the soft border-color and the inline-start stripe color', () => {
        // Rejects every other border escape hatch: a `border`/`border-width`
        // shorthand or a physical/block longhand that would lift a non-start
        // edge to 4px, and any `border-image` that would paint a competing
        // stripe. With only these two, the non-start edges stay at the base
        // rule's 1px and the stripe stays 4px.
        expect(borderProps(rule).toSorted()).toEqual(ALLOWED_VARIANT_BORDER);
      });

      test('stripe color is declared after border-color so it wins the cascade', () => {
        const props = rule.nodes
          .filter((node): node is Declaration => node.type === 'decl')
          .map((decl) => decl.prop);
        expect(props.indexOf('border-inline-start-color')).toBeGreaterThan(
          props.indexOf('border-color'),
        );
      });

      test('stripe color derives from the matching status token in both schemes', () => {
        const stripe = declValue(rule, 'border-inline-start-color');
        expect(stripe).toBeDefined();
        const [light, dark] = lightDarkArms(stripe!);
        expect(light).toMatch(tokenPattern);
        expect(dark).toMatch(tokenPattern);
      });

      test('stripe chroma strictly exceeds the soft border chroma in both schemes', () => {
        // Pins "visibly stronger": soft border and stripe both use
        // oklch(from var(--cinder-<status>) L C h); assert C(stripe) > C(soft)
        // per scheme so a future edit can't mute the stripe to the soft chroma.
        const soft = declValue(rule, 'border-color');
        const stripe = declValue(rule, 'border-inline-start-color');
        expect(soft).toBeDefined();
        expect(stripe).toBeDefined();

        const [softLight, softDark] = lightDarkArms(soft!);
        const [stripeLight, stripeDark] = lightDarkArms(stripe!);
        expect(oklchChroma(stripeLight)).toBeGreaterThan(oklchChroma(softLight));
        expect(oklchChroma(stripeDark)).toBeGreaterThan(oklchChroma(softDark));
      });
    });
  }
});
