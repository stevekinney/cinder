/**
 * P7 acceptance pins for Alert's chrome reduction, asserted against the CSS
 * source with `postcss` (parser-based, mirroring
 * `src/test/focus-ring-recipe.test.ts`; happy-dom does not compute styles from
 * stylesheets).
 *
 * Chosen outcome (see the task plan): border-equals-base. Every Alert variant
 * sheds its colored border so the effective border-color resolves to the base
 * `var(--cinder-border)` in both schemes, while the soft variant background
 * tint and variant text color are retained. Alert stays stripe-free; the
 * directional color cue belongs exclusively to Callout.
 *
 * The "no stripe / border-equals-base" guarantee is enforced by asserting the
 * variant rules contain ZERO border-affecting declarations — blocking every
 * shorthand escape hatch (`border`, `border-left`, `border-inline`,
 * `border-width`, logical/physical longhands), not just the inline-start
 * longhands. With no variant border declaration, the base rule's
 * `border: 1px solid var(--cinder-border)` is what every side resolves to, so
 * inline-start width is not greater than inline-end (both 1px) and the
 * border-color equals the base border color.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { parse, type Declaration, type Rule } from 'postcss';

function loadCss(relativePath: string): string {
  const fullPath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(fullPath, 'utf8');
}

const alertCss = loadCss('./alert.css');
const root = parse(alertCss);

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

function findRules(selector: string): Rule[] {
  const matches: Rule[] = [];
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule') return undefined;
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

const VARIANTS = ['info', 'success', 'warning', 'error'];

describe('alert chrome reduction — border-equals-base', () => {
  test('inline-start width EQUALS inline-end width (no stripe — relationship, not magic number)', () => {
    // P6-C2 acceptance: Alert must NOT have a dominant start edge — start width
    // must equal end width. Prove it structurally: walk the base rules for
    // .cinder-alert and assert the only border-affecting declaration is the
    // `border` shorthand (which sets every edge to the same value). Any future
    // edit that adds a width longhand would appear here and fail. Uses the
    // existing BORDER_AFFECTING set — no separate subset needed.
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

  test('base rule declares exactly border: 1px solid var(--cinder-border)', () => {
    // The base selector appears in two rules (one declares the scoped
    // --cinder-alert-info token, the other the box). Exactly one of them must
    // declare `border`, and it must be the neutral base border.
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

      test('contains zero border-affecting declarations (no stripe, no colored frame)', () => {
        const borderProps = rule.nodes
          .filter((node): node is Declaration => node.type === 'decl')
          .map((decl) => decl.prop)
          .filter((prop) => BORDER_AFFECTING.has(prop));
        expect(borderProps).toEqual([]);
      });

      test('background-color is still a variant-tinted light-dark(oklch(...)) (not flattened to surface)', () => {
        let background: string | undefined;
        rule.walkDecls('background-color', (decl) => {
          background = decl.value;
        });
        expect(background).toBeDefined();
        expect(background).toMatch(/^light-dark\(/);
        expect(background).toMatch(/oklch\(\s*from\s+var\(--cinder-/);
      });
    });
  }
});
