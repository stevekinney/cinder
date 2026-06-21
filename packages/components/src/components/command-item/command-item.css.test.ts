/**
 * Regression test for the command-item active-row ring (WCAG 1.4.11 fix).
 *
 * The active command item row communicates keyboard position and must carry a
 * contrast-safe geometric ring (`box-shadow: inset 0 0 0 1px
 * var(--cinder-ring-color)`) in addition to its accent fill. Autocomplete and
 * combobox already implement the same pattern via the shared
 * `_floating-surface.css`; this test pins the equivalent invariant for
 * command-item's own CSS so a future edit cannot silently drop it.
 *
 * Parser-based assertions via `postcss` (happy-dom does not compute styles from
 * stylesheets, and the package has no browser test harness for unit CSS).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { parse, type AtRule, type Rule } from 'postcss';

function loadCss(relativePath: string): string {
  const fullPath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(fullPath, 'utf8');
}

const commandItemCss = loadCss('./command-item.css');
const root = parse(commandItemCss);

/**
 * A rule is "effectively top-level" when the only at-rules between it and the
 * stylesheet root are `@layer` wrappers. Rules inside `@media` / `@supports` /
 * `@container` (e.g. the forced-colors block) are NOT top-level and are skipped
 * by this predicate.
 */
function isEffectivelyTopLevel(rule: Rule): boolean {
  let ancestor = rule.parent;
  while (ancestor && ancestor.type !== 'root') {
    if (ancestor.type === 'atrule' && (ancestor as AtRule).name !== 'layer') return false;
    ancestor = ancestor.parent;
  }
  return true;
}

function findTopLevelRule(selector: string): Rule {
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

const ACTIVE_SELECTOR = '.cinder-command-item[data-cinder-active]';

describe('command-item active state — WCAG 1.4.11 ring', () => {
  test('active rule keeps the accent fill background', () => {
    const rule = findTopLevelRule(ACTIVE_SELECTOR);
    expect(declValue(rule, 'background')).toBe('var(--cinder-accent)');
  });

  test('active rule keeps the accent contrast foreground color', () => {
    const rule = findTopLevelRule(ACTIVE_SELECTOR);
    expect(declValue(rule, 'color')).toBe('var(--cinder-accent-contrast)');
  });

  test('active rule includes an inset ring using var(--cinder-ring-color)', () => {
    // The ring is the WCAG 1.4.11 geometric affordance for keyboard cursor
    // position. It must use `--cinder-ring-color` (the system focus-ring token)
    // as an inset box-shadow so it follows the element's border-radius.
    const rule = findTopLevelRule(ACTIVE_SELECTOR);
    const shadow = declValue(rule, 'box-shadow');
    expect(
      shadow,
      'box-shadow must be set on the top-level active rule (not only in forced-colors)',
    ).toBeDefined();
    expect(shadow, 'box-shadow must be an inset ring using var(--cinder-ring-color)').toMatch(
      /inset\s+0\s+0\s+0\s+1px\s+var\(--cinder-ring-color\)/,
    );
  });

  test('forced-colors block retains system-color outline for the active item', () => {
    // The forced-colors rule resets box-shadow (system colors strip it) and
    // falls back to an `outline` using the system Highlight color. This must
    // remain present so keyboard position is still visible in Windows High
    // Contrast Mode.
    let forcedColorsRuleFound = false;
    let hasHighlightBackground = false;
    let hasOutline = false;

    root.walkRules((rule) => {
      if (!rule.selectors.includes(ACTIVE_SELECTOR)) return undefined;

      // Only look inside @media (forced-colors: active)
      let ancestor = rule.parent;
      let insideForcedColors = false;
      while (ancestor && ancestor.type !== 'root') {
        if (
          ancestor.type === 'atrule' &&
          (ancestor as AtRule).name === 'media' &&
          /forced-colors:\s*active/.test((ancestor as AtRule).params)
        ) {
          insideForcedColors = true;
          break;
        }
        ancestor = ancestor.parent;
      }
      if (!insideForcedColors) return undefined;

      forcedColorsRuleFound = true;
      rule.walkDecls('background', (decl) => {
        if (decl.value === 'Highlight') hasHighlightBackground = true;
      });
      rule.walkDecls('outline', (decl) => {
        if (/Highlight/.test(decl.value)) hasOutline = true;
      });
      return undefined;
    });

    expect(
      forcedColorsRuleFound,
      'a forced-colors rule for the active selector must be present',
    ).toBe(true);
    expect(hasHighlightBackground, 'forced-colors active rule must set background: Highlight').toBe(
      true,
    );
    expect(
      hasOutline,
      'forced-colors active rule must set an outline using the Highlight system color',
    ).toBe(true);
  });
});
