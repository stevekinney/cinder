import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'bun:test';

const TOKENS_BASE_PATH = new URL('./tokens-base.css', import.meta.url);
const FOUNDATION_CSS_PATH = new URL('./foundation.css', import.meta.url);
const SIDEBAR_CSS_PATH = new URL('../components/sidebar/sidebar.css', import.meta.url);
const DRAWER_CSS_PATH = new URL('../components/drawer/drawer.css', import.meta.url);
const BUTTON_CSS_PATH = new URL('../components/button/button.css', import.meta.url);
const NAVIGATION_ITEM_CSS_PATH = new URL(
  '../components/navigation-item/navigation-item.css',
  import.meta.url,
);
const SIDE_NAVIGATION_GROUP_CSS_PATH = new URL(
  '../components/side-navigation-group/side-navigation-group.css',
  import.meta.url,
);

function extractRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const selectorPattern = new RegExp(`^${escapedSelector}\\s*\\{`, 'm');
  const selectorMatch = selectorPattern.exec(css);
  if (!selectorMatch) throw new Error(`Missing ${selector} rule`);

  const openBrace = css.indexOf('{', selectorMatch.index);
  let depth = 0;

  for (let index = openBrace; index < css.length; index += 1) {
    const character = css[index];
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(openBrace + 1, index);
    }
  }

  throw new Error(`Unclosed ${selector} rule`);
}

function expectDeclarations(block: string, declarations: Record<string, string>): void {
  for (const [property, value] of Object.entries(declarations)) {
    expect(block).toContain(`${property}: ${value};`);
  }
}

describe('scoped theme tokens', () => {
  test('data-theme dark and light scopes pin core semantic tokens locally', async () => {
    const css = await readFile(TOKENS_BASE_PATH, 'utf8');
    const darkBlock = extractRuleBlock(css, "[data-theme='dark']");
    const lightBlock = extractRuleBlock(css, "[data-theme='light']");

    expect(darkBlock).toContain(
      '--cinder-shadow-sm: 0 1px 2px oklch(100% 0 0 / 0.09), 0 1px 1px oklch(100% 0 0 / 0.05);',
    );
    expect(darkBlock).toContain(
      '--cinder-shadow-md: 0 4px 6px -1px oklch(100% 0 0 / 0.09), 0 2px 4px -2px oklch(100% 0 0 / 0.06);',
    );
    expect(darkBlock).toContain(
      '--cinder-shadow-lg:\n    0 10px 15px -3px oklch(100% 0 0 / 0.11), 0 4px 6px -4px oklch(100% 0 0 / 0.07);',
    );
    expect(darkBlock).toContain(
      '--cinder-shadow-overlay:\n    0 10px 15px -3px oklch(0% 0 0 / 0.45), 0 4px 6px -4px oklch(0% 0 0 / 0.32);',
    );

    expectDeclarations(darkBlock, {
      'color-scheme': 'dark',
      '--cinder-bg': 'oklch(15% 0.035 245)',
      '--cinder-surface': 'oklch(20% 0.04 245)',
      '--cinder-surface-raised': 'oklch(26% 0.045 245)',
      '--cinder-surface-hover': 'color-mix(in oklch, var(--cinder-surface), oklch(100% 0 0) 3%)',
      '--cinder-text': 'oklch(92% 0.02 245)',
      '--cinder-text-muted': 'oklch(82% 0.02 245)',
      '--cinder-border': 'oklch(40% 0.05 245)',
      '--cinder-border-strong': 'oklch(45% 0.06 245)',
      '--cinder-accent': 'oklch(72% 0.14 270)',
      '--cinder-accent-contrast': 'oklch(15% 0.035 245)',
      '--cinder-accent-hover': 'oklch(from var(--cinder-accent) calc(l - 0.08) c h)',
      '--cinder-accent-active': 'oklch(from var(--cinder-accent) calc(l - 0.15) c h)',
      '--cinder-accent-active-on-fill': 'oklch(from var(--cinder-accent) calc(l - 0.11) c h)',
      '--cinder-accent-text-hover': 'oklch(from var(--cinder-accent-text) calc(l - 0.08) c h)',
      '--cinder-danger': 'oklch(72% 0.172 25)',
      '--cinder-danger-contrast': 'oklch(12% 0.02 25)',
      '--cinder-danger-hover': 'oklch(64% 0.172 25)',
      '--cinder-danger-active': 'oklch(57% 0.172 25)',
      '--cinder-color-danger-bg': 'oklch(28% 0.09 25)',
      '--cinder-color-danger-fg': 'oklch(90% 0.12 25)',
      '--cinder-color-danger-border': 'oklch(50% 0.11 25)',
      '--cinder-color-checker-base': 'oklch(28% 0.02 245)',
      '--cinder-color-checker-tile': 'oklch(38% 0.02 245)',
      '--cinder-scrollbar-track': 'oklch(100% 0 0 / 0.04)',
      '--cinder-scrollbar-thumb': 'oklch(100% 0 0 / 0.45)',
      '--cinder-scrollbar-thumb-hover': 'oklch(100% 0 0 / 0.65)',
      '--cinder-ring-color': 'oklch(from var(--cinder-accent) 0.7 0.14 h)',
      '--cinder-chart-series-1': 'oklch(58% 0.089 205)',
      '--cinder-overlay-backdrop': 'oklch(8% 0.02 245 / 0.65)',
    });

    expect(lightBlock).toContain(
      '--cinder-shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.1), 0 1px 1px oklch(0% 0 0 / 0.06);',
    );
    expect(lightBlock).toContain(
      '--cinder-shadow-md: 0 4px 6px -1px oklch(0% 0 0 / 0.12), 0 2px 4px -2px oklch(0% 0 0 / 0.1);',
    );
    expect(lightBlock).toContain(
      '--cinder-shadow-lg: 0 10px 15px -3px oklch(0% 0 0 / 0.14), 0 4px 6px -4px oklch(0% 0 0 / 0.12);',
    );
    expect(lightBlock).toContain(
      '--cinder-shadow-overlay:\n    0 10px 15px -3px oklch(0% 0 0 / 0.14), 0 4px 6px -4px oklch(0% 0 0 / 0.12);',
    );

    expectDeclarations(lightBlock, {
      'color-scheme': 'light',
      '--cinder-bg': 'oklch(96% 0.01 245)',
      '--cinder-surface': 'oklch(98.5% 0.008 245)',
      '--cinder-surface-raised': 'oklch(100% 0.006 245)',
      '--cinder-surface-hover': 'color-mix(in oklch, var(--cinder-surface), oklch(0% 0 0) 3%)',
      '--cinder-text': 'oklch(20% 0.018 245)',
      '--cinder-text-muted': 'oklch(32% 0.014 245)',
      '--cinder-border': 'oklch(79% 0.013 245)',
      '--cinder-border-strong': 'oklch(72% 0.014 245)',
      '--cinder-accent': 'oklch(50% 0.22 270)',
      '--cinder-accent-contrast': 'oklch(100% 0 0)',
      '--cinder-accent-hover': 'oklch(from var(--cinder-accent) calc(l - 0.08) c h)',
      '--cinder-accent-active': 'oklch(from var(--cinder-accent) calc(l - 0.15) c h)',
      '--cinder-accent-active-on-fill': 'oklch(from var(--cinder-accent) calc(l - 0.11) c h)',
      '--cinder-accent-text-hover': 'oklch(from var(--cinder-accent-text) calc(l - 0.08) c h)',
      '--cinder-danger': 'oklch(50% 0.202 25)',
      '--cinder-danger-contrast': 'oklch(100% 0 0)',
      '--cinder-danger-hover': 'oklch(42% 0.171 25)',
      '--cinder-danger-active': 'oklch(35% 0.142 25)',
      '--cinder-color-danger-bg': 'oklch(96% 0.04 25)',
      '--cinder-color-danger-fg': 'oklch(42% 0.16 25)',
      '--cinder-color-danger-border': 'oklch(80% 0.06 25)',
      '--cinder-color-checker-base': '#fff',
      '--cinder-color-checker-tile': '#ccc',
      '--cinder-scrollbar-track': 'oklch(0% 0 0 / 0.04)',
      '--cinder-scrollbar-thumb': 'oklch(0% 0 0 / 0.45)',
      '--cinder-scrollbar-thumb-hover': 'oklch(0% 0 0 / 0.65)',
      '--cinder-ring-color': 'oklch(from var(--cinder-accent) 0.55 0.16 h)',
      '--cinder-chart-series-1': 'oklch(33% 0.121 8)',
      '--cinder-overlay-backdrop': 'oklch(20% 0.03 245 / 0.5)',
    });
  });

  test('Sidebar and Drawer surfaces use scoped semantic tokens', async () => {
    const [sidebarCss, drawerCss, buttonCss, navigationItemCss, sideNavigationGroupCss] =
      await Promise.all([
        readFile(SIDEBAR_CSS_PATH, 'utf8'),
        readFile(DRAWER_CSS_PATH, 'utf8'),
        readFile(BUTTON_CSS_PATH, 'utf8'),
        readFile(NAVIGATION_ITEM_CSS_PATH, 'utf8'),
        readFile(SIDE_NAVIGATION_GROUP_CSS_PATH, 'utf8'),
      ]);

    expect(sidebarCss).toContain('background: var(--cinder-surface);');
    expect(sidebarCss).toContain('border-inline-end: 1px solid var(--cinder-border);');
    expect(sidebarCss).toContain('border-block-end: 1px solid var(--cinder-border);');
    expect(sidebarCss).toContain('border-block-start: 1px solid var(--cinder-border);');
    expect(navigationItemCss).toContain('color: var(--cinder-text-muted);');
    expect(navigationItemCss).toContain('color: var(--cinder-text);');
    expect(navigationItemCss).toContain('background-color: var(--cinder-surface-hover);');
    expect(navigationItemCss).toContain('background-color: var(--cinder-surface-inset);');
    expect(navigationItemCss).toContain(
      'var(--_cinder-navigation-item-ring, var(--cinder-ring-color))',
    );
    expect(navigationItemCss).toContain('border-bottom-color: var(--cinder-accent);');
    expect(navigationItemCss).toContain('border-inline-start-color: var(--cinder-accent);');
    expect(sideNavigationGroupCss).toContain(
      'var(--_cinder-side-navigation-group-trigger-ring, var(--cinder-ring-color))',
    );

    expect(drawerCss).toContain('background-color: var(--cinder-overlay-backdrop);');
    expect(drawerCss).toContain('background: var(--cinder-surface-raised);');
    expect(drawerCss).toContain('border-inline-start: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('border-inline-end: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('border-block-end: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('border-block-start: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('color: var(--cinder-text);');
    expect(drawerCss).toContain('color: var(--cinder-text-muted);');
    expect(buttonCss).toContain('background: var(--cinder-accent);');
    expect(buttonCss).toContain('color: var(--cinder-accent-contrast);');
    expect(buttonCss).toContain('background: var(--cinder-danger);');
    expect(buttonCss).toContain('color: var(--cinder-danger-contrast);');
    expect(buttonCss).toContain('background: var(--cinder-color-danger-bg);');
    expect(buttonCss).toContain('color: var(--cinder-color-danger-fg);');
    expect(buttonCss).toContain('border-color: var(--cinder-color-danger-border);');
  });

  test('foundation recomputes scoped focus and scoped Shiki dark overrides', async () => {
    const foundationCss = await readFile(FOUNDATION_CSS_PATH, 'utf8');

    expect(foundationCss).toContain("[data-theme='dark'],\n[data-theme='light']");
    expect(foundationCss).not.toContain('@scope');
    expect(foundationCss).toContain("[data-theme='dark']");
    expect(foundationCss).toContain("[data-theme='dark']\n      [data-theme='light']");
    expect(foundationCss).toContain(
      "span[style*='--shiki-dark'] {\n  color: var(--shiki-dark, inherit) !important;",
    );
    expect(foundationCss).not.toContain('revert-layer');
    expect(foundationCss).not.toContain('--shiki-light');
  });
});
