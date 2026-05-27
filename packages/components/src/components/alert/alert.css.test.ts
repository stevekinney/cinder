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
 * Every property that affects a border side's width or color. A variant rule
 * containing any of these would reintroduce a colored frame (or a stripe), so
 * the acceptance test requires the set to be empty in each variant rule.
 * `border-style` is excluded only because style alone can't recreate a colored
 * frame — but it is harmless and not present; `border-radius` is not a border
 * width/color property and is allowed.
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
  return findRules(selector)[0];
}

const VARIANTS = ['info', 'success', 'warning', 'error'];

describe('alert chrome reduction — border-equals-base', () => {
  test('base rule declares exactly border: 1px solid var(--cinder-border)', () => {
    // The base selector appears in two rules (one declares the scoped
    // --cinder-alert-info token, the other the box). Fold across both.
    let border: string | undefined;
    for (const rule of findRules('.cinder-alert')) {
      rule.walkDecls('border', (decl) => {
        border = decl.value;
      });
    }
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
