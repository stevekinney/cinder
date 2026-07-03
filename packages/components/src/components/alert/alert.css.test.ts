/**
 * Acceptance pins for Alert's border chrome, asserted against the CSS source
 * with `postcss` (parser-based, mirroring `src/test/focus-ring-recipe.test.ts`;
 * happy-dom does not compute styles from stylesheets).
 *
 * Post-P7 reversal: Alert now composes the shared soft-border recipe
 * (`.cinder-_status-surface-border`, see `_status-surface.css`), matching
 * Banner's per-variant colored border instead of the pre-P7 neutral one — see
 * `alert.css`'s "post-P7 reversal" comment for the accessibility rationale
 * (the shared recipe is contrast-checked; the original saturated border that
 * P7 removed was not).
 *
 * `alert.css`'s own variant rules still carry ZERO border-affecting
 * declarations — blocking every shorthand escape hatch (`border`,
 * `border-left`, `border-inline`, `border-width`, logical/physical
 * longhands) so no future edit reintroduces a hardcoded per-variant border
 * here that could conflict with the composed recipe. The base `.cinder-alert`
 * rule's `border: 1px solid var(--cinder-border)` is the FALLBACK only —
 * it's what resolves when the border-surface class is absent (e.g. a
 * consumer overriding `class`); with the class composed, the shared
 * partial's higher-specificity (0,2,0) rule wins and paints the per-variant
 * color instead. inline-start width still equals inline-end width (both
 * 1px) because both the fallback and the composed rule set `border-color`/
 * `border` uniformly, never a single edge.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { parse, type AtRule, type Declaration, type Rule } from 'postcss';

function loadCss(relativePath: string): string {
  const fullPath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(fullPath, 'utf8');
}

const alertCss = loadCss('./alert.css');
const root = parse(alertCss);

// The variant-tinted background + foreground + border algebra lives in the
// shared `_status-surface.css` partial; Alert composes `.cinder-_status-surface`
// and `.cinder-_status-surface-border` (NOT `-stripe` — the directional stripe
// stays exclusive to Callout). Variant rules set the partial's
// `--_cinder-status-base` tint input. So the "still tinted, not flattened to
// surface" criterion is pinned in two places: the variant rule sets a
// status-derived base here, and the partial synthesizes the tint (and border
// color) from it.
const statusSurfaceCss = loadCss('../../styles/components/_status-surface.css');
const statusSurfaceRoot = parse(statusSurfaceCss);

function findRuleInPartial(selector: string): Rule {
  let match: Rule | undefined;
  statusSurfaceRoot.walkRules((rule) => {
    if (rule.selectors.includes(selector)) {
      match = rule;
      return false;
    }
    return undefined;
  });
  if (!match) throw new Error(`partial rule not found: ${selector}`);
  return match;
}

/**
 * Every property that can paint or size a border edge — shorthands, longhands,
 * physical sides, logical sides, and the `border-image` family (which can draw
 * a colored frame or stripe without touching `border-color`/`border-width` at
 * all). A variant rule containing any of these would reintroduce status-colored
 * chrome, so the acceptance test requires the set to be empty in each variant.
 * `border-style` is included as belt-and-suspenders even though style alone
 * can't recreate a colored frame; `border-radius` is not a border width/color
 * property and is intentionally absent.
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
 * A rule is "effectively top-level" when the only at-rules between it and the
 * stylesheet root are `@layer` wrappers. Component CSS now self-declares
 * `@layer cinder.components { … }`, so the base rules sit one `@layer` deep;
 * that wrapper is transparent. Rules under `@media` / `@supports` /
 * `@container` (e.g. the forced-colors block) are NOT top-level and are skipped.
 */
function isEffectivelyTopLevel(rule: Rule): boolean {
  let ancestor = rule.parent;
  while (ancestor && ancestor.type !== 'root') {
    if (ancestor.type === 'atrule' && (ancestor as AtRule).name !== 'layer') return false;
    ancestor = ancestor.parent;
  }
  return true;
}

function findRules(selector: string): Rule[] {
  const matches: Rule[] = [];
  root.walkRules((rule) => {
    if (!isEffectivelyTopLevel(rule)) return undefined;
    if (rule.selectors.includes(selector)) matches.push(rule);
    return undefined;
  });
  if (matches.length === 0) throw new Error(`rule not found: ${selector}`);
  return matches;
}

function findRule(selector: string): Rule {
  const [first] = findRules(selector);
  if (!first) throw new Error(`rule not found: ${selector}`);
  return first;
}

const VARIANTS = ['info', 'success', 'warning', 'danger'];

describe('alert chrome — composed status-surface border', () => {
  test('inline-start width EQUALS inline-end width (no stripe — relationship, not magic number)', () => {
    // Alert must NOT have a dominant start edge — start width must equal end
    // width. Prove it structurally: walk the base rules for .cinder-alert and
    // assert the only border-affecting declaration is the `border` shorthand
    // (which sets every edge to the same value). Any future edit that adds a
    // width longhand would appear here and fail. Uses the existing
    // BORDER_AFFECTING set — no separate subset needed.
    const widthDeclarations: string[] = [];
    for (const rule of findRules('.cinder-alert')) {
      rule.walkDecls((decl) => {
        if (BORDER_AFFECTING.has(decl.prop)) widthDeclarations.push(decl.prop);
      });
    }
    // Exactly one entry, the base `border` shorthand — a shorthand sets every
    // edge identically, so inline-start === inline-end by construction.
    expect(widthDeclarations).toEqual(['border']);
  });

  test('base rule declares the neutral FALLBACK border: 1px solid var(--cinder-border)', () => {
    // The base selector appears in two rules (one declares the scoped
    // --cinder-alert-info token, the other the box). Exactly one of them must
    // declare `border`. This is the fallback that resolves only when the
    // composed `.cinder-_status-surface-border` class is absent — with it
    // composed (see alert.svelte), the shared partial's higher-specificity
    // (0,2,0) rule wins and paints the per-variant color instead.
    let border: string | undefined;
    let count = 0;
    for (const rule of findRules('.cinder-alert')) {
      rule.walkDecls('border', (decl) => {
        border = decl.value;
        count += 1;
      });
    }
    expect(count).toBe(1);
    expect(border).toBe('1px solid var(--cinder-border)');
  });

  for (const variant of VARIANTS) {
    describe(`variant: ${variant}`, () => {
      const rule = findRule(`.cinder-alert[data-cinder-variant='${variant}']`);

      test('contains zero border-affecting declarations directly (no hardcoded per-variant border here)', () => {
        // The per-variant border color comes from the composed shared partial
        // (see the "composed status-surface border" test below), not from a
        // declaration on this rule. A future edit adding one here would
        // conflict with or shadow the partial's (0,2,0) rule.
        const borderProps = rule.nodes
          .filter((node): node is Declaration => node.type === 'decl')
          .map((decl) => decl.prop)
          .filter((prop) => BORDER_AFFECTING.has(prop));
        expect(borderProps).toEqual([]);
      });

      test('sets a status-derived base tint input (not flattened to surface)', () => {
        // The variant tint is no longer an inline background-color; it is driven
        // by the --_cinder-status-base input the shared partial consumes. Assert
        // the variant routes to a status color (a --cinder-* token), so the
        // surface stays tinted rather than collapsing to the neutral base.
        let base: string | undefined;
        rule.walkDecls('--_cinder-status-base', (decl) => {
          base = decl.value;
        });
        expect(base).toBeDefined();
        expect(base).toMatch(/^var\(--cinder-/);
      });
    });
  }

  test('the composed surface partial synthesizes a variant-tinted light-dark(oklch(...)) background', () => {
    // The actual tint lives in the partial Alert composes; confirm it is still a
    // relative-color light-dark surface derived from the base input, so no future
    // edit flattens Alert to a plain neutral surface.
    // Selector is self-doubled (.x.x) for (0,2,0) specificity over the component base.
    const surfaceRule = findRuleInPartial('.cinder-_status-surface.cinder-_status-surface');
    let background: string | undefined;
    surfaceRule.walkDecls('background-color', (decl) => {
      background = decl.value;
    });
    expect(background).toBeDefined();
    expect(background).toMatch(/^light-dark\(/);
    expect(background).toMatch(/oklch\(\s*from\s+var\(--_cinder-status-base\)/);
  });

  test('alert.svelte composes the shared border-surface class', () => {
    // The border-color assertion above (partial synthesizes a variant-derived
    // border-color) only proves the RECIPE exists — it doesn't prove Alert
    // actually uses it. Pin that alert.svelte's root classNames() call
    // includes 'cinder-_status-surface-border' so a future edit can't silently
    // drop the composition and regress to the pre-reversal neutral border.
    const alertSvelte = loadCss('./alert.svelte');
    expect(alertSvelte).toMatch(/['"]cinder-_status-surface-border['"]/);
  });

  test('the composed border-surface partial synthesizes a variant-tinted light-dark(oklch(...)) border-color', () => {
    // The actual per-variant border color lives in the partial Alert composes
    // (.cinder-_status-surface-border); confirm it derives from the same
    // --_cinder-status-base input as the background, so no future edit
    // flattens Alert back to a hardcoded neutral border.
    // Selector is self-doubled (.x.x) for (0,2,0) specificity over the component base.
    const borderRule = findRuleInPartial(
      '.cinder-_status-surface-border.cinder-_status-surface-border',
    );
    let borderColor: string | undefined;
    borderRule.walkDecls('border-color', (decl) => {
      borderColor = decl.value;
    });
    expect(borderColor).toBeDefined();
    expect(borderColor).toMatch(/^light-dark\(/);
    expect(borderColor).toMatch(/oklch\(\s*from\s+var\(--_cinder-status-base\)/);
  });
});
