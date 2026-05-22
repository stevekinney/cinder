/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Sidebar } = await import('./sidebar.svelte');

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

  test('aside uses the supplied ariaLabel', () => {
    const { container } = render(Sidebar, {
      props: { ariaLabel: 'Workspace', navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')?.getAttribute('aria-label')).toBe('Workspace');
  });

  test('empty ariaLabel throws on initial render', () => {
    expect(() => {
      render(Sidebar, {
        props: { ariaLabel: '', navigation: listSnippet('items') },
      });
    }).toThrow();
  });

  test('whitespace-only ariaLabel throws on initial render', () => {
    expect(() => {
      render(Sidebar, {
        props: { ariaLabel: '   ', navigation: listSnippet('items') },
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
      props: { ariaLabel: 'Workspace', navigation: listSnippet('items') },
    });
    const nav = container.querySelector('aside nav.cinder-sidebar__nav');
    expect(nav).not.toBeNull();
    // The inner <nav> landmark gets a distinct accessible name so it is not
    // announced identically to the outer <aside> complementary landmark.
    expect(nav?.getAttribute('aria-label')).toBe('Workspace navigation');
  });

  test('outer aside aria-label is distinct from inner nav aria-label', () => {
    const { container } = render(Sidebar, {
      props: { ariaLabel: 'Workspace', navigation: listSnippet('items') },
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

  test('aria-label in rest spread cannot override the component-owned ariaLabel', () => {
    const { container } = render(Sidebar, {
      props: {
        ariaLabel: 'Sections',
        'aria-label': 'Overridden',
        navigation: listSnippet('items'),
      } as unknown as Parameters<typeof render>[1]['props'],
    });
    expect(container.querySelector('aside')?.getAttribute('aria-label')).toBe('Sections');
  });

  test('aria-labelledby in rest spread is not forwarded', () => {
    const { container } = render(Sidebar, {
      props: {
        ariaLabel: 'Sections',
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
  const list = {
    matches: initialMatches,
    media: '',
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
    list.media = query;
    return list as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return {
    list,
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
  expect(mock.list.media).toBe('(max-width: 47.99rem)');
}

// happy-dom doesn't implement HTMLDialogElement.showModal / close — stub them
// the same way drawer.test.ts does so the mobile <Drawer> can render.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function () {
        this.setAttribute('open', '');
      },
      configurable: true,
      writable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function () {
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
      props: { ariaLabel: 'Workspace', navigation: listSnippet('items') },
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

function selectorMatchesArm(
  selector: string,
  arm: ArmKey,
  shape: 'base' | 'child-of' | 'descendant-svg-or-img' | 'descendant-aria-hidden',
): boolean {
  if (!selector.startsWith(COLLAPSED_SCOPE)) return false;
  const base = ARM_BASE[arm];
  if (!selector.includes(base)) return false;
  switch (shape) {
    case 'base':
      // Selector targets the interactive element itself, not a descendant
      // chain past it. Trim the collapsed scope, ensure the remainder ends
      // at the base selector with no trailing combinator.
      return selector.replace(/\s+/g, ' ').trim().endsWith(base);
    case 'child-of':
      return selector.includes(`${base} >`);
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
  armShape: Parameters<typeof selectorMatchesArm>[2],
): { arms: Set<ArmKey>; matchingRules: CssRule[] } {
  const arms = new Set<ArmKey>();
  const matchingRules: CssRule[] = [];
  for (const rule of rules) {
    if (!groupPredicate(rule)) continue;
    matchingRules.push(rule);
    for (const selector of rule.selectors) {
      for (const arm of ARM_KEYS) {
        if (selectorMatchesArm(selector, arm, armShape)) arms.add(arm);
      }
    }
  }
  return { arms, matchingRules };
}

describe('Sidebar collapsed CSS contract', () => {
  test('all four arms × four rule groups are present', async () => {
    const css = await Bun.file(new URL('./sidebar.css', import.meta.url)).text();
    const rules = parseCssRules(css);
    const allArms = new Set<ArmKey>(ARM_KEYS);

    const visuallyHidden = collectArms(
      rules,
      (rule) => rule.declarations.includes('clip-path: inset(50%)'),
      'child-of',
    );
    expect(visuallyHidden.arms, 'visually-hidden block must cover all four arms').toEqual(allArms);

    const iconWidth = collectArms(
      rules,
      (rule) =>
        rule.declarations.includes('font-size: 0') &&
        rule.declarations.includes('justify-content: center'),
      'base',
    );
    expect(iconWidth.arms, 'icon-only width block must cover all four arms').toEqual(allArms);

    const svgImg = collectArms(
      rules,
      (rule) =>
        rule.declarations.includes('flex-shrink: 0') &&
        rule.selectors.some((selector) => selector.includes('> svg') || selector.includes('> img')),
      'descendant-svg-or-img',
    );
    expect(svgImg.arms, 'svg/img pass-through must cover all four arms').toEqual(allArms);

    const ariaHidden = collectArms(
      rules,
      (rule) =>
        rule.declarations.includes('font-size:') &&
        rule.selectors.some(
          (selector) =>
            selector.includes("[aria-hidden='true']") || selector.includes('[aria-hidden="true"]'),
        ),
      'descendant-aria-hidden',
    );
    expect(ariaHidden.arms, 'aria-hidden pass-through must cover all four arms').toEqual(allArms);
  });

  test('visually-hidden rule preserves accessibility tree (required + banned declarations)', async () => {
    const css = await Bun.file(new URL('./sidebar.css', import.meta.url)).text();
    const rules = parseCssRules(css);
    const matches = rules.filter((rule) => rule.declarations.includes('clip-path: inset(50%)'));
    expect(matches.length, 'expected at least one visually-hidden rule').toBeGreaterThan(0);

    const required = [
      'position: absolute',
      'width: 1px',
      'height: 1px',
      'overflow: hidden',
      'clip:',
      'clip-path:',
    ];
    const banned = ['display: none', 'visibility: hidden'];

    for (const rule of matches) {
      for (const declaration of required) {
        expect(
          rule.declarations.includes(declaration),
          `visually-hidden rule must contain "${declaration}"`,
        ).toBe(true);
      }
      for (const declaration of banned) {
        expect(
          rule.declarations.includes(declaration),
          `visually-hidden rule must NOT contain "${declaration}" — it would remove the label from the accessibility tree`,
        ).toBe(false);
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
