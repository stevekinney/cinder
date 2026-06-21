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

/**
 * Extract the contents of a Svelte component's single `<style>` block so the
 * focus-visible declarations can be parsed with `postcss` exactly like a plain
 * `.css` file. These components author plain CSS (no `lang=` on `<style>`), so
 * the inner text parses directly.
 */
function loadSvelteStyle(relativePath: string): string {
  const raw = loadCss(relativePath);
  const match = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!match) throw new Error(`No <style> block found in ${relativePath}`);
  return match[1]!;
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
const chatConversationListCss = loadCss(
  '../components/chat-conversation-list/chat-conversation-list.css',
);

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

// Svelte component <style> blocks converted in the same sweep.
const markdownEditorStyle = loadSvelteStyle('../components/markdown-editor/markdown-editor.svelte');
const prosemirrorCss = loadCss('../components/markdown-editor/prosemirror.css');
const toolbarButtonStyle = loadSvelteStyle(
  '../components/markdown-editor/editor-toolbar/toolbar-button.svelte',
);
const toolbarDropdownStyle = loadSvelteStyle(
  '../components/markdown-editor/editor-toolbar/toolbar-dropdown.svelte',
);
const linkPopoverStyle = loadSvelteStyle(
  '../components/markdown-editor/editor-toolbar/link-popover.svelte',
);
const diffLineStyle = loadSvelteStyle('../components/diff-viewer/diff-line.svelte');
const frontMatterHeaderStyle = loadSvelteStyle(
  '../components/diff-viewer/front-matter-header.svelte',
);
const threadPopoverStyle = loadSvelteStyle('../components/review-editor/thread-popover.svelte');
const commentComposerStyle = loadSvelteStyle('../components/review-editor/comment-composer.svelte');
const commentListStyle = loadSvelteStyle('../components/review-editor/comment-list.svelte');
const commentSidebarStyle = loadSvelteStyle('../components/review-editor/comment-sidebar.svelte');
const reviewExportActionsStyle = loadSvelteStyle(
  '../components/review-editor/export-actions.svelte',
);
const conversationExportActionsStyle = loadSvelteStyle(
  '../components/chat/export/conversation-export-actions.svelte',
);
const artifactPanelStyle = loadSvelteStyle('../components/chat/artifact/artifact-panel.svelte');
const chatStyle = loadSvelteStyle('../components/chat/container/chat.svelte');
const chatJumpControlsStyle = loadSvelteStyle(
  '../components/chat/container/chat-jump-controls.svelte',
);
const chatSearchBarStyle = loadSvelteStyle('../components/chat/container/chat-search-bar.svelte');
const chatMessageStyle = loadSvelteStyle('../components/chat/message/chat-message.svelte');
const toolCallGroupStyle = loadSvelteStyle('../components/chat/message/tool-call-group.svelte');
const messageAttachmentsStyle = loadSvelteStyle(
  '../components/chat/message/message-attachments.svelte',
);
const chatInputStyle = loadSvelteStyle('../components/chat/input/chat-input.svelte');
const imageLightboxStyle = loadSvelteStyle('../components/chat/message/image-lightbox.svelte');

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

/**
 * Assert a selector follows Strategy B (outer ring): transparent-outline
 * placeholder, box-shadow referencing the shared focus-ring token, and a
 * forced-colors fallback whose outline does NOT contain `transparent`.
 */
function assertOuterRecipe(css: string, selector: string, parser = parse): void {
  const root = parser(css);
  const baseRules = findRules(root, selector).filter((rule) => !isUnderForcedColors(rule));
  expect(baseRules.length).toBeGreaterThanOrEqual(1);
  const base = baseRules[0]!;
  expect(declValue(base, 'outline')).toBe(TRANSPARENT_OUTLINE);
  const boxShadow = declValue(base, 'box-shadow');
  expect(boxShadow).toBeDefined();
  expect(boxShadow).toContain(SHARED_BOX_SHADOW);

  const fallbackRules = findRules(root, selector).filter((rule) => isUnderForcedColors(rule));
  expect(fallbackRules.length).toBeGreaterThanOrEqual(1);
  const fallback = fallbackRules[0]!;
  const outline = declValue(fallback, 'outline');
  expect(outline).toBeDefined();
  expect(outline).not.toContain('transparent');
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

describe('focus-ring sweep — Strategy B-inset Svelte selectors', () => {
  const insetCases: Array<{ name: string; style: string; selector: string }> = [
    {
      name: 'markdown-editor surface',
      style: markdownEditorStyle,
      selector: '.markdown-editor.surface:focus-visible',
    },
    {
      name: 'diff line',
      style: diffLineStyle,
      selector: 'button.diff-line:focus-visible',
    },
    {
      name: 'inline front-matter header',
      style: frontMatterHeaderStyle,
      selector: ".front-matter-header[data-variant='inline']:focus-visible",
    },
    {
      name: 'link-popover close',
      style: linkPopoverStyle,
      selector: '.link-popover-close:focus-visible',
    },
    {
      name: 'thread-popover close',
      style: threadPopoverStyle,
      selector: '.thread-popover-close:focus-visible',
    },
    {
      name: 'review-editor thread item',
      style: commentSidebarStyle,
      selector: '.thread-item:focus-visible',
    },
    {
      name: 'artifact-panel close',
      style: artifactPanelStyle,
      selector: '.artifact-panel-close:focus-visible',
    },
    {
      name: 'chat timeline',
      style: chatStyle,
      selector: '.chat-timeline:focus-visible',
    },
    {
      name: 'message attachment button',
      style: messageAttachmentsStyle,
      selector: '.message-attachment-button:focus-visible',
    },
    {
      name: 'tool-call header',
      style: toolCallGroupStyle,
      selector: '.tool-call-header:focus-visible',
    },
  ];

  for (const { name, style, selector } of insetCases) {
    test(`${name}: ${selector} uses the inset recipe + inside-the-clip forced-colors fallback`, () => {
      assertInsetRecipe(style, selector);
    });
  }
});

describe('focus-ring sweep — Strategy B (outer) Svelte selectors', () => {
  const outerCases: Array<{ name: string; style: string; selector: string }> = [
    {
      name: 'review-editor export trigger',
      style: reviewExportActionsStyle,
      selector: '.export-actions :global(.export-trigger:focus-visible)',
    },
    {
      name: 'chat export trigger',
      style: conversationExportActionsStyle,
      selector: '.conversation-export-actions :global(.export-trigger:focus-visible)',
    },
    {
      name: 'comment-sidebar actions trigger',
      style: commentSidebarStyle,
      selector: '.sidebar-header :global(.actions-trigger:focus-visible)',
    },
    {
      name: 'chat empty prompt',
      style: chatStyle,
      selector: '.chat-empty-prompt:focus-visible',
    },
    {
      name: 'chat search nav button',
      style: chatSearchBarStyle,
      selector: '.chat-search-nav-button:focus-visible',
    },
    {
      name: 'diff front-matter header',
      style: frontMatterHeaderStyle,
      selector: '.front-matter-header:focus-visible',
    },
    {
      name: 'markdown toolbar button',
      style: toolbarButtonStyle,
      selector: '.toolbar-button:focus-visible',
    },
    {
      name: 'markdown toolbar dropdown trigger',
      style: toolbarDropdownStyle,
      selector: ':global(.toolbar-dropdown-trigger:focus-visible)',
    },
    {
      name: 'chat jump button',
      style: chatJumpControlsStyle,
      selector: '.chat-jump-button:focus-visible',
    },
    {
      name: 'chat new indicator',
      style: chatJumpControlsStyle,
      selector: '.chat-new-indicator:focus-visible',
    },
    {
      name: 'chat send button',
      style: chatInputStyle,
      selector: '.chat-input-send:focus-visible',
    },
    {
      name: 'chat message row',
      style: chatMessageStyle,
      selector: '.chat-message:focus-visible',
    },
    {
      name: 'chat message expand button',
      style: chatMessageStyle,
      selector: '.chat-message-expand:focus-visible',
    },
    {
      name: 'chat message retry button',
      style: chatMessageStyle,
      selector: '.chat-message-retry:focus-visible',
    },
    {
      name: 'chat message action button',
      style: chatMessageStyle,
      selector: ':global(.chat-message-action-button:focus-visible)',
    },
    {
      name: 'chat message edit save',
      style: chatMessageStyle,
      selector: '.chat-message-edit-save:focus-visible',
    },
    {
      name: 'chat message edit cancel',
      style: chatMessageStyle,
      selector: '.chat-message-edit-cancel:focus-visible',
    },
  ];

  for (const { name, style, selector } of outerCases) {
    test(`${name}: ${selector} uses the shared outer-ring recipe + forced-colors fallback`, () => {
      assertOuterRecipe(style, selector);
    });
  }
});

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

describe('focus-ring sweep — text-entry focus selectors', () => {
  const textEntryCases: Array<{ name: string; style: string; selector: string }> = [
    {
      name: 'chat message edit textarea',
      style: chatMessageStyle,
      selector: '.chat-message-edit-textarea:focus',
    },
    {
      name: 'review comment composer textarea',
      style: commentComposerStyle,
      selector: '.comment-composer-textarea:focus',
    },
    {
      name: 'review comment edit textarea',
      style: commentListStyle,
      selector: '.comment-edit-textarea:focus',
    },
  ];

  for (const { name, style, selector } of textEntryCases) {
    test(`${name}: ${selector} uses the shared focus ring + Highlight forced-colors fallback`, () => {
      assertOuterRecipe(style, selector);
      const root = parse(style);
      const fallback = findRules(root, selector).find((rule) => isUnderForcedColors(rule));
      expect(fallback).toBeDefined();
      expect(declValue(fallback!, 'outline')).toBe('var(--cinder-ring-width) solid Highlight');
      expect(declValue(fallback!, 'outline-offset')).toBe('1px');
    });
  }

  test('review comment composer error state keeps validation border but does not own a danger focus ring', () => {
    const root = parse(commentComposerStyle);
    const errorState = findRule(root, ".comment-composer-textarea[data-has-error='true']");
    expect(errorState).toBeDefined();
    expect(declValue(errorState!, 'border-color')).toBe('var(--cinder-danger)');

    const errorFocusRules = findRules(
      root,
      ".comment-composer-textarea[data-has-error='true']:focus",
    );
    expect(errorFocusRules).toEqual([]);

    const focusRules = findRules(root, '.comment-composer-textarea:focus').filter(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(focusRules.length).toBeGreaterThanOrEqual(1);
    expect(declValue(focusRules[0]!, 'box-shadow')).toContain(SHARED_BOX_SHADOW);
    expect(declValue(focusRules[0]!, 'box-shadow')).not.toContain('var(--cinder-danger)');
  });
});

describe('focus-ring sweep — selected/current state boundaries', () => {
  test('chat stop button does not override the shared send-button focus ring with danger color', () => {
    const root = parse(chatInputStyle);
    const rules = findRules(root, '.chat-input-send[data-stop]:focus-visible');
    expect(rules).toEqual([]);
  });

  test('ProseMirror selected nodes use a tokenized selected-state outline, not a focus selector', () => {
    const root = parse(prosemirrorCss);
    const selectedNode = findRule(root, '.ProseMirror-selectednode');
    const selectedListItem = findRule(root, 'li.ProseMirror-selectednode:after');
    expect(selectedNode).toBeDefined();
    expect(selectedListItem).toBeDefined();
    expect(selectedNode!.selector).not.toContain(':focus');
    expect(declValue(selectedNode!, 'outline')).toBe('2px solid var(--cinder-accent)');
    expect(declValue(selectedListItem!, 'border')).toBe('2px solid var(--cinder-accent)');
  });
});

describe('chat-input attachment-remove — inset ring painted on the visible chip', () => {
  // The button is a 44px touch target with the visible chip rendered by its
  // `::before`. The base :focus-visible keeps only the transparent placeholder;
  // the inset ring is painted on `::before` so it hugs the chip, not the
  // oversized hit area. The forced-colors outline keeps the -12px inset.
  test('base rule keeps the transparent-outline placeholder', () => {
    const root = parse(chatInputStyle);
    const rules = findRules(root, '.chat-input-attachment-remove:focus-visible').filter(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(declValue(rules[0]!, 'outline')).toBe(TRANSPARENT_OUTLINE);
  });

  test('::before paints an inset ring referencing the ring color', () => {
    const root = parse(chatInputStyle);
    const rules = findRules(root, '.chat-input-attachment-remove:focus-visible::before').filter(
      (rule) => !isUnderForcedColors(rule),
    );
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const boxShadow = declValue(rules[0]!, 'box-shadow');
    expect(boxShadow).toBeDefined();
    expect(boxShadow).toContain('inset');
    expect(boxShadow).toContain('var(--cinder-ring-color)');
    expect(boxShadow).not.toContain(SHARED_BOX_SHADOW);
  });

  test('forced-colors fallback repaints the outline on the chip', () => {
    const root = parse(chatInputStyle);
    const rules = findRules(root, '.chat-input-attachment-remove:focus-visible').filter((rule) =>
      isUnderForcedColors(rule),
    );
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const fallback = rules[0]!;
    expect(declValue(fallback, 'outline')).toBe('var(--cinder-ring-width) solid ButtonText');
    expect(declValue(fallback, 'outline-offset')).toBe('-12px');
  });
});

describe('image-lightbox white-over-photo allowlist', () => {
  // Documented exception: white outline for contrast over an arbitrary photo
  // backdrop. The lint rule permits these via stylelint-disable-next-line; the
  // recipe test pins that the deliberate white ring is preserved AND that each
  // is annotated with a disable comment citing the contrast reason.
  for (const selector of ['.lightbox-close:focus-visible', '.lightbox-nav:focus-visible']) {
    test(`${selector} keeps the deliberate white outline`, () => {
      const root = parse(imageLightboxStyle);
      const rules = findRules(root, selector).filter((rule) => !isUnderForcedColors(rule));
      expect(rules.length).toBeGreaterThanOrEqual(1);
      expect(declValue(rules[0]!, 'outline')).toBe('2px solid white');
    });
  }

  test('both selectors are annotated with a stylelint-disable allowlist comment', () => {
    const disableMatches = imageLightboxStyle.match(
      /stylelint-disable-next-line cinder\/no-focus-visible-colored-outline/g,
    );
    expect(disableMatches?.length).toBe(2);
  });
});

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
 */
function assertForcedColorsFallback(css: string, selector: string): void {
  const root = parse(css);

  // The base (non-forced) rule must have a transparent outline and box-shadow.
  const baseRules = findRules(root, selector).filter((rule) => !isUnderForcedColors(rule));
  expect(baseRules.length).toBeGreaterThanOrEqual(1);
  const base = baseRules[0]!;
  const outlineValue = declValue(base, 'outline');
  expect(outlineValue).toBeDefined();
  expect(outlineValue).toContain('transparent');
  expect(declValue(base, 'box-shadow')).toBeDefined();

  // The forced-colors block must have a non-transparent ButtonText outline.
  const fallbackRules = findRules(root, selector).filter((rule) => isUnderForcedColors(rule));
  expect(fallbackRules.length).toBeGreaterThanOrEqual(1);
  const fallback = fallbackRules[0]!;
  const outline = declValue(fallback, 'outline');
  expect(outline).toBeDefined();
  expect(outline).not.toContain('transparent');
  expect(outline).toBe('var(--cinder-ring-width) solid ButtonText');
}

describe('forced-colors fallbacks — issue #460 (9 affected components)', () => {
  // Each entry asserts: transparent-outline + box-shadow in normal mode, plus
  // a non-transparent ButtonText outline in @media (forced-colors: active).
  const cases: Array<{ name: string; css: string; selector: string }> = [
    {
      name: 'capability-gate primary action',
      css: capabilityGateCss,
      selector: '.cinder-capability-gate__primary:focus-visible',
    },
    {
      name: 'capability-gate fallback action',
      css: capabilityGateCss,
      selector: '.cinder-capability-gate__fallback:focus-visible',
    },
    {
      name: 'capability-gate dismiss action',
      css: capabilityGateCss,
      selector: '.cinder-capability-gate__dismiss:focus-visible',
    },
    {
      name: 'kanban-board column-handle',
      css: kanbanBoardCss,
      selector: '.cinder-kanban-board__column-handle:focus-visible',
    },
    {
      name: 'kanban-board collapse',
      css: kanbanBoardCss,
      selector: '.cinder-kanban-board__collapse:focus-visible',
    },
    {
      name: 'media-controls button',
      css: mediaControlsCss,
      selector: '.cinder-media-controls__button:focus-visible',
    },
    {
      name: 'permission-matrix cell-control button',
      css: permissionMatrixCss,
      selector: 'button.cinder-permission-matrix__cell-control:focus-visible',
    },
    {
      name: 'share-card action',
      css: shareCardCss,
      selector: '.cinder-share-card__action:focus-visible',
    },
    {
      name: 'transfer-list list',
      css: transferListCss,
      selector: '.cinder-transfer-list__list:focus-visible',
    },
    {
      name: 'transfer-list control',
      css: transferListCss,
      selector: '.cinder-transfer-list__control:focus-visible',
    },
    {
      name: 'table sort-button',
      css: tableCss,
      selector: '.cinder-table__sort-button:focus-visible',
    },
    {
      name: 'menu-bar trigger',
      css: menuBarCss,
      selector: '.cinder-menu-bar__trigger:focus-visible',
    },
    {
      name: 'chat-conversation-list interactive button',
      css: chatConversationListCss,
      selector:
        '.cinder-chat-conversation-list__button[data-cinder-conversation-interactive]:focus-visible',
    },
  ];

  for (const { name, css, selector } of cases) {
    test(`${name}: ${selector} has a forced-colors fallback that repaints the outline`, () => {
      assertForcedColorsFallback(css, selector);
    });
  }
});
