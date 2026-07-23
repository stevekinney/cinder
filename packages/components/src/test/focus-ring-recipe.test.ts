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

import { parse as parsePostcss, type Rule } from 'postcss';
import stylelint from 'stylelint';

// Shared helper — same forced-colors detection the Stylelint plugin uses.
// Keeping it in one place means the two enforcement layers can't disagree
// about whether a rule is inside `@media (forced-colors: active)`.
import { isUnderForcedColors } from '../../scripts/stylelint/focus-ring-helpers.mjs';
import { DEFAULT_CHART_FOCUS_RING_STROKE_PADDING } from '../_internal/chart/chart-focus-ring.ts';

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
const sideNavigationGroupCss = loadCss(
  '../components/side-navigation-group/side-navigation-group.css',
);
const sliderCss = loadCss('../components/slider/slider.css');
const tabsCss = loadCss('../components/tabs/tabs.css');
const areaChartCss = loadCss('../components/area-chart/area-chart.css');
const barChartCss = loadCss('../components/bar-chart/bar-chart.css');
const lineChartCss = loadCss('../components/line-chart/line-chart.css');
const tokensBaseCss = loadCss('../styles/tokens-base.css');

// Issue #460 — forced-colors fallback additions for 9 components that used
// transparent-outline + box-shadow without a @media (forced-colors: active) block.
const capabilityGateCss = loadCss('../components/capability-gate/capability-gate.css');
const kanbanBoardCss = loadCss('../components/kanban-board/kanban-board.css');
const mediaControlsCss = loadCss('../components/media-controls/media-controls.css');
const permissionMatrixCss = loadCss('../components/permission-matrix/permission-matrix.css');
const shareCardCss = loadCss('../components/share-card/share-card.css');
const transferListCss = loadCss('../components/transfer-list/transfer-list.css');
const tableCss = loadCss('../components/table/table.css');
const menuBarCss = loadCss('../components/menu-bar/menu-bar.css');

// Focus-ring sweep targets (15f4d777) — colored outline-only recipes converted
// to the shared Strategy B / B-inset recipe.
const accordionItemCss = loadCss('../components/accordion-item/accordion-item.css');
const collapsibleCss = loadCss('../components/collapsible/collapsible.css');
const drawerCss = loadCss('../components/drawer/drawer.css');
const jsonSchemaEditorCss = loadCss('../components/json-schema-editor/json-schema-editor.css');
const jsonViewerCss = loadCss('../components/json-viewer/json-viewer.css');
const modalCss = loadCss('../components/modal/modal.css');
const popoverCss = loadCss('../components/popover/popover.css');
const ratingCss = loadCss('../components/rating/rating.css');
const searchFieldCss = loadCss('../components/search-field/search-field.css');
const sheetCss = loadCss('../components/sheet/sheet.css');
const toastRegionCss = loadCss('../components/toast-region/toast-region.css');
const treeCss = loadCss('../components/tree/tree.css');

// Svelte component <style> blocks converted in the same sweep. markdown-editor,
// diff-viewer, and review-editor moved to @lostgradient/editor (see
// docs/decisions/package-boundaries.md) and no longer live in this package's
// source tree, so their recipe pins moved with them.

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
  return parsePostcss(css);
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

function normalizeCssValue(value: string): string {
  return value.replaceAll(/\s+/g, ' ').replaceAll('( ', '(').replaceAll(' )', ')').trim();
}

const recipes: Array<{
  name: string;
  css: string;
  selector: string;
  forcedColorsSelector?: string;
}> = [
  // NOTE: the command-palette search input intentionally does NOT use this shared
  // transparent-outline + box-shadow recipe. An edgeless input floats that ring as
  // a stray box, so its keyboard focus is indicated by the search row's
  // :focus-within bottom-border recolor instead (verified in command-palette.test.ts).
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
  // Focus-ring sweep (15f4d777) — Strategy B (outer ring) conversions.
  {
    name: 'rating option',
    css: ratingCss,
    selector: '.cinder-rating__option:focus-visible',
  },
  {
    name: 'json-viewer toggle',
    css: jsonViewerCss,
    selector: '.cinder-json-viewer__toggle:focus-visible',
  },
  {
    name: 'collapsible trigger',
    css: collapsibleCss,
    selector: '.cinder-collapsible__trigger:focus-visible',
  },
  {
    name: 'toast action',
    css: toastRegionCss,
    selector: '.cinder-toast__action:focus-visible',
  },
  {
    name: 'toast dismiss',
    css: toastRegionCss,
    selector: '.cinder-toast__dismiss:focus-visible',
  },
  {
    name: 'popover container',
    css: popoverCss,
    selector: '.cinder-popover:focus-visible',
  },
  {
    name: 'json-schema-editor property-row trigger',
    css: jsonSchemaEditorCss,
    selector: '.cinder-jse-property-row__trigger:focus-visible',
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
    expect(rules.length).toBeGreaterThanOrEqual(1);
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
    expect(rules.length).toBeGreaterThanOrEqual(1);
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

describe('tab button — inset focus ring inside the scrollable tab list', () => {
  // `.cinder-tab-list` sets `overflow-x: auto`, which (per the CSS Overflow
  // spec) forces the block axis to `auto` too — making the list a clipping
  // container on both axes. The standard outset focus ring (offset + ring
  // width painted OUTSIDE the tab border box) is therefore clipped on the
  // top/bottom/trailing edges. The tab diverges from the shared outer-ring
  // recipe to the policy-sanctioned Strategy B-inset variant: an INSET ring
  // painted entirely within the tab border box, plus a forced-colors outline
  // drawn with a NEGATIVE offset so it, too, stays inside the clip.
  const SELECTOR = '.cinder-tab:focus-visible';

  test('keeps the transparent-outline placeholder', () => {
    const root = parse(tabsCss);
    const rules = findRules(root, SELECTOR).filter((rule) => !isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(declValue(rules[0]!, 'outline')).toBe(TRANSPARENT_OUTLINE);
  });

  test('paints an inset ring (not the shared outset outer-ring recipe)', () => {
    const root = parse(tabsCss);
    const rules = findRules(root, SELECTOR).filter((rule) => !isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const boxShadow = declValue(rules[0]!, 'box-shadow');
    expect(boxShadow).toBeDefined();
    expect(boxShadow).toContain('inset');
    expect(boxShadow).toContain('var(--cinder-ring-color)');
    // It must NOT use the shared outset outer-ring token — that is the recipe
    // that gets clipped by the list's overflow clamp.
    expect(boxShadow).not.toContain(SHARED_BOX_SHADOW);
  });

  test('uses the --_cinder-tab-ring fallback hook (matches the inset-ring convention)', () => {
    const root = parse(tabsCss);
    const rules = findRules(root, SELECTOR).filter((rule) => !isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(declValue(rules[0]!, 'box-shadow')).toContain(
      'var(--_cinder-tab-ring, var(--cinder-ring-color))',
    );
  });

  test('forced-colors fallback repaints the outline with ButtonText, drawn inside the clip', () => {
    const root = parse(tabsCss);
    const rules = findRules(root, SELECTOR).filter((rule) => isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const fallback = rules[0]!;
    const outline = declValue(fallback, 'outline');
    expect(outline).toBeDefined();
    expect(outline).not.toContain('transparent');
    // ButtonText (a pressable), not Highlight (selection); negative offset draws
    // the repaint outline INSIDE the tab border box so the list cannot clip it.
    expect(outline).toBe('var(--cinder-ring-width) solid ButtonText');
    expect(declValue(fallback, 'outline-offset')).toBe('calc(var(--cinder-ring-width) * -1)');
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
    expect(declValue(rule!, 'border-radius')).toBe('0');
    expect(declValue(rule!, 'border-bottom')).toBe('none');
  });

  test('navigation-item.css declares the active vertical state on the item itself', () => {
    const root = parse(navigationItemCss);
    const rule = findRule(
      root,
      ".cinder-navigation-item[data-variant='vertical'][data-active='true']",
    );
    expect(rule).toBeDefined();
    expect(declValue(rule!, 'background-color')).toBe('var(--cinder-surface-inset)');
    expect(declValue(rule!, 'border-inline-start-color')).toBe('var(--cinder-accent)');
    expect(rule!.toString()).not.toContain('color-mix(');
  });

  test('side-navigation.css no longer contains ancestor overrides for navigation-item', () => {
    const css = sideNavigationCss;
    expect(css).not.toMatch(/\.cinder-side-navigation\s+a\.cinder-navigation-item/);
    expect(css).not.toMatch(/\.cinder-side-navigation\s+button\.cinder-navigation-item/);
  });
});

describe('side-navigation full-bleed rows use the inset ring', () => {
  // Both the vertical nav item and the group trigger are `inline-size: 100%`
  // and full-bleed to the SideNavigation container edges. The standard OUTSET
  // ring (`var(--_cinder-focus-ring-shadow)`) overhangs the border box by 4px
  // on every side, with no gutter to grow into — it bleeds past the container
  // boundary (clipped under `overflow: hidden` app sidebars) and overlaps the
  // adjacent active row's surface-inset background. Both selectors are
  // realigned to the policy-sanctioned Strategy B-inset variant so the entire
  // ring is painted within each focusable element's own bounds.

  const VERTICAL_ITEM_SELECTOR = ".cinder-navigation-item[data-variant='vertical']:focus-visible";
  const TRIGGER_SELECTOR = '.cinder-side-navigation-group__trigger:focus-visible';

  test('vertical nav item keeps the transparent-outline placeholder', () => {
    const root = parse(navigationItemCss);
    const rules = findRules(root, VERTICAL_ITEM_SELECTOR).filter(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(declValue(rules[0]!, 'outline')).toBe(TRANSPARENT_OUTLINE);
  });

  test('vertical nav item paints an inset ring (not the shared outset recipe)', () => {
    const root = parse(navigationItemCss);
    const rules = findRules(root, VERTICAL_ITEM_SELECTOR).filter(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const boxShadow = declValue(rules[0]!, 'box-shadow');
    expect(boxShadow).toBeDefined();
    expect(boxShadow).toStartWith('inset');
    expect(boxShadow).toContain('var(--cinder-ring-color)');
    // It must NOT use the shared outset outer-ring token — that is the recipe
    // that overhangs the full-bleed row and bleeds past the container.
    expect(boxShadow).not.toContain(SHARED_BOX_SHADOW);
  });

  test('vertical nav item uses the --_cinder-navigation-item-ring fallback hook', () => {
    const root = parse(navigationItemCss);
    const rules = findRules(root, VERTICAL_ITEM_SELECTOR).filter(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(declValue(rules[0]!, 'box-shadow')).toContain(
      'var(--_cinder-navigation-item-ring, var(--cinder-ring-color))',
    );
  });

  test('vertical nav item forced-colors fallback repaints the outline inside the box', () => {
    const root = parse(navigationItemCss);
    const rules = findRules(root, VERTICAL_ITEM_SELECTOR).filter((rule) =>
      isUnderForcedColors(rule),
    );
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const fallback = rules[0]!;
    // ButtonText (anchor/button pressable), drawn INSIDE the border box via a
    // negative offset so the forced-colors outline does not reintroduce the
    // overhang the inset migration was meant to remove.
    expect(declValue(fallback, 'outline')).toBe('var(--cinder-ring-width) solid ButtonText');
    expect(declValue(fallback, 'outline-offset')).toBe('calc(var(--cinder-ring-width) * -1)');
  });

  test('group trigger keeps the transparent-outline placeholder', () => {
    const root = parse(sideNavigationGroupCss);
    const rules = findRules(root, TRIGGER_SELECTOR).filter((rule) => !isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(declValue(rules[0]!, 'outline')).toBe(TRANSPARENT_OUTLINE);
  });

  test('group trigger paints an inset ring (not the shared outset recipe)', () => {
    const root = parse(sideNavigationGroupCss);
    const rules = findRules(root, TRIGGER_SELECTOR).filter((rule) => !isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const boxShadow = declValue(rules[0]!, 'box-shadow');
    expect(boxShadow).toBeDefined();
    expect(boxShadow).toStartWith('inset');
    expect(boxShadow).toContain('var(--cinder-ring-color)');
    expect(boxShadow).not.toContain(SHARED_BOX_SHADOW);
  });

  test('group trigger uses the --_cinder-side-navigation-group-trigger-ring fallback hook', () => {
    const root = parse(sideNavigationGroupCss);
    const rules = findRules(root, TRIGGER_SELECTOR).filter((rule) => !isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(declValue(rules[0]!, 'box-shadow')).toContain(
      'var(--_cinder-side-navigation-group-trigger-ring, var(--cinder-ring-color))',
    );
  });

  test('group trigger forced-colors fallback repaints the outline inside the box', () => {
    const root = parse(sideNavigationGroupCss);
    const rules = findRules(root, TRIGGER_SELECTOR).filter((rule) => isUnderForcedColors(rule));
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const fallback = rules[0]!;
    expect(declValue(fallback, 'outline')).toBe('var(--cinder-ring-width) solid ButtonText');
    expect(declValue(fallback, 'outline-offset')).toBe('calc(var(--cinder-ring-width) * -1)');
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

// ============================================================================
// Focus-ring sweep (15f4d777): converted colored-outline-only recipes.
// ============================================================================

/**
 * Assert a selector follows Strategy B-inset: transparent-outline placeholder,
 * an INSET box-shadow that references `var(--cinder-ring-color)` (directly or
 * via a private `--_cinder-*-ring` fallback hook), does NOT reuse the shared
 * outer-ring token, and has a forced-colors fallback that repaints the outline
 * channel with a system color drawn inside the box (negative offset).
 */
function assertInsetRecipe(css: string, selector: string, parser = parse): void {
  const root = parser(css);
  const baseRules = findRules(root, selector).filter((rule) => !isUnderForcedColors(rule));
  expect(baseRules.length).toBeGreaterThanOrEqual(1);
  const base = baseRules[0]!;
  expect(declValue(base, 'outline')).toBe(TRANSPARENT_OUTLINE);
  const boxShadow = declValue(base, 'box-shadow');
  expect(boxShadow).toBeDefined();
  expect(boxShadow).toContain('inset');
  expect(boxShadow).toContain('var(--cinder-ring-color)');
  expect(boxShadow).not.toContain(SHARED_BOX_SHADOW);

  const fallbackRules = findRules(root, selector).filter((rule) => isUnderForcedColors(rule));
  expect(fallbackRules.length).toBeGreaterThanOrEqual(1);
  const fallback = fallbackRules[0]!;
  expect(declValue(fallback, 'outline')).toBe('var(--cinder-ring-width) solid ButtonText');
  expect(declValue(fallback, 'outline-offset')).toBe('calc(var(--cinder-ring-width) * -1)');
}

describe('focus-ring sweep — Strategy B-inset CSS selectors', () => {
  const insetCases: Array<{ name: string; css: string; selector: string }> = [
    {
      name: 'tree item',
      css: treeCss,
      selector: '.cinder-tree-item:focus-visible > .cinder-tree-item__row',
    },
    {
      name: 'accordion trigger',
      css: accordionItemCss,
      selector: '.cinder-accordion-item__trigger:focus-visible',
    },
    { name: 'modal close', css: modalCss, selector: '.cinder-modal__close:focus-visible' },
    { name: 'drawer close', css: drawerCss, selector: '.cinder-drawer__close:focus-visible' },
    { name: 'sheet close', css: sheetCss, selector: '.cinder-sheet__close:focus-visible' },
    {
      name: 'search-field clear',
      css: searchFieldCss,
      selector: '.cinder-search-field__clear:focus-visible',
    },
  ];

  for (const { name, css, selector } of insetCases) {
    test(`${name}: ${selector} uses the inset recipe + inside-the-clip forced-colors fallback`, () => {
      assertInsetRecipe(css, selector);
    });
  }
});

// The "focus-ring sweep — Strategy B-inset/outer Svelte selectors" cases that
// used to live here (markdown-editor surface, diff line, front-matter header,
// link-popover/thread-popover close, review-editor thread item/export
// trigger, toolbar button/dropdown) pinned components that moved to
// @lostgradient/editor (see docs/decisions/package-boundaries.md) and no
// longer live in this package's source tree.

function cssVariablePixelValue(css: string, property: string): number {
  let value: string | undefined;
  parse(css).walkDecls(property, (declaration) => {
    value = declaration.value;
  });
  if (!value?.endsWith('px')) {
    throw new Error(`Expected ${property} to be a px value; received ${value ?? '(missing)'}.`);
  }
  return Number.parseFloat(value);
}

function resolveChartStrokeWidth(value: string, ringWidth: number, ringOffset: number): number {
  const normalizedValue = normalizeCssValue(value);
  if (normalizedValue === 'var(--cinder-ring-width)') return ringWidth;
  if (
    normalizedValue ===
    'calc(var(--cinder-ring-width) + var(--cinder-ring-offset) + var(--cinder-ring-offset))'
  ) {
    return ringWidth + ringOffset * 2;
  }
  throw new Error(`Unsupported chart focus-ring stroke-width expression: ${value}`);
}

function assertSvgChartFocusRingRecipe(css: string, prefix: string): void {
  const root = parse(css);
  const sharedSelectors = [
    `.${prefix}__focus-ring`,
    `.${prefix}__focus-ring-halo`,
    `.${prefix}__focus-ring-connector`,
    `.${prefix}__focus-ring-dot`,
  ];

  for (const selector of sharedSelectors) {
    const rules = findRules(root, selector).filter((rule) => !isUnderForcedColors(rule));
    expect(rules.length, `${selector} base rule count`).toBeGreaterThanOrEqual(1);
    const sharedRule = rules.find((rule) => declValue(rule, 'vector-effect') !== undefined);
    expect(sharedRule, `${selector} shared SVG rule`).toBeDefined();
    expect(declValue(sharedRule!, 'fill')).toBe('none');
    expect(declValue(sharedRule!, 'pointer-events')).toBe('none');
    expect(declValue(sharedRule!, 'vector-effect')).toBe('non-scaling-stroke');
  }

  const ring = findRules(root, `.${prefix}__focus-ring`).find(
    (rule) => !isUnderForcedColors(rule) && declValue(rule, 'stroke') !== undefined,
  );
  expect(ring, `${prefix} ring rule`).toBeDefined();
  expect(declValue(ring!, 'stroke')).toBe('var(--cinder-ring-color)');
  expect(declValue(ring!, 'stroke-width')).toBe('var(--cinder-ring-width)');
  expect(declValue(ring!, 'filter')).toBe('none');

  const halo = findRules(root, `.${prefix}__focus-ring-halo`).find(
    (rule) => !isUnderForcedColors(rule) && declValue(rule, 'stroke') !== undefined,
  );
  expect(halo, `${prefix} halo rule`).toBeDefined();
  expect(declValue(halo!, 'stroke')).toBe('var(--cinder-ring-offset-color)');
  expect(normalizeCssValue(declValue(halo!, 'stroke-width')!)).toBe(
    'calc(var(--cinder-ring-width) + var(--cinder-ring-offset) + var(--cinder-ring-offset))',
  );
  expect(declValue(halo!, 'filter')).toBe('none');

  const fallbackSelector = `.${prefix}__focus-target:focus-visible:not([data-cinder-focus-ring-active='true'])`;
  const fallback = findRules(root, fallbackSelector).find((rule) => !isUnderForcedColors(rule));
  expect(fallback, `${prefix} focus-target fallback`).toBeDefined();
  expect(declValue(fallback!, 'stroke')).toBe('var(--cinder-ring-color)');
  expect(declValue(fallback!, 'stroke-width')).toBe('var(--cinder-ring-width)');
  expect(declValue(fallback!, 'vector-effect')).toBe('non-scaling-stroke');
  expect(declValue(fallback!, 'filter')).toBe('none');

  const forcedRing = findRules(root, `.${prefix}__focus-ring`).find((rule) =>
    isUnderForcedColors(rule),
  );
  expect(forcedRing, `${prefix} forced-colors ring`).toBeDefined();
  expect(declValue(forcedRing!, 'fill')).toBe('none');
  expect(declValue(forcedRing!, 'stroke')).toBe('ButtonText');
  expect(declValue(forcedRing!, 'stroke-width')).toBe('var(--cinder-ring-width)');
  expect(declValue(forcedRing!, 'filter')).toBe('none');

  const forcedHalo = findRules(root, `.${prefix}__focus-ring-halo`).find((rule) =>
    isUnderForcedColors(rule),
  );
  expect(forcedHalo, `${prefix} forced-colors halo`).toBeDefined();
  expect(declValue(forcedHalo!, 'display')).toBe('none');

  const forcedFallback = findRules(root, fallbackSelector).find((rule) =>
    isUnderForcedColors(rule),
  );
  expect(forcedFallback, `${prefix} forced-colors target fallback`).toBeDefined();
  expect(declValue(forcedFallback!, 'stroke')).toBe('ButtonText');
  expect(declValue(forcedFallback!, 'stroke-width')).toBe('var(--cinder-ring-width)');
  expect(declValue(forcedFallback!, 'filter')).toBe('none');
}

describe('SVG chart focus-ring recipe', () => {
  const chartCases = [
    { name: 'area-chart', css: areaChartCss, prefix: 'cinder-area-chart' },
    { name: 'line-chart', css: lineChartCss, prefix: 'cinder-line-chart' },
    { name: 'bar-chart', css: barChartCss, prefix: 'cinder-bar-chart' },
  ];

  for (const { name, css, prefix } of chartCases) {
    test(`${name}: SVG focus-ring layer uses tokenized non-scaling stroke with forced-colors fallback`, () => {
      assertSvgChartFocusRingRecipe(css, prefix);
    });
  }

  test('halo plus ring stroke budget stays within the geometry stroke padding', () => {
    const ringWidth = cssVariablePixelValue(tokensBaseCss, '--cinder-ring-width');
    const ringOffset = cssVariablePixelValue(tokensBaseCss, '--cinder-ring-offset');
    const root = parse(areaChartCss);
    const ring = findRules(root, '.cinder-area-chart__focus-ring').find(
      (rule) => !isUnderForcedColors(rule) && declValue(rule, 'stroke-width') !== undefined,
    );
    const halo = findRules(root, '.cinder-area-chart__focus-ring-halo').find(
      (rule) => !isUnderForcedColors(rule) && declValue(rule, 'stroke-width') !== undefined,
    );

    expect(ring).toBeDefined();
    expect(halo).toBeDefined();
    const totalStrokeBudget =
      resolveChartStrokeWidth(declValue(ring!, 'stroke-width')!, ringWidth, ringOffset) +
      resolveChartStrokeWidth(declValue(halo!, 'stroke-width')!, ringWidth, ringOffset);

    expect(totalStrokeBudget).toBeLessThanOrEqual(DEFAULT_CHART_FOCUS_RING_STROKE_PADDING);
  });
});

// The "focus-ring sweep — text-entry focus selectors" (review comment
// composer/edit textareas) and "selected/current state boundaries"
// (ProseMirror selected nodes) blocks that used to live here pinned
// review-editor and markdown-editor CSS, which moved to
// @lostgradient/editor (see docs/decisions/package-boundaries.md) and no
// longer lives in this package's source tree.

describe('focus-ring lint rule gates at error severity', () => {
  // Proves the enforcement promotion: a colored outline-only :focus-visible must
  // be reported by stylelint as an ERROR (not a warning) when linted through the
  // repo's real .stylelintrc.json. Uses the stylelint Node API with `configFile`
  // (the same deterministic approach as the dedicated plugin test) rather than
  // spawning a `bunx stylelint` subprocess — the subprocess form re-resolved a
  // stylelint without the local plugin in CI and produced empty output.
  const ruleName = 'cinder/no-focus-visible-colored-outline';
  const projectConfig = fileURLToPath(new URL('../../../../.stylelintrc.json', import.meta.url));

  async function lintWithProjectConfig(css: string) {
    return stylelint.lint({ code: css, configFile: projectConfig });
  }

  function warningsFor(result: Awaited<ReturnType<typeof stylelint.lint>>) {
    return result.results.flatMap((file) => file.warnings ?? []).filter((w) => w.rule === ruleName);
  }

  test('a colored outline-only focus-visible rule is reported as an error', async () => {
    const result = await lintWithProjectConfig(
      '.x:focus-visible { outline: 2px solid var(--cinder-accent); }\n',
    );
    const hits = warningsFor(result);
    expect(hits.length).toBeGreaterThan(0);
    // The gate is the SEVERITY: at `severity: warning` this would be a warning,
    // not an error, and would not block CI.
    expect(hits[0]?.severity).toBe('error');
    expect(result.errored).toBe(true);
  });

  test('the shared transparent-outline + box-shadow recipe passes', async () => {
    const result = await lintWithProjectConfig(
      '.x:focus-visible { outline: var(--cinder-ring-width) solid transparent; box-shadow: var(--_cinder-focus-ring-shadow); }\n',
    );
    expect(warningsFor(result)).toEqual([]);
  });
});

// ============================================================================
// Issue #460 — forced-colors fallbacks for 9 components with box-shadow focus
// rings and no prior forced-colors media block.
// ============================================================================

/**
 * Assert a focus-visible selector has a forced-colors fallback that repaints
 * the outline with ButtonText. This is a lighter version of assertOuterRecipe
 * that does NOT require the shared `var(--_cinder-focus-ring-shadow)` token —
 * some of the issue #460 components use the inline two-shadow form, which is
 * semantically identical but written out explicitly.
 *
 * @param expectedOffset - The expected `outline-offset` value in the fallback
 *   block. Bordered controls use `3px` (matches button.css precedent — 3px
 *   separates the ring from ButtonBorder which shares the ButtonText color
 *   family in HCM). Borderless controls use `2px`. Overflow-clipped scrollable
 *   containers use `calc(-1 * var(--cinder-ring-width))` (inset ring).
 */
function assertForcedColorsFallback(css: string, selector: string, expectedOffset: string): void {
  const root = parse(css);

  // The base (non-forced) rule must have a transparent outline and box-shadow.
  const baseRules = findRules(root, selector).filter((rule) => !isUnderForcedColors(rule));
  expect(baseRules.length).toBeGreaterThanOrEqual(1);
  const base = baseRules[0]!;
  const outlineValue = declValue(base, 'outline');
  expect(outlineValue).toBeDefined();
  expect(outlineValue).toContain('transparent');
  expect(declValue(base, 'box-shadow')).toBeDefined();

  // The forced-colors block must have a non-transparent ButtonText outline,
  // the correct outline-offset for the control type, and box-shadow:none.
  const fallbackRules = findRules(root, selector).filter((rule) => isUnderForcedColors(rule));
  expect(fallbackRules.length).toBeGreaterThanOrEqual(1);
  const fallback = fallbackRules[0]!;
  const outline = declValue(fallback, 'outline');
  expect(outline).toBeDefined();
  expect(outline).not.toContain('transparent');
  expect(outline).toBe('var(--cinder-ring-width) solid ButtonText');
  expect(declValue(fallback, 'outline-offset')).toBe(expectedOffset);
  expect(declValue(fallback, 'box-shadow')).toBe('none');
}

describe('forced-colors fallbacks — issue #460 (9 affected components)', () => {
  // Each entry asserts: transparent-outline + box-shadow in normal mode, plus
  // a non-transparent ButtonText outline, the correct per-control outline-offset,
  // and explicit box-shadow:none in @media (forced-colors: active).
  //
  // outline-offset policy:
  //   3px  — bordered controls (border renders as ButtonBorder in HCM; 2px would merge)
  //   2px  — borderless controls (no ButtonBorder, so 2px is safe)
  //   calc(-1 * var(--cinder-ring-width))  — overflow:auto containers (positive offset
  //          is clipped; inset ring always paints inside the scroll box)
  const cases: Array<{ name: string; css: string; selector: string; expectedOffset: string }> = [
    {
      name: 'capability-gate primary action',
      css: capabilityGateCss,
      selector: '.cinder-capability-gate__primary:focus-visible',
      expectedOffset: '3px',
    },
    {
      name: 'capability-gate fallback action',
      css: capabilityGateCss,
      selector: '.cinder-capability-gate__fallback:focus-visible',
      expectedOffset: '3px',
    },
    {
      name: 'capability-gate dismiss action',
      css: capabilityGateCss,
      selector: '.cinder-capability-gate__dismiss:focus-visible',
      expectedOffset: '3px',
    },
    {
      name: 'kanban-board column-handle',
      css: kanbanBoardCss,
      selector: '.cinder-kanban-board__column-handle:focus-visible',
      expectedOffset: '3px',
    },
    {
      name: 'kanban-board collapse',
      css: kanbanBoardCss,
      selector: '.cinder-kanban-board__collapse:focus-visible',
      expectedOffset: '3px',
    },
    {
      name: 'media-controls button',
      css: mediaControlsCss,
      selector: '.cinder-media-controls__button:focus-visible',
      expectedOffset: '3px',
    },
    {
      name: 'permission-matrix cell-control button',
      css: permissionMatrixCss,
      selector: 'button.cinder-permission-matrix__cell-control:focus-visible',
      // border:0 — borderless, no ButtonBorder merge risk
      expectedOffset: '2px',
    },
    {
      name: 'share-card action',
      css: shareCardCss,
      selector: '.cinder-share-card__action:focus-visible',
      expectedOffset: '3px',
    },
    {
      name: 'transfer-list list (overflow:auto — uses inset ring)',
      css: transferListCss,
      selector: '.cinder-transfer-list__list:focus-visible',
      // overflow:auto clips a positive offset; inset ring avoids the clip
      expectedOffset: 'calc(-1 * var(--cinder-ring-width))',
    },
    {
      name: 'transfer-list control',
      css: transferListCss,
      selector: '.cinder-transfer-list__control:focus-visible',
      expectedOffset: '3px',
    },
    {
      name: 'table sort-button',
      css: tableCss,
      selector: '.cinder-table__sort-button:focus-visible',
      // border:none — borderless, no ButtonBorder merge risk
      expectedOffset: '2px',
    },
    {
      name: 'menu-bar trigger',
      css: menuBarCss,
      selector: '.cinder-menu-bar__trigger:focus-visible',
      expectedOffset: '3px',
    },
  ];

  for (const { name, css, selector, expectedOffset } of cases) {
    test(`${name}: ${selector} has a forced-colors fallback that repaints the outline`, () => {
      assertForcedColorsFallback(css, selector, expectedOffset);
    });
  }
});
