import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'bun:test';

const TOKENS_BASE_PATH = new URL('./tokens-base.css', import.meta.url);
const FOUNDATION_CSS_PATH = new URL('./foundation.css', import.meta.url);
const CODE_BLOCK_CSS_PATH = new URL('../components/code-block/code-block.css', import.meta.url);
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
      '--cinder-surface-canvas': 'oklch(15% 0.035 245)',
      '--cinder-accent-solid-hover': 'oklch(from var(--cinder-accent-solid) calc(l - 0.08) c h)',
      '--cinder-accent-solid-active': 'oklch(from var(--cinder-accent-solid) calc(l - 0.15) c h)',
      '--cinder-accent-solid-active-on-fill':
        'oklch(from var(--cinder-accent-solid) calc(l - 0.11) c h)',
      '--cinder-accent-text-hover': 'oklch(from var(--cinder-accent-text) calc(l - 0.08) c h)',
      '--cinder-ring-offset-color': 'var(--cinder-surface-raised)',
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
      '--cinder-surface-canvas': 'oklch(98.4% 0.003 255)',
      '--cinder-accent-solid-hover': 'oklch(from var(--cinder-accent-solid) calc(l - 0.08) c h)',
      '--cinder-accent-solid-active': 'oklch(from var(--cinder-accent-solid) calc(l - 0.15) c h)',
      '--cinder-accent-solid-active-on-fill':
        'oklch(from var(--cinder-accent-solid) calc(l - 0.11) c h)',
      '--cinder-accent-text-hover': 'oklch(from var(--cinder-accent-text) calc(l - 0.08) c h)',
      '--cinder-ring-offset-color': 'var(--cinder-surface-raised)',
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
    expect(sidebarCss).toContain('border-block-start: 1px solid var(--cinder-border-muted);');
    expect(navigationItemCss).toContain('color: var(--cinder-text-muted);');
    expect(navigationItemCss).toContain('color: var(--cinder-text-default);');
    expect(navigationItemCss).toContain('background-color: var(--cinder-surface-hover);');
    expect(navigationItemCss).toContain('background-color: var(--cinder-surface-inset);');
    expect(navigationItemCss).toContain(
      'var(--_cinder-navigation-item-ring, var(--cinder-ring-color))',
    );
    expect(navigationItemCss).toContain('border-bottom-color: var(--cinder-accent-solid);');
    expect(navigationItemCss).toContain('border-inline-start-color: var(--cinder-accent-solid);');
    expect(sideNavigationGroupCss).toContain(
      'var(--_cinder-side-navigation-group-trigger-ring, var(--cinder-ring-color))',
    );

    expect(drawerCss).toContain('background-color: var(--cinder-overlay-backdrop);');
    expect(drawerCss).toContain('background: var(--cinder-surface-raised);');
    expect(drawerCss).toContain('border-inline-start: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('border-inline-end: 1px solid var(--cinder-border);');
    expect(drawerCss).toContain('border-block-end: 1px solid var(--cinder-border-muted);');
    expect(drawerCss).toContain('border-block-start: 1px solid var(--cinder-border-muted);');
    expect(drawerCss).toContain('color: var(--cinder-text-default);');
    expect(drawerCss).toContain('color: var(--cinder-text-muted);');
    expect(buttonCss).toContain('background: var(--cinder-accent-solid);');
    expect(buttonCss).toContain('color: var(--cinder-accent-contrast);');
    expect(buttonCss).toContain('background: var(--cinder-status-danger-solid);');
    expect(buttonCss).toContain('color: var(--cinder-status-danger-contrast);');
    expect(buttonCss).toContain('background: var(--cinder-status-danger-background);');
    expect(buttonCss).toContain('color: var(--cinder-status-danger-text);');
    expect(buttonCss).toContain('border-color: var(--cinder-status-danger-border);');
  });

  test('foundation recomputes scoped focus and scoped Shiki dark overrides', async () => {
    const [foundationCss, codeBlockCss] = await Promise.all([
      readFile(FOUNDATION_CSS_PATH, 'utf8'),
      readFile(CODE_BLOCK_CSS_PATH, 'utf8'),
    ]);

    expect(foundationCss).toContain("[data-theme='dark'],\n[data-theme='light']");
    expect(foundationCss).not.toContain('@scope');
    expect(foundationCss).toContain("[data-theme='dark']");
    expect(foundationCss).toContain("[data-theme='dark']\n      [data-theme='light']");
    expect(foundationCss).toContain(
      "[data-theme='light']\n      [data-theme='dark']\n      [data-theme='light']",
    );
    expect(foundationCss).toContain(
      "[data-theme='light']\n  [data-theme='dark']\n  [data-theme='light']\n  [data-theme='dark']",
    );
    expect(codeBlockCss).toContain(
      "[data-cinder-theme='dark']\n        [data-theme='light']\n        [data-theme='dark']\n        [data-theme='light']",
    );
    expect(codeBlockCss).toContain(
      "[data-cinder-theme='dark']\n    [data-theme='light']\n    [data-theme='dark']\n    [data-theme='light']\n    [data-theme='dark']",
    );
    expect(codeBlockCss).toContain(
      "[data-cinder-theme='system'] [data-theme='light'] .cinder-code-block",
    );
    expect(codeBlockCss).toContain(
      "[data-cinder-theme='system']\n      [data-theme='light']\n      [data-theme='dark']\n      [data-theme='light']",
    );
    expect(foundationCss).toContain(
      "span[style*='--shiki-dark'] {\n  color: var(--shiki-dark, inherit) !important;",
    );
    expect(foundationCss).not.toContain('revert-layer');
    expect(foundationCss).not.toContain('--shiki-light');
  });

  test('an explicit reduced-motion preference disables component animation and transitions', async () => {
    const foundationCss = await readFile(FOUNDATION_CSS_PATH, 'utf8');
    const explicitPreferenceBlock = extractRuleBlock(
      foundationCss,
      ":root[data-reduced-motion='on'] *,\n:root[data-reduced-motion='on'],\n:root[data-reduced-motion='on'] *::before,\n:root[data-reduced-motion='on'] *::after",
    );

    expectDeclarations(explicitPreferenceBlock, {
      animation: 'none !important',
      transition: 'none !important',
      'scroll-behavior': 'auto !important',
    });
  });

  /**
   * The scoped blocks must AGREE with the `light-dark()` declarations they mirror.
   *
   * The assertions above pin each block's literals independently, which cannot see
   * divergence: a token retuned in the `:root` `light-dark()` declaration while its
   * `[data-theme='light']` twin is left behind satisfies both sets of literals, and
   * every consumer using an explicitly scoped theme silently keeps the old value.
   * That is exactly what happened during the 2026-08-05 surface retune — the whole
   * light ramp was updated at `:root` and the scoped block still carried the
   * previous ramp.
   *
   * This derives the expectation instead of restating it: for every token declared
   * as `light-dark(<light>, <dark>)` at `:root` that the scoped blocks also declare,
   * the light block must carry the LIGHT arm and the dark block the DARK arm.
   *
   * Arms are read by paren-depth scan, not by a value-shaped regex, so this covers
   * EVERY arm form actually used — `oklch(...)`, `var(...)` (e.g.
   * `--cinder-surface-inverse`), `transparent` (`--cinder-border-inverse`), and
   * nested `color-mix(...)` (the interaction states). An earlier version matched
   * only `light-dark(oklch(...), oklch(...))` and silently skipped the rest while
   * this comment claimed general coverage — the same overclaiming-comment failure
   * that let the scoped ramp drift in the first place. The coverage floor below
   * exists so the guard cannot quietly decay back into checking almost nothing.
   */
  test('scoped blocks match the light-dark() arms they mirror', async () => {
    const css = await readFile(TOKENS_BASE_PATH, 'utf8');
    const rootBlock = extractRuleBlock(css, ':root');
    const darkBlock = extractRuleBlock(css, "[data-theme='dark']");
    const lightBlock = extractRuleBlock(css, "[data-theme='light']");

    /** Compare values structurally, so line breaks and padding never matter. */
    const normalize = (value: string): string =>
      value
        .replace(/\s+/g, ' ')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .replace(/\s*,\s*/g, ',')
        .trim();

    /**
     * Every `--cinder-*: <value>;` in a block, keyed by token. Scans on paren depth
     * so a multi-line `color-mix(...)` or nested `light-dark(...)` is captured whole
     * rather than truncated at the first `)`.
     */
    function declarationsIn(block: string): Map<string, string> {
      const declarations = new Map<string, string>();
      const tokenPattern = /(--cinder-[\w-]+)\s*:/g;
      for (const match of block.matchAll(tokenPattern)) {
        const valueStart = match.index + match[0].length;
        let depth = 0;
        let end = valueStart;
        for (; end < block.length; end += 1) {
          const character = block[end];
          if (character === '(') depth += 1;
          else if (character === ')') depth -= 1;
          else if (character === ';' && depth === 0) break;
        }
        declarations.set(match[1] as string, normalize(block.slice(valueStart, end)));
      }
      return declarations;
    }

    /** Split a `light-dark(a, b)` value into its two top-level arms. */
    function lightDarkArms(value: string): { light: string; dark: string } | null {
      if (!value.startsWith('light-dark(')) return null;
      const body = value.slice('light-dark('.length, -1);
      let depth = 0;
      for (let index = 0; index < body.length; index += 1) {
        const character = body[index];
        if (character === '(') depth += 1;
        else if (character === ')') depth -= 1;
        else if (character === ',' && depth === 0) {
          return {
            light: normalize(body.slice(0, index)),
            dark: normalize(body.slice(index + 1)),
          };
        }
      }
      return null;
    }

    const rootDeclarations = declarationsIn(rootBlock);
    const lightDeclarations = declarationsIn(lightBlock);
    const darkDeclarations = declarationsIn(darkBlock);

    const mismatches: string[] = [];
    let compared = 0;

    for (const [token, rootValue] of rootDeclarations) {
      const arms = lightDarkArms(rootValue);
      if (!arms) continue;

      const scopedLight = lightDeclarations.get(token);
      if (scopedLight !== undefined) {
        compared += 1;
        if (scopedLight !== arms.light && scopedLight !== rootValue) {
          mismatches.push(`light ${token}: scoped "${scopedLight}" vs :root "${arms.light}"`);
        }
      }

      const scopedDark = darkDeclarations.get(token);
      if (scopedDark !== undefined) {
        compared += 1;
        if (scopedDark !== arms.dark && scopedDark !== rootValue) {
          mismatches.push(`dark ${token}: scoped "${scopedDark}" vs :root "${arms.dark}"`);
        }
      }
    }

    expect(mismatches).toEqual([]);

    /**
     * The comparison above only inspects a token when the scoped block DECLARES
     * it (`scopedLight !== undefined`), so a token overridden in exactly one
     * theme was invisible to it -- and that absence is itself the bug. Custom
     * properties inherit as COMPUTED values, so the missing block does not fall
     * back to the `:root` `light-dark()` declaration; a nested island of that
     * theme inherits whatever arm its themed ancestor already substituted.
     *
     * `--cinder-code-block-background` is why this exists: overridden only in
     * `dark.tokens.json`, it left a `[data-theme='light']` island inside a dark
     * ancestor sitting on the dark `surface-inset` ground while Shiki painted
     * github-light token colors over it -- the AA failure that token's own
     * description warns about.
     *
     * The two blocks must therefore declare the SAME set of custom properties.
     * Values legitimately differ per arm; presence must not.
     */
    const lightKeys = [...lightDeclarations.keys()].sort();
    const darkKeys = [...darkDeclarations.keys()].sort();
    expect({
      declaredOnlyInLight: lightKeys.filter((token) => !darkDeclarations.has(token)),
      declaredOnlyInDark: darkKeys.filter((token) => !lightDeclarations.has(token)),
    }).toEqual({ declaredOnlyInLight: [], declaredOnlyInDark: [] });

    // The surface ramp is the family this guard exists for — assert it is genuinely
    // in scope rather than trusting the scan.
    for (const token of [
      '--cinder-surface-canvas',
      '--cinder-surface',
      '--cinder-surface-inset',
      '--cinder-surface-raised',
      '--cinder-surface-hover',
      '--cinder-surface-inverse',
    ]) {
      expect(
        lightDarkArms(rootDeclarations.get(token) ?? ''),
        `${token} must be in scope`,
      ).not.toBe(null);
    }

    // Coverage floor. A parser change that stops matching most tokens would
    // otherwise leave this test passing vacuously.
    expect(compared).toBeGreaterThanOrEqual(60);
  });
});
