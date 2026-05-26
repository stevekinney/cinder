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
const dropdownCss = loadCss('../components/dropdown/dropdown.css');
const navigationItemCss = loadCss('../components/navigation-item/navigation-item.css');
const numberInputCss = loadCss('../components/number-input/number-input.css');
const selectionPopoverCss = loadCss('../components/selection-popover/selection-popover.css');
const sideNavigationCss = loadCss('../components/side-navigation/side-navigation.css');
const sliderCss = loadCss('../components/slider/slider.css');
const tabsCss = loadCss('../components/tabs/tabs.css');

const TRANSPARENT_OUTLINE = 'var(--cinder-ring-width) solid transparent';
const SHARED_BOX_SHADOW = 'var(--_cinder-focus-ring-shadow)';
const GROUPED_DROPDOWN_TRIGGER_SELECTOR = [
  '.cinder-button-group',
  '> .cinder-dropdown[data-cinder-button-group-item]',
  '> .cinder-dropdown-trigger:focus-visible',
].join('\n  ');
const NORMALIZED_GROUPED_DROPDOWN_TRIGGER_SELECTOR = GROUPED_DROPDOWN_TRIGGER_SELECTOR.replaceAll(
  /\s+/g,
  ' ',
);

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

function findRulesByNormalizedSelector(root: ReturnType<typeof parse>, selector: string): Rule[] {
  const matches: Rule[] = [];
  const normalizedSelector = selector.replaceAll(/\s+/g, ' ');
  root.walkRules((rule) => {
    if (
      rule.selectors.some((candidate) => candidate.replaceAll(/\s+/g, ' ') === normalizedSelector)
    )
      matches.push(rule);
  });
  return matches;
}

function ruleIndex(root: ReturnType<typeof parse>, target: Rule): number {
  let index = -1;
  let found = -1;
  root.walkRules((rule) => {
    index += 1;
    if (rule === target) found = index;
  });
  return found;
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
    name: 'number-input stepper',
    css: numberInputCss,
    selector: '.cinder-number-input__stepper:focus-visible',
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

describe('dropdown trigger focus-visible in button groups', () => {
  test('keeps the standalone trigger on the standard outset recipe', () => {
    const root = parse(dropdownCss);
    const rules = findRules(root, '.cinder-dropdown-trigger:focus-visible').filter(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(rules.length).toBe(1);
    const rule = rules[0]!;
    expect(declValue(rule, 'outline')).toBe(TRANSPARENT_OUTLINE);
    const boxShadow = declValue(rule, 'box-shadow');
    expect(boxShadow).toBeDefined();
    expect(boxShadow).toContain('var(--cinder-ring-offset-color)');
    expect(boxShadow).toContain('var(--cinder-ring-color)');
  });

  test('uses an inset ring for grouped dropdown triggers', () => {
    const root = parse(dropdownCss);
    const rule = findRulesByNormalizedSelector(root, GROUPED_DROPDOWN_TRIGGER_SELECTOR).find(
      (candidate) => !isUnderForcedColors(candidate),
    );
    expect(rule).toBeDefined();
    expect(declValue(rule!, 'outline')).toBe(TRANSPARENT_OUTLINE);
    const boxShadow = declValue(rule!, 'box-shadow');
    expect(boxShadow).toBeDefined();
    expect(boxShadow).toStartWith('inset');
    expect(boxShadow).toContain('var(--_cinder-dropdown-trigger-ring, var(--cinder-ring-color))');
    expect(boxShadow).not.toContain('var(--cinder-ring-offset-color)');
  });

  test('places the grouped rule after the base trigger rule and keeps group hooks in the selector', () => {
    const root = parse(dropdownCss);
    const baseRule = findRules(root, '.cinder-dropdown-trigger:focus-visible').find(
      (rule) => !isUnderForcedColors(rule),
    );
    const groupedRule = findRulesByNormalizedSelector(root, GROUPED_DROPDOWN_TRIGGER_SELECTOR).find(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(baseRule).toBeDefined();
    expect(groupedRule).toBeDefined();
    expect(ruleIndex(root, groupedRule!)).toBeGreaterThan(ruleIndex(root, baseRule!));
    const selector = groupedRule!.selectors.join(' ').replaceAll(/\s+/g, ' ');
    expect(selector).toBe(NORMALIZED_GROUPED_DROPDOWN_TRIGGER_SELECTOR);
  });

  test('keeps the grouped forced-colors fallback inset and after the base fallback', () => {
    const root = parse(dropdownCss);
    const baseFallback = findRules(root, '.cinder-dropdown-trigger:focus-visible').find((rule) =>
      isUnderForcedColors(rule),
    );
    const groupedFallback = findRulesByNormalizedSelector(
      root,
      GROUPED_DROPDOWN_TRIGGER_SELECTOR,
    ).find((rule) => isUnderForcedColors(rule));
    expect(baseFallback).toBeDefined();
    expect(groupedFallback).toBeDefined();
    expect(ruleIndex(root, groupedFallback!)).toBeGreaterThan(ruleIndex(root, baseFallback!));
    expect(declValue(groupedFallback!, 'outline')).toBe(
      'var(--cinder-ring-width) solid ButtonText',
    );
    expect(declValue(groupedFallback!, 'outline-offset')).toBe(
      'calc(var(--cinder-ring-width) * -1)',
    );
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
