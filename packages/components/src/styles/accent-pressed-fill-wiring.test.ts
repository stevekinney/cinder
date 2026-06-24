/**
 * Wiring guard for the pressed-fill accent recipe.
 *
 * The primary `Button` and `FloatingActionButton` paint the dark-ink
 * `--cinder-accent-contrast` label on an accent fill. Their `:active` rules
 * must use `--cinder-accent-active-on-fill` (a gentle −0.11 lightness step),
 * NOT the general `--cinder-accent-active` (−0.15): on the darker L=0.66 light
 * accent, the −0.15 step resolves to L=0.51, where the dark-ink label drops to
 * ~4.09:1 — below WCAG AA. The on-fill token darkens by only 0.11 so the
 * pressed label stays AA-legible in both arms.
 *
 * The companion Playwright spec (`theme-parity-light-ladder.playwright.ts`)
 * proves the TOKEN clears 4.5:1 once the browser resolves its `oklch(from …)`
 * derivation. This parser-based test proves the other half — that the buttons
 * actually REFERENCE that token in their pressed state — so a regression that
 * swaps the `:active` fill back to `--cinder-accent-active` fails here even
 * though the token itself would still pass the contrast check. Raw string
 * matching is too brittle against CSS nesting, so we reuse `postcss` exactly
 * like `focus-ring-recipe.test.ts` does.
 *
 * Test files may use `any` per project conventions.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import { parse as parsePostcss, type Rule } from 'postcss';

function loadCss(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

/** Find the first rule whose selector contains every one of the given fragments. */
function findRuleContaining(css: string, fragments: string[]): Rule | undefined {
  let match: Rule | undefined;
  parsePostcss(css).walkRules((rule) => {
    const selector = rule.selector.replaceAll(/\s+/g, ' ');
    if (fragments.every((fragment) => selector.includes(fragment))) {
      match = rule;
      return false;
    }
    return undefined;
  });
  return match;
}

function backgroundOf(rule: Rule | undefined): string | undefined {
  if (!rule) return undefined;
  let value: string | undefined;
  rule.walkDecls('background', (decl) => {
    value = decl.value;
  });
  return value;
}

const PRESSED_FILL_TOKEN = 'var(--cinder-accent-active-on-fill)';

const cases = [
  {
    name: 'primary Button',
    css: loadCss('../components/button/button.css'),
    selectorFragments: ["[data-cinder-variant='primary']", ':active'],
  },
  {
    name: 'primary FloatingActionButton',
    css: loadCss('../components/floating-action-button/floating-action-button.css'),
    selectorFragments: ["[data-cinder-variant='primary']", ':active'],
  },
] as const;

describe('pressed-fill accent wiring', () => {
  for (const { name, css, selectorFragments } of cases) {
    test(`${name} :active uses --cinder-accent-active-on-fill (AA-safe pressed label)`, () => {
      const rule = findRuleContaining(css, [...selectorFragments]);
      expect(rule, `could not find the pressed (:active) primary rule for ${name}`).toBeDefined();

      const background = backgroundOf(rule);
      // Must use the AA-safe on-fill token. The general --cinder-accent-active
      // would drop the dark-ink label below 4.5:1 on the darker light accent.
      expect(background, `${name} pressed fill must use the on-fill accent token`).toBe(
        PRESSED_FILL_TOKEN,
      );
      expect(
        background,
        `${name} pressed fill must NOT use the general --cinder-accent-active (fails AA on the label)`,
      ).not.toBe('var(--cinder-accent-active)');
    });
  }
});
