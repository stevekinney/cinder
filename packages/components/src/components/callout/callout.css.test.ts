/**
 * P7 acceptance pins for Callout's directional stripe, asserted against the
 * CSS source with `postcss` (the same parser-based approach as
 * `src/test/focus-ring-recipe.test.ts` — happy-dom does not compute styles
 * from stylesheets, and the package ships no browser-test harness).
 *
 * The Callout CSS is deliberate and narrow: the base rule sets the box border
 * plus the 4px inline-start stripe width. The soft `border-color` and saturated
 * `border-inline-start-color` algebra now lives in the shared
 * `_status-surface.css` partial, so each variant rule only sets the partial's
 * per-variant inputs (`--_cinder-status-base` + the foreground/stripe chroma).
 * The tests pin that split shape: a variant rule may carry NO border-affecting
 * declaration (any shorthand or longhand fails the test), and the partial
 * declares the stripe after the soft border so it wins the cascade, both derive
 * from `--_cinder-status-base`, and the stripe chroma strictly exceeds the
 * fixed soft-border chroma so the stripe reads as "visibly stronger."
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

// The soft-surface color algebra (border + stripe) now lives in the shared
// `_status-surface.css` partial, consumed by Callout via the
// `.cinder-_status-surface*` classes. Callout's variant rules only set the
// partial's per-variant inputs. The stripe-vs-border acceptance criteria are
// therefore split: the input wiring is pinned on the variant rules here, and the
// algebra (stripe declared after border, both derive from --_cinder-status-base,
// stripe chroma exceeds the fixed soft-border chroma) is pinned on the partial.
const statusSurfaceCss = loadCss('../../styles/components/_status-surface.css');
const statusSurfaceRoot = parse(statusSurfaceCss);

function findRuleIn(parsedRoot: ReturnType<typeof parse>, selector: string): Rule {
  let match: Rule | undefined;
  parsedRoot.walkRules((rule) => {
    if (rule.selectors.includes(selector)) {
      match = rule;
      return false;
    }
    return undefined;
  });
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match;
}

/** The fixed soft-border chroma in the partial (uniform across variants). */
const SOFT_BORDER_CHROMA = { light: 0.05, dark: 0.08 };

/**
 * Every property that can paint or size a border edge — shorthands, longhands,
 * physical sides, logical sides, and the `border-image` family (which can draw
 * a directional stripe without touching `border-color`/`border-width` at all).
 * A variant rule may carry NONE of these; the soft border and stripe colors all
 * live in the shared partial now, so any border-affecting declaration appearing
 * on a variant rule is an escape hatch the tests must reject.
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
    describe(`variant: ${variant}`, () => {
      const rule = findRule(`.cinder-callout[data-cinder-variant='${variant}']`);

      test('carries no border declarations — the algebra lives in the shared partial', () => {
        // The soft border and stripe colors moved to `_status-surface.css`.
        // A variant rule must NOT reintroduce any border-affecting declaration
        // (shorthand or longhand): doing so would lift a non-start edge to 4px,
        // mute the stripe, or paint a competing border-image — all regressions.
        expect(borderProps(rule)).toEqual([]);
      });

      test('sets the status base color to the matching status token', () => {
        expect(declValue(rule, '--_cinder-status-base')).toBe(`var(${token})`);
      });

      test('sets a stripe chroma input that strictly exceeds the fixed soft-border chroma', () => {
        // "Visibly stronger" is now pinned as: the per-variant stripe chroma
        // input is greater than the partial's fixed soft-border chroma in both
        // schemes, so a future edit cannot mute the stripe to the soft chroma.
        const stripeChroma = Number(declValue(rule, '--_cinder-status-stripe-chroma'));
        expect(stripeChroma).not.toBeNaN();
        expect(stripeChroma).toBeGreaterThan(SOFT_BORDER_CHROMA.light);
        expect(stripeChroma).toBeGreaterThan(SOFT_BORDER_CHROMA.dark);
      });

      test('sets both foreground chroma inputs (light + dark)', () => {
        expect(Number(declValue(rule, '--_cinder-status-fg-chroma-light'))).not.toBeNaN();
        expect(Number(declValue(rule, '--_cinder-status-fg-chroma-dark'))).not.toBeNaN();
      });
    });
  }

  describe('shared _status-surface partial — the relocated algebra', () => {
    // The recipe selectors are self-doubled (`.x.x`) to reach specificity (0,2,0)
    // — see the partial's header and the specificity test below.
    const borderRule = findRuleIn(
      statusSurfaceRoot,
      '.cinder-_status-surface-border.cinder-_status-surface-border',
    );
    const stripeRule = findRuleIn(
      statusSurfaceRoot,
      '.cinder-_status-surface-stripe.cinder-_status-surface-stripe',
    );

    test('recipe selectors are self-doubled for (0,2,0) specificity over the component base', () => {
      // The component base (`.cinder-callout`, etc.) sets `background`/`border` at
      // (0,1,0). The recipe must win regardless of import order (sidecar mode loads
      // the base AFTER the recipe), so each recipe selector doubles its class to
      // (0,2,0) — matching the pre-extraction variant-selector specificity. A
      // single-class selector here would regress to a source-order tie.
      const selectors: string[] = [];
      statusSurfaceRoot.walkRules((rule) => {
        for (const selector of rule.selectors) {
          if (/cinder-_status-surface/.test(selector)) selectors.push(selector);
        }
      });
      expect(selectors.length).toBeGreaterThan(0);
      for (const selector of selectors) {
        // Each must repeat its single class (e.g. `.x.x`) — reject a bare `.x`.
        const match = /^(\.cinder-_status-surface[a-z-]*)\1$/.exec(selector);
        expect(match, `selector "${selector}" must be self-doubled for (0,2,0)`).not.toBeNull();
      }
    });

    test('stripe rule is declared after the border rule so it wins the inline-start edge', () => {
      // Compare real RULE positions in the parsed AST, not substring offsets in
      // the source — the selector strings also appear in the header comment, so a
      // text search could pass even if the actual rules were swapped.
      const layer = stripeRule.parent;
      expect(layer).toBe(borderRule.parent);
      const nodes = (layer as { nodes?: unknown[] }).nodes ?? [];
      expect(nodes.indexOf(stripeRule)).toBeGreaterThan(nodes.indexOf(borderRule));
    });

    test('soft border and stripe both derive from --_cinder-status-base', () => {
      const border = declValue(borderRule, 'border-color');
      const stripe = declValue(stripeRule, 'border-inline-start-color');
      expect(border).toBeDefined();
      expect(stripe).toBeDefined();
      const basePattern = /oklch\(\s*from\s+var\(--_cinder-status-base\)/;
      const [bLight, bDark] = lightDarkArms(border!);
      const [sLight, sDark] = lightDarkArms(stripe!);
      expect(bLight).toMatch(basePattern);
      expect(bDark).toMatch(basePattern);
      expect(sLight).toMatch(basePattern);
      expect(sDark).toMatch(basePattern);
    });

    test('soft border uses the fixed soft-border chroma values', () => {
      const border = declValue(borderRule, 'border-color');
      const [light, dark] = lightDarkArms(border!);
      expect(oklchChroma(light)).toBe(SOFT_BORDER_CHROMA.light);
      expect(oklchChroma(dark)).toBe(SOFT_BORDER_CHROMA.dark);
    });
  });
});
