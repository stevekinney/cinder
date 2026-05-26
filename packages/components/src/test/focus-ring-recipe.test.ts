/**
 * Parser-based assertions that pin the focus-visible recipe to the shared
 * transparent-outline + `var(--_cinder-focus-ring-shadow)` pattern across the
 * files this audit targets. Raw string matching is too brittle — `postcss` is
 * already a dependency used by `scripts/check-component-css.ts`, so reuse it.
 *
 * The Stylelint plugin (`cinder/no-focus-visible-colored-outline`) handles
 * forward enforcement; these tests pin the specific selectors required by the
 * task plan and prove the `box-shadow` half of the recipe, which the lint rule
 * does not enforce by itself.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import postcss, { type Rule } from 'postcss';

// Shared helper — same forced-colors detection the Stylelint plugin uses.
// Keeping it in one place means the two enforcement layers can't disagree
// about whether a rule is inside `@media (forced-colors: active)`.
import { isUnderForcedColors } from '../../scripts/stylelint/focus-ring-helpers.mjs';

function loadCss(relativePath: string): string {
  const fullPath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(fullPath, 'utf8');
}

const copyButtonCss = loadCss('../components/copy-button/copy-button.css');
const navigationItemCss = loadCss('../components/navigation-item/navigation-item.css');
const numberInputCss = loadCss('../components/number-input/number-input.css');
const selectionPopoverCss = loadCss('../components/selection-popover/selection-popover.css');
const sideNavigationCss = loadCss('../components/side-navigation/side-navigation.css');
const sliderCss = loadCss('../components/slider/slider.css');
const tabsCss = loadCss('../components/tabs/tabs.css');

const TRANSPARENT_OUTLINE = 'var(--cinder-ring-width) solid transparent';
const SHARED_BOX_SHADOW = 'var(--_cinder-focus-ring-shadow)';

function parse(css: string) {
  return postcss.parse(css);
}

function findRule(root: ReturnType<typeof parse>, selector: string): Rule | undefined {
  let match: Rule | undefined;
  root.walkRules((rule) => {
    if (rule.selectors.includes(selector)) {
      match = rule;
      return false;
    }
    return undefined;
  });
  return match;
}

function findRules(root: ReturnType<typeof parse>, selector: string): Rule[] {
  const matches: Rule[] = [];
  root.walkRules((rule) => {
    if (rule.selectors.includes(selector)) matches.push(rule);
  });
  return matches;
}

function declValue(rule: Rule, property: string): string | undefined {
  let value: string | undefined;
  rule.walkDecls(property, (decl) => {
    value = decl.value;
  });
  return value;
}

const recipes: Array<{
  name: string;
  css: string;
  selector: string;
  forcedColorsSelector?: string;
}> = [
  {
    name: 'slider thumb',
    css: sliderCss,
    selector: '.cinder-slider__thumb:focus-visible',
  },
  {
    name: 'tab panel',
    css: tabsCss,
    selector: '.cinder-tab-panel:focus-visible',
  },
  {
    name: 'tab button',
    css: tabsCss,
    selector: '.cinder-tab:focus-visible',
  },
  {
    name: 'standalone copy button',
    css: copyButtonCss,
    selector: '.cinder-copy-button:focus-visible',
  },
  {
    name: 'selection-popover cancel action',
    css: selectionPopoverCss,
    selector: '.cinder-selection-popover__cancel:focus-visible',
  },
  {
    name: 'selection-popover submit action',
    css: selectionPopoverCss,
    selector: '.cinder-selection-popover__submit:focus-visible',
  },
  {
    name: 'selection-popover textarea',
    css: selectionPopoverCss,
    selector: '.cinder-selection-popover__textarea:focus-visible',
  },
];

describe('focus-visible recipe — transparent outline placeholder', () => {
  for (const { name, css, selector } of recipes) {
    test(`${name}: ${selector} uses the transparent-outline + box-shadow recipe`, () => {
      const root = parse(css);
      const rules = findRules(root, selector).filter((rule) => !isUnderForcedColors(rule));
      expect(rules.length).toBeGreaterThanOrEqual(1);
      const rule = rules[0]!;
      expect(declValue(rule, 'outline')).toBe(TRANSPARENT_OUTLINE);
      const boxShadow = declValue(rule, 'box-shadow');
      expect(boxShadow).toBeDefined();
      expect(boxShadow).toContain(SHARED_BOX_SHADOW);
    });

    test(`${name}: ${selector} has a forced-colors fallback that repaints the outline`, () => {
      const root = parse(css);
      const rules = findRules(root, selector).filter((rule) => isUnderForcedColors(rule));
      expect(rules.length).toBeGreaterThanOrEqual(1);
      const fallback = rules[0]!;
      const outline = declValue(fallback, 'outline');
      expect(outline).toBeDefined();
      expect(outline).not.toContain('transparent');
    });
  }
});

describe('number-input stepper — self-owned inset focus ring', () => {
  // The number-input stepper intentionally diverges from the shared outer-ring
  // recipe: the outer .cinder-number-input:focus-within already paints the
  // outer ring, so the stepper paints an INSET ring (so the focused stepper is
  // individually identifiable) rather than the shared --_cinder-focus-ring-shadow
  // outer ring. It still keeps the transparent-outline placeholder for the
  // forced-colors channel and a forced-colors outline fallback.
  const SELECTOR = '.cinder-number-input__stepper:focus-visible';

  test('keeps the transparent-outline placeholder', () => {
    const root = parse(numberInputCss);
    const rules = findRules(root, SELECTOR).filter((rule) => !isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(declValue(rules[0]!, 'outline')).toBe(TRANSPARENT_OUTLINE);
  });

  test('paints an inset ring (not the shared outer-ring recipe)', () => {
    const root = parse(numberInputCss);
    const rules = findRules(root, SELECTOR).filter((rule) => !isUnderForcedColors(rule));
    const boxShadow = declValue(rules[0]!, 'box-shadow');
    expect(boxShadow).toBeDefined();
    expect(boxShadow).toContain('inset');
    expect(boxShadow).toContain('var(--cinder-ring-color)');
    // It must NOT use the shared outer-ring token — that would re-introduce the
    // doubled ring this recipe was changed to avoid.
    expect(boxShadow).not.toContain(SHARED_BOX_SHADOW);
  });

  test('shows the surface-hover background affordance', () => {
    const root = parse(numberInputCss);
    const rules = findRules(root, SELECTOR).filter((rule) => !isUnderForcedColors(rule));
    expect(declValue(rules[0]!, 'background')).toBe('var(--cinder-surface-hover)');
  });

  test('has a forced-colors fallback that repaints the outline', () => {
    const root = parse(numberInputCss);
    const rules = findRules(root, SELECTOR).filter((rule) => isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const outline = declValue(rules[0]!, 'outline');
    expect(outline).toBeDefined();
    expect(outline).not.toContain('transparent');
  });
});

describe('selection-popover floating-button focus-visible', () => {
  test('uses the transparent placeholder and includes the shared focus ring in its box-shadow', () => {
    const root = parse(selectionPopoverCss);
    const rules = findRules(root, '.cinder-selection-popover__button:focus-visible').filter(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(rules.length).toBe(1);
    const rule = rules[0]!;
    expect(declValue(rule, 'outline')).toBe(TRANSPARENT_OUTLINE);
    const boxShadow = declValue(rule, 'box-shadow');
    expect(boxShadow).toBeDefined();
    expect(boxShadow).toContain(SHARED_BOX_SHADOW);
  });
});

describe('selection-popover programmatic textarea focus', () => {
  test('keeps the shared ring on :focus for the expanded composer autofocus path', () => {
    const root = parse(selectionPopoverCss);
    const rules = findRules(root, '.cinder-selection-popover__textarea:focus').filter(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const rule = rules.find((candidate) => declValue(candidate, 'box-shadow') !== undefined);
    expect(rule).toBeDefined();
    expect(declValue(rule!, 'outline')).toBe(TRANSPARENT_OUTLINE);
    expect(declValue(rule!, 'box-shadow')).toContain(SHARED_BOX_SHADOW);
  });
});

describe('vertical navigation-item geometry lives on the item', () => {
  test('navigation-item.css declares .cinder-navigation-item[data-variant="vertical"]', () => {
    const root = parse(navigationItemCss);
    const rule = findRule(root, ".cinder-navigation-item[data-variant='vertical']");
    expect(rule).toBeDefined();
    expect(declValue(rule!, 'border-radius')).toBe('var(--cinder-radius-sm)');
    expect(declValue(rule!, 'border-bottom')).toBe('none');
  });

  test('navigation-item.css declares the active vertical state on the item itself', () => {
    const root = parse(navigationItemCss);
    const rule = findRule(
      root,
      ".cinder-navigation-item[data-variant='vertical'][data-active='true']",
    );
    expect(rule).toBeDefined();
    expect(declValue(rule!, 'border-inline-start-color')).toBe('var(--cinder-accent)');
  });

  test('side-navigation.css no longer contains ancestor overrides for navigation-item', () => {
    const css = sideNavigationCss;
    expect(css).not.toMatch(/\.cinder-side-navigation\s+a\.cinder-navigation-item/);
    expect(css).not.toMatch(/\.cinder-side-navigation\s+button\.cinder-navigation-item/);
  });
});

describe('vertical tab geometry', () => {
  test('tabs.css declares .cinder-tab[data-variant="vertical"] with symmetric radius', () => {
    const root = parse(tabsCss);
    const rule = findRule(root, ".cinder-tab[data-variant='vertical']");
    expect(rule).toBeDefined();
    expect(declValue(rule!, 'border-radius')).toBe('var(--cinder-radius-sm)');
  });
});
