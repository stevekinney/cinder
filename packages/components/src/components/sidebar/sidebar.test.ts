/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderToServerHtml } from '../../test/server-render.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Sidebar } = await import('./sidebar.svelte');
const { SIDEBAR_MOBILE_BREAKPOINT, SIDEBAR_MOBILE_MEDIA_QUERY } = await import('./index.ts');
const SIDEBAR_SOURCE = new URL('./sidebar.svelte', import.meta.url).pathname;

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

function listSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<ul><li>${text}</li></ul>`,
    setup: () => {},
  }));
}

describe('Sidebar (desktop / inline aside)', () => {
  test('renders an <aside> landmark', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')).not.toBeNull();
  });

  test('aside has default aria-label "Sidebar"', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')?.getAttribute('aria-label')).toBe('Sidebar');
  });

  test('aside uses the supplied label', () => {
    const { container } = render(Sidebar, {
      props: { label: 'Workspace', navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')?.getAttribute('aria-label')).toBe('Workspace');
  });

  test('empty label throws on initial render', () => {
    expect(() => {
      render(Sidebar, {
        props: { label: '', navigation: listSnippet('items') },
      });
    }).toThrow();
  });

  test('whitespace-only label throws on initial render', () => {
    expect(() => {
      render(Sidebar, {
        props: { label: '   ', navigation: listSnippet('items') },
      });
    }).toThrow();
  });

  test('aside carries cinder-sidebar class', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside.cinder-sidebar')).not.toBeNull();
  });

  test('consumer class prop merges onto the aside', () => {
    const { container } = render(Sidebar, {
      props: { class: 'my-sidebar', navigation: listSnippet('items') },
    });
    const aside = container.querySelector('aside');
    expect(aside?.classList.contains('cinder-sidebar')).toBe(true);
    expect(aside?.classList.contains('my-sidebar')).toBe(true);
  });

  test('renders <nav> inside the aside with a distinct aria-label', () => {
    const { container } = render(Sidebar, {
      props: { label: 'Workspace', navigation: listSnippet('items') },
    });
    const nav = container.querySelector('aside nav.cinder-sidebar__nav');
    expect(nav).not.toBeNull();
    // The inner <nav> landmark gets a distinct accessible name so it is not
    // announced identically to the outer <aside> complementary landmark.
    expect(nav?.getAttribute('aria-label')).toBe('Workspace navigation');
  });

  test('outer aside aria-label is distinct from inner nav aria-label', () => {
    const { container } = render(Sidebar, {
      props: { label: 'Workspace', navigation: listSnippet('items') },
    });
    const aside = container.querySelector('aside');
    const nav = container.querySelector('aside nav.cinder-sidebar__nav');
    expect(aside?.getAttribute('aria-label')).toBe('Workspace');
    expect(nav?.getAttribute('aria-label')).not.toBe(aside?.getAttribute('aria-label'));
  });

  test('renders navigation snippet inside the nav', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('payload') },
    });
    const nav = container.querySelector('aside nav.cinder-sidebar__nav');
    expect(nav?.textContent ?? '').toContain('payload');
  });

  test('omits brand region when no brand snippet is provided', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('.cinder-sidebar__brand')).toBeNull();
  });

  test('renders brand snippet inside .cinder-sidebar__brand when provided', () => {
    const { container } = render(Sidebar, {
      props: { brand: textSnippet('Cinder'), navigation: listSnippet('items') },
    });
    const brand = container.querySelector('.cinder-sidebar__brand');
    expect(brand).not.toBeNull();
    expect(brand?.textContent ?? '').toContain('Cinder');
  });

  test('omits footer region when no footer snippet is provided', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('.cinder-sidebar__footer')).toBeNull();
  });

  test('renders footer snippet inside .cinder-sidebar__footer when provided', () => {
    const { container } = render(Sidebar, {
      props: { footer: textSnippet('Sign out'), navigation: listSnippet('items') },
    });
    const footer = container.querySelector('.cinder-sidebar__footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent ?? '').toContain('Sign out');
  });

  test('does not set data-cinder-collapsed when collapsed=false', () => {
    const { container } = render(Sidebar, {
      props: { collapsed: false, navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')?.hasAttribute('data-cinder-collapsed')).toBe(false);
  });

  test('sets data-cinder-collapsed when collapsed=true', () => {
    const { container } = render(Sidebar, {
      props: { collapsed: true, navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')?.hasAttribute('data-cinder-collapsed')).toBe(true);
  });

  test('aria-label in rest spread cannot override the component-owned label', () => {
    const { container } = render(Sidebar, {
      props: {
        label: 'Sections',
        'aria-label': 'Overridden',
        navigation: listSnippet('items'),
      } as unknown as Parameters<typeof render>[1]['props'],
    });
    expect(container.querySelector('aside')?.getAttribute('aria-label')).toBe('Sections');
  });

  test('aria-labelledby in rest spread is not forwarded', () => {
    const { container } = render(Sidebar, {
      props: {
        label: 'Sections',
        'aria-labelledby': 'external-id',
        navigation: listSnippet('items'),
      } as unknown as Parameters<typeof render>[1]['props'],
    });
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('aria-label')).toBe('Sections');
    expect(aside?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('rest attributes spread onto the aside', () => {
    const { container } = render(Sidebar, {
      props: {
        navigation: listSnippet('items'),
        'data-testid': 'side',
      } as never,
    });
    expect(container.querySelector('aside')?.getAttribute('data-testid')).toBe('side');
  });

  test('id lands on the desktop aside', () => {
    const { container } = render(Sidebar, {
      props: {
        id: 'primary-sidebar',
        navigation: listSnippet('items'),
      },
    });
    expect(container.querySelector('aside')?.getAttribute('id')).toBe('primary-sidebar');
  });
});

describe('Sidebar SSR responsive fallback', () => {
  test('exports the mobile drawer breakpoint contract', () => {
    expect(SIDEBAR_MOBILE_BREAKPOINT).toBe('47.99rem');
    expect(SIDEBAR_MOBILE_MEDIA_QUERY).toBe('(max-width: 47.99rem)');
  });

  test('marks the no-matchMedia desktop aside as a mobile first-paint fallback', () => {
    const hadMatchMedia = 'matchMedia' in window;
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const { container } = render(Sidebar, {
        props: { id: 'workspace-sidebar', label: 'Workspace', navigation: listSnippet('items') },
      });
      const asides = container.querySelectorAll('aside.cinder-sidebar');
      expect(asides).toHaveLength(1);
      expect(asides[0]?.id).toBe('workspace-sidebar');
      expect(asides[0]?.classList.contains('cinder-sidebar--desktop')).toBe(true);
      expect(asides[0]?.hasAttribute('data-cinder-ssr-mobile-fallback')).toBe(true);
    } finally {
      if (hadMatchMedia) {
        Object.defineProperty(window, 'matchMedia', {
          value: originalMatchMedia,
          configurable: true,
          writable: true,
        });
      } else {
        delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
      }
    }
  });

  test('server output marks the desktop aside for mobile first-paint hiding', async () => {
    const html = await renderToServerHtml(SIDEBAR_SOURCE, {
      id: 'workspace-sidebar',
      label: 'Workspace',
    });

    expect(html).toContain('id="workspace-sidebar"');
    expect(html).toMatch(
      /\bclass="(?=[^"]*\bcinder-sidebar\b)(?=[^"]*\bcinder-sidebar--desktop\b)[^"]*"/,
    );
    expect(html).toContain('data-cinder-ssr-mobile-fallback');
  });

  test('component CSS hides only the SSR fallback on mobile first paint', async () => {
    const css = await Bun.file(new URL('./sidebar.css', import.meta.url)).text();
    const escapedBreakpoint = SIDEBAR_MOBILE_BREAKPOINT.replace('.', '\\.');
    expect(css).toMatch(
      new RegExp(
        `@media\\s*\\(\\s*max-width:\\s*${escapedBreakpoint}\\s*\\)[\\s\\S]*?\\.cinder-sidebar--desktop\\[data-cinder-ssr-mobile-fallback\\]\\s*{\\s*display:\\s*none;\\s*}`,
      ),
    );
    expect(css).toMatch(
      /\.cinder-sidebar--desktop\[data-cinder-collapsed\]\s*{\s*display:\s*none;\s*}/,
    );
  });
});

describe('Sidebar context', () => {
  test('publishes collapsed state to descendants (collapsed=false)', async () => {
    const { default: Fixture } = await import('../../test/fixtures/sidebar-context-fixture.svelte');
    const { container } = render(Fixture, { props: { collapsed: false } });
    const probe = container.querySelector('[data-sidebar-probe]');
    expect(probe?.getAttribute('data-context')).toBe('present');
    expect(probe?.getAttribute('data-collapsed')).toBe('false');
  });

  test('publishes collapsed state to descendants (collapsed=true)', async () => {
    const { default: Fixture } = await import('../../test/fixtures/sidebar-context-fixture.svelte');
    const { container } = render(Fixture, { props: { collapsed: true } });
    const probe = container.querySelector('[data-sidebar-probe]');
    expect(probe?.getAttribute('data-context')).toBe('present');
    expect(probe?.getAttribute('data-collapsed')).toBe('true');
  });

  test('descendants outside a Sidebar see undefined context', async () => {
    const { default: Probe } = await import('../../test/fixtures/sidebar-context-probe.svelte');
    const { container } = render(Probe);
    const probe = container.querySelector('[data-sidebar-probe]');
    expect(probe?.getAttribute('data-context')).toBe('absent');
    // No context means data-collapsed is omitted entirely — distinguishable from
    // a Sidebar-wrapped probe with collapsed=false.
    expect(probe?.hasAttribute('data-collapsed')).toBe(false);
  });

  test('context collapsed updates reactively when the prop changes', async () => {
    const { default: Fixture } = await import('../../test/fixtures/sidebar-context-fixture.svelte');
    const { container, rerender } = render(Fixture, { props: { collapsed: false } });
    const probe = container.querySelector('[data-sidebar-probe]');
    expect(probe?.getAttribute('data-collapsed')).toBe('false');
    await rerender({ collapsed: true });
    expect(probe?.getAttribute('data-collapsed')).toBe('true');
  });
});

// ----------------------------------------
// Mobile / drawer branch — matchMedia mock forces `MediaQuery.current = true`
// so the `{#if mobile.current}` branch is exercised.
// ----------------------------------------

type Listener = (event: { matches: boolean }) => void;

function installMatchMediaMock(initialMatches: boolean) {
  const queries: string[] = [];
  const list = {
    matches: initialMatches,
    media: SIDEBAR_MOBILE_MEDIA_QUERY,
    onchange: null as Listener | null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };
  const originalMatchMedia = (window as unknown as { matchMedia?: typeof window.matchMedia })
    .matchMedia;
  (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = ((query: string) => {
    queries.push(query);

    if (query === SIDEBAR_MOBILE_MEDIA_QUERY) {
      return list as unknown as MediaQueryList;
    }

    return {
      ...list,
      matches: false,
      media: query,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return {
    list,
    queries,
    restore() {
      if (originalMatchMedia) {
        (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia =
          originalMatchMedia;
      } else {
        delete (window as unknown as { matchMedia?: typeof window.matchMedia }).matchMedia;
      }
    },
  };
}

function expectMobileQueryWasUsed(mock: ReturnType<typeof installMatchMediaMock>): void {
  expect(mock.queries).toContain(SIDEBAR_MOBILE_MEDIA_QUERY);
}

// happy-dom doesn't implement HTMLDialogElement.showModal / close — stub them
// the same way drawer.test.ts does so the mobile <Drawer> can render.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function () {
        Object.defineProperty(this, 'open', {
          value: true,
          configurable: true,
          writable: true,
        });
        this.setAttribute('open', '');
      },
      configurable: true,
      writable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function () {
        Object.defineProperty(this, 'open', {
          value: false,
          configurable: true,
          writable: true,
        });
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
      configurable: true,
      writable: true,
    });
  }
}

describe('Sidebar (mobile / drawer)', () => {
  let mock: ReturnType<typeof installMatchMediaMock> | undefined;

  afterEach(() => {
    mock?.restore();
    mock = undefined;
  });

  test('renders a <dialog> instead of an <aside>', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expectMobileQueryWasUsed(mock);
    expect(container.querySelector('dialog')).not.toBeNull();
    expect(container.querySelector('aside')).toBeNull();
  });

  test('mobile branch wraps content in .cinder-sidebar.cinder-sidebar--mobile', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expectMobileQueryWasUsed(mock);
    const wrapper = container.querySelector('dialog .cinder-sidebar.cinder-sidebar--mobile');
    expect(wrapper).not.toBeNull();
  });

  test('consumer class prop merges onto the mobile sidebar wrapper', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: { class: 'my-sidebar', navigation: listSnippet('items') },
    });
    expectMobileQueryWasUsed(mock);
    const wrapper = container.querySelector('dialog .cinder-sidebar.cinder-sidebar--mobile');
    expect(wrapper?.classList.contains('my-sidebar')).toBe(true);
  });

  test('mobile nav landmark has the distinct navigation label', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: { label: 'Workspace', navigation: listSnippet('items') },
    });
    expectMobileQueryWasUsed(mock);
    const nav = container.querySelector('dialog nav.cinder-sidebar__nav');
    expect(nav?.getAttribute('aria-label')).toBe('Workspace navigation');
  });

  test('mobile branch forwards rest attributes onto the drawer dialog', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: {
        navigation: listSnippet('items'),
        'data-testid': 'mobile-side',
      } as never,
    });
    expectMobileQueryWasUsed(mock);
    const dialog = container.querySelector('dialog');
    const wrapper = container.querySelector('.cinder-sidebar.cinder-sidebar--mobile');
    expect(dialog?.getAttribute('data-testid')).toBe('mobile-side');
    expect(wrapper?.hasAttribute('data-testid')).toBe(false);
  });

  test('mobile id lands on the persistent drawer dialog for aria-controls', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: {
        id: 'primary-sidebar',
        collapsed: true,
        navigation: listSnippet('items'),
      },
    });
    expectMobileQueryWasUsed(mock);
    const dialog = container.querySelector('dialog');
    const wrapper = container.querySelector('.cinder-sidebar.cinder-sidebar--mobile');
    expect(dialog?.getAttribute('id')).toBe('primary-sidebar');
    expect(wrapper).toBeNull();
  });

  test('mobile brand and footer render inside the drawer', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: {
        brand: textSnippet('Cinder'),
        navigation: listSnippet('items'),
        footer: textSnippet('Sign out'),
      },
    });
    expectMobileQueryWasUsed(mock);
    expect(container.querySelector('dialog .cinder-sidebar__brand')?.textContent ?? '').toContain(
      'Cinder',
    );
    expect(container.querySelector('dialog .cinder-sidebar__footer')?.textContent ?? '').toContain(
      'Sign out',
    );
    expect(container.querySelector('dialog .cinder-drawer__footer')).toBeNull();
  });

  test('mobile branch omits drawer footer when no footer snippet is provided', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expectMobileQueryWasUsed(mock);
    expect(container.querySelector('dialog .cinder-sidebar__footer')).toBeNull();
    expect(container.querySelector('dialog .cinder-drawer__footer')).toBeNull();
  });

  test('mobile wrapper does not carry data-cinder-collapsed', () => {
    // On mobile, drawer open/closed represents collapsed state. Putting
    // data-cinder-collapsed on the wrapper would activate icon-rail CSS
    // inside an open drawer for one frame when the consumer flips collapsed
    // from true to false to open the drawer.
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: { collapsed: true, navigation: listSnippet('items') },
    });
    expectMobileQueryWasUsed(mock);
    const wrapper = container.querySelector('.cinder-sidebar.cinder-sidebar--mobile');
    // collapsed=true with mobile=true → drawer closed → wrapper not rendered
    expect(wrapper).toBeNull();
  });
});

/**
 * Collapsed-state CSS contract.
 *
 * Happy-dom (the test runtime here) does not implement layout, so
 * stylesheet-driven `getComputedStyle` and `getBoundingClientRect` cannot
 * verify visual hiding. The contract is instead locked at the CSS source
 * layer by parsing the file and checking that every required (arm × rule
 * group) pair is present, with the required declaration set on the
 * visually-hidden rule and an explicit ban on declarations that would remove
 * the label from the accessibility tree. A future Playwright story should
 * verify the rendered visual result; this lock catches selector regressions
 * that would silently break the icon-rail in collapsed mode.
 *
 * The parser splits on `}` because `sidebar.css` has no nested at-rules. If
 * a `@media` (or other nesting) is added later, the parser must be updated.
 */

type CssRule = { selectors: string[]; declarations: string };

function parseCssRules(css: string): CssRule[] {
  // Strip `/* ... */` comments first — they would otherwise glue onto the
  // following selector list when we split on `}`.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return stripped
    .split('}')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.includes('{'))
    .map((chunk) => {
      const braceIndex = chunk.indexOf('{');
      const selectorList = chunk.slice(0, braceIndex);
      const declarations = chunk.slice(braceIndex + 1).trim();
      const selectors = selectorList
        .split(',')
        .map((selector) => selector.replace(/\s+/g, ' ').trim())
        .filter((selector) => selector.length > 0);
      return { selectors, declarations };
    });
}

const COLLAPSED_SCOPE = '.cinder-sidebar[data-cinder-collapsed] ';

// Each arm key maps to the selector substring that proves the rule covers
// that arm. Substrings are anchored on the unique class+element pairing so
// they cannot match unrelated selectors like `.cinder-side-navigation`
// (group container) by accident.
const ARM_KEYS = ['side-nav-a', 'side-nav-button', 'footer-a', 'footer-button'] as const;
type ArmKey = (typeof ARM_KEYS)[number];

const ARM_BASE: Record<ArmKey, string> = {
  'side-nav-a': '.cinder-side-navigation a.cinder-navigation-item',
  'side-nav-button': '.cinder-side-navigation button.cinder-navigation-item',
  'footer-a': '.cinder-sidebar__footer a.cinder-navigation-item',
  'footer-button': '.cinder-sidebar__footer button.cinder-navigation-item',
};

// Selector shape variants distinguish which part of the arm-base selector
// the rule targets:
// - `base`: the interactive element itself, with no trailing combinator
//   (the icon-only width rule).
// - `label-child`: a non-icon child of the interactive element — matched
//   via the literal `:not([aria-hidden='true']):not(svg):not(img)` filter
//   used by the visually-hidden rule, which is the only child target that
//   should be visually hidden. Plain `> ` would also accept `> svg` and
//   misreport the icon-only descendants as label-hiding coverage.
// - `descendant-svg-or-img`: SVG/IMG icon children of the interactive
//   element (the pass-through that restores icon sizing).
// - `descendant-aria-hidden`: wrapped icon containers marked with
//   `aria-hidden="true"` (same pass-through, different element shape).
type ArmShape = 'base' | 'label-child' | 'descendant-svg-or-img' | 'descendant-aria-hidden';

// Matches the label-child suffix structurally — a `>` combinator followed
// by three `:not()` exclusions covering svg, img, and `aria-hidden="true"`
// children, in any order, with either quote style. This avoids both the
// over-broad `> ` match (which would accept `> svg`) and the over-narrow
// fixed-string match (which would break on harmless reformatting like
// reordered exclusions or swapped quote style).
function matchesLabelChildSuffix(suffix: string): boolean {
  const normalized = suffix.replace(/\s+/g, ' ').trim();
  if (!normalized.startsWith('>')) return false;
  // Must exclude all three icon paths so the rule only targets label-bearing
  // children — never icon descendants.
  const excludesAriaHidden = /:not\(\[aria-hidden=(["'])true\1\]\)/.test(normalized);
  const excludesSvg = /:not\(svg\)/.test(normalized);
  const excludesImg = /:not\(img\)/.test(normalized);
  return excludesAriaHidden && excludesSvg && excludesImg;
}

function selectorMatchesArm(selector: string, arm: ArmKey, shape: ArmShape): boolean {
  if (!selector.startsWith(COLLAPSED_SCOPE)) return false;
  const base = ARM_BASE[arm];
  if (!selector.includes(base)) return false;
  switch (shape) {
    case 'base':
      // Selector targets the interactive element itself, not a descendant
      // chain past it. Trim and ensure the normalized selector ends with
      // the base selector with no trailing combinator.
      return selector.replace(/\s+/g, ' ').trim().endsWith(base);
    case 'label-child': {
      // The visually-hidden rule must target non-icon children. Accepting a
      // bare `> ` combinator would let `> svg` count as label-hiding
      // coverage, masking a real regression. We require all three icon-path
      // exclusions but tolerate reordering and quote-style changes so a
      // CSS formatter rewrite doesn't break the test.
      const baseIndex = selector.indexOf(base);
      const suffix = selector.slice(baseIndex + base.length);
      return matchesLabelChildSuffix(suffix);
    }
    case 'descendant-svg-or-img':
      return selector.includes(`${base} > svg`) || selector.includes(`${base} > img`);
    case 'descendant-aria-hidden':
      return (
        selector.includes(`${base} > [aria-hidden='true']`) ||
        selector.includes(`${base} > [aria-hidden="true"]`)
      );
  }
}

function collectArms(
  rules: CssRule[],
  groupPredicate: (rule: CssRule) => boolean,
  armShape: ArmShape,
): Set<ArmKey> {
  const arms = new Set<ArmKey>();
  for (const rule of rules) {
    if (!groupPredicate(rule)) continue;
    for (const selector of rule.selectors) {
      for (const arm of ARM_KEYS) {
        if (selectorMatchesArm(selector, arm, armShape)) arms.add(arm);
      }
    }
  }
  return arms;
}

function isCollapsedScopedRule(rule: CssRule): boolean {
  return rule.selectors.some((selector) => selector.startsWith(COLLAPSED_SCOPE));
}

// Parse a declaration block into a normalized [property, value] list:
// lowercase property names, first-token-only values, no semicolons, stray
// whitespace, or `!important` modifiers. Used by the banned-declaration
// check so that variants like `DISPLAY: none`, `display:none`, or
// `display: none !important` cannot bypass the visually-hidden
// accessibility contract — `!important` strengthens the rule, not weakens
// it, so an important banned declaration is still a banned declaration.
function parseDeclarations(declarationBlock: string): Array<[string, string]> {
  return declarationBlock
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry): [string, string] => {
      const colonIndex = entry.indexOf(':');
      if (colonIndex === -1) return [entry.toLowerCase(), ''];
      const property = entry.slice(0, colonIndex).trim().toLowerCase();
      // Take only the first whitespace-separated token of the value so that
      // `!important`, multi-token shorthand values, or trailing comments
      // don't escape the banned-declaration check. The banned values
      // (`none`, `hidden`) are always single tokens, so this is sound.
      const rawValue = entry
        .slice(colonIndex + 1)
        .trim()
        .toLowerCase();
      const value = rawValue.split(/\s+/)[0] ?? '';
      return [property, value];
    });
}

describe('Sidebar collapsed CSS contract', () => {
  test('all four arms × four rule groups are present', async () => {
    const css = await Bun.file(new URL('./sidebar.css', import.meta.url)).text();
    const rules = parseCssRules(css);
    const allArms = new Set<ArmKey>(ARM_KEYS);

    const visuallyHidden = collectArms(
      rules,
      (rule) => rule.declarations.includes('clip-path: inset(50%)'),
      'label-child',
    );
    expect(visuallyHidden, 'visually-hidden block must cover all four arms').toEqual(allArms);

    // Anchor the icon-width predicate on the collapsed scope so an unrelated
    // future rule that happens to combine `font-size: 0` and
    // `justify-content: center` cannot match (producing a false failure).
    const iconWidth = collectArms(
      rules,
      (rule) =>
        isCollapsedScopedRule(rule) &&
        rule.declarations.includes('font-size: 0') &&
        rule.declarations.includes('justify-content: center'),
      'base',
    );
    expect(iconWidth, 'icon-only width block must cover all four arms').toEqual(allArms);

    const svgImg = collectArms(
      rules,
      (rule) =>
        isCollapsedScopedRule(rule) &&
        rule.declarations.includes('flex-shrink: 0') &&
        rule.selectors.some((selector) => selector.includes('> svg') || selector.includes('> img')),
      'descendant-svg-or-img',
    );
    expect(svgImg, 'svg/img pass-through must cover all four arms').toEqual(allArms);

    // Anchor the aria-hidden predicate on `flex-shrink: 0` (the same icon
    // pass-through declaration the svg/img group uses) rather than the
    // overly broad `font-size:` prefix, and scope to collapsed-state rules.
    const ariaHidden = collectArms(
      rules,
      (rule) =>
        isCollapsedScopedRule(rule) &&
        rule.declarations.includes('flex-shrink: 0') &&
        rule.selectors.some(
          (selector) =>
            selector.includes("[aria-hidden='true']") || selector.includes('[aria-hidden="true"]'),
        ),
      'descendant-aria-hidden',
    );
    expect(ariaHidden, 'aria-hidden pass-through must cover all four arms').toEqual(allArms);
  });

  test('visually-hidden rule preserves accessibility tree (required + banned declarations)', async () => {
    const css = await Bun.file(new URL('./sidebar.css', import.meta.url)).text();
    const rules = parseCssRules(css);
    const matches = rules.filter((rule) => rule.declarations.includes('clip-path: inset(50%)'));
    expect(matches.length, 'expected at least one visually-hidden rule').toBeGreaterThan(0);

    // `clip: rect(` not `clip:` — a bare `clip:` prefix would be satisfied
    // by `clip-path:` since the latter starts with the same five characters,
    // letting a missing legacy `clip` declaration slip past.
    const required = [
      'position: absolute',
      'width: 1px',
      'height: 1px',
      'overflow: hidden',
      'clip: rect(',
      'clip-path:',
    ];
    // Banned declarations are checked against the parsed property/value map
    // so that whitespace or case variants (e.g. `display:none`,
    // `DISPLAY: none`) cannot bypass the contract. Either would remove the
    // label from the accessibility tree.
    const bannedPairs: Array<[string, string]> = [
      ['display', 'none'],
      ['visibility', 'hidden'],
    ];

    for (const rule of matches) {
      for (const declaration of required) {
        expect(
          rule.declarations.includes(declaration),
          `visually-hidden rule must contain "${declaration}"`,
        ).toBe(true);
      }
      const parsed = parseDeclarations(rule.declarations);
      for (const [property, value] of bannedPairs) {
        const found = parsed.find(([key, val]) => key === property && val === value);
        expect(
          found,
          `visually-hidden rule must NOT set "${property}: ${value}" — it would remove the label from the accessibility tree`,
        ).toBeUndefined();
      }
    }
  });

  test('visually-hidden block pairs `clip` with `clip-path` for modern browsers', async () => {
    // `clip` is deprecated and unimplemented in some modern browsers;
    // `clip-path: inset(50%)` is the modern equivalent. Both must be present
    // so the visually-hidden technique works across the supported matrix.
    const css = await Bun.file(new URL('./sidebar.css', import.meta.url)).text();
    expect(css).toContain('clip: rect(0, 0, 0, 0);');
    expect(css).toContain('clip-path: inset(50%);');
  });
});

describe('Sidebar — optional navigation snippet', () => {
  test('omitting navigation renders no <nav> landmark (no empty navigation region)', () => {
    // navigation is now optional (Snippet?). Without it, the <nav> landmark must be
    // absent entirely — an empty <nav> is an a11y violation (screen readers announce
    // a navigation region with no destinations). Render with a real label and NO
    // navigation prop (every other test passes navigation; this one deliberately omits it).
    const { container } = render(Sidebar, {
      props: { label: 'Main' },
    });
    // The <aside> renders, but there is no <nav> child because navigation was omitted.
    expect(container.querySelector('aside')).not.toBeNull();
    expect(container.querySelector('nav')).toBeNull();
  });
});
