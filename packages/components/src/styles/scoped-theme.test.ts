import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'bun:test';

const TOKENS_BASE_PATH = new URL('./tokens-base.css', import.meta.url);
const SIDEBAR_CSS_PATH = new URL('../components/sidebar/sidebar.css', import.meta.url);
const DRAWER_CSS_PATH = new URL('../components/drawer/drawer.css', import.meta.url);
const NAVIGATION_ITEM_CSS_PATH = new URL(
  '../components/navigation-item/navigation-item.css',
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

    expectDeclarations(extractRuleBlock(css, "[data-theme='dark']"), {
      'color-scheme': 'dark',
      '--cinder-bg': 'oklch(15% 0.035 245)',
      '--cinder-surface': 'oklch(20% 0.04 245)',
      '--cinder-surface-raised': 'oklch(26% 0.045 245)',
      '--cinder-surface-hover': 'color-mix(in oklch, var(--cinder-surface), oklch(100% 0 0) 3%)',
      '--cinder-text': 'oklch(92% 0.02 245)',
      '--cinder-text-muted': 'oklch(82% 0.02 245)',
      '--cinder-border': 'oklch(40% 0.05 245)',
      '--cinder-border-strong': 'oklch(45% 0.06 245)',
      '--cinder-overlay-backdrop': 'oklch(8% 0.02 245 / 0.65)',
    });

    expectDeclarations(extractRuleBlock(css, "[data-theme='light']"), {
      'color-scheme': 'light',
      '--cinder-bg': 'oklch(96% 0.01 245)',
      '--cinder-surface': 'oklch(98.5% 0.008 245)',
      '--cinder-surface-raised': 'oklch(100% 0.006 245)',
      '--cinder-surface-hover': 'color-mix(in oklch, var(--cinder-surface), oklch(0% 0 0) 3%)',
      '--cinder-text': 'oklch(20% 0.018 245)',
      '--cinder-text-muted': 'oklch(32% 0.014 245)',
      '--cinder-border': 'oklch(79% 0.013 245)',
      '--cinder-border-strong': 'oklch(72% 0.014 245)',
      '--cinder-overlay-backdrop': 'oklch(20% 0.03 245 / 0.5)',
    });
  });

  test('Sidebar and Drawer surfaces use scoped semantic tokens', async () => {
    const [sidebarCss, drawerCss, navigationItemCss] = await Promise.all([
      readFile(SIDEBAR_CSS_PATH, 'utf8'),
      readFile(DRAWER_CSS_PATH, 'utf8'),
      readFile(NAVIGATION_ITEM_CSS_PATH, 'utf8'),
    ]);

    expect(sidebarCss).toContain('background: var(--cinder-surface);');
    expect(sidebarCss).toContain('border-inline-end: 1px solid var(--cinder-border);');
    expect(sidebarCss).toContain('border-block-end: 1px solid var(--cinder-border);');
    expect(sidebarCss).toContain('border-block-start: 1px solid var(--cinder-border);');
    expect(navigationItemCss).toContain('color: var(--cinder-text-muted);');
    expect(navigationItemCss).toContain('color: var(--cinder-text);');
    expect(navigationItemCss).toContain('background-color: var(--cinder-surface-hover);');
    expect(navigationItemCss).toContain('background-color: var(--cinder-surface-inset);');

    expect(drawerCss).toContain('background-color: var(--cinder-overlay-backdrop);');
    expect(drawerCss).toContain('background: var(--cinder-surface-raised);');
    expect(drawerCss).toContain('border-inline-start: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('border-inline-end: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('border-block-end: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('border-block-start: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('color: var(--cinder-text);');
    expect(drawerCss).toContain('color: var(--cinder-text-muted);');
  });
});
