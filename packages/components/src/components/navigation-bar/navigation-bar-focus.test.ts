/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const {
  findFirstBrandFocusTargetAfterToggle,
  findFocusTargetAfterNavigationItems,
  findFocusTargetBeforeNavigationItems,
} = await import('./navigation-bar-focus.ts');

let scratchNodes: HTMLElement[] = [];
function attachScratch(node: HTMLElement): void {
  scratchNodes.push(node);
  document.body.appendChild(node);
}

beforeEach(() => {
  scratchNodes = [];
});

afterEach(() => {
  for (const node of scratchNodes) node.remove();
  scratchNodes = [];
});

describe('findFocusTargetAfterNavigationItems', () => {
  test('finds a following sibling in the light DOM', () => {
    const wrapper = document.createElement('div');
    const navigationBar = document.createElement('nav');
    const following = document.createElement('button');
    wrapper.append(navigationBar, following);
    attachScratch(wrapper);

    expect(findFocusTargetAfterNavigationItems(navigationBar, null)).toBe(following);
  });

  test('finds a following target inside a sibling shadow host', () => {
    const wrapper = document.createElement('div');
    const navigationBar = document.createElement('nav');
    const followingHost = document.createElement('div');
    const following = document.createElement('button');
    followingHost.attachShadow({ mode: 'open' }).append(following);
    wrapper.append(navigationBar, followingHost);
    attachScratch(wrapper);

    expect(findFocusTargetAfterNavigationItems(navigationBar, null)).toBe(following);
  });

  test('finds a native summary without an explicit tabindex', () => {
    const wrapper = document.createElement('div');
    const navigationBar = document.createElement('nav');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    details.append(summary);
    wrapper.append(navigationBar, details);
    attachScratch(wrapper);

    expect(summary.hasAttribute('tabindex')).toBe(false);
    expect(findFocusTargetAfterNavigationItems(navigationBar, null)).toBe(summary);
  });

  test('skips positive tabindex actions after a normal navigation item', () => {
    const wrapper = document.createElement('div');
    const navigationBar = document.createElement('nav');
    const items = document.createElement('div');
    const navigationItem = document.createElement('button');
    navigationItem.setAttribute('data-cinder-navigation-item', '');
    items.append(navigationItem);
    const actions = document.createElement('div');
    actions.className = 'cinder-navigation-bar__actions';
    const positive = document.createElement('button');
    positive.tabIndex = 1;
    const normal = document.createElement('button');
    actions.append(positive, normal);
    navigationBar.append(items, actions);
    wrapper.append(navigationBar);
    attachScratch(wrapper);

    expect(findFocusTargetAfterNavigationItems(navigationBar, items, navigationItem)).toBe(normal);
  });

  test('continues to a positive-tabindex following control when there is no actions region', () => {
    // With no `actions` region, the fallback search anchors DOM position on
    // the `<nav>` element itself, which is not a tab stop. Tier filtering
    // must still key off the navigation item's own positive tabindex, or
    // this would incorrectly skip the page control at tabindex="3" in favor
    // of the zero-tier button that follows it.
    const wrapper = document.createElement('div');
    const navigationBar = document.createElement('nav');
    const items = document.createElement('div');
    const navigationItem = document.createElement('button');
    navigationItem.setAttribute('data-cinder-navigation-item', '');
    navigationItem.tabIndex = 2;
    items.append(navigationItem);
    navigationBar.append(items);
    const pageControl = document.createElement('button');
    pageControl.tabIndex = 3;
    const normal = document.createElement('button');
    wrapper.append(navigationBar, pageControl, normal);
    attachScratch(wrapper);

    expect(findFocusTargetAfterNavigationItems(navigationBar, items, navigationItem)).toBe(
      pageControl,
    );
  });

  test('continues through a same-value positive tabindex action in composed order', () => {
    const wrapper = document.createElement('div');
    const navigationBar = document.createElement('nav');
    const items = document.createElement('div');
    const navigationItem = document.createElement('button');
    navigationItem.setAttribute('data-cinder-navigation-item', '');
    navigationItem.tabIndex = 1;
    items.append(navigationItem);
    const actions = document.createElement('div');
    actions.className = 'cinder-navigation-bar__actions';
    const lower = document.createElement('button');
    lower.tabIndex = 1;
    const higher = document.createElement('button');
    higher.tabIndex = 2;
    const normal = document.createElement('button');
    actions.append(lower, higher, normal);
    navigationBar.append(items, actions);
    wrapper.append(navigationBar);
    attachScratch(wrapper);

    expect(findFocusTargetAfterNavigationItems(navigationBar, items, navigationItem)).toBe(lower);
  });

  test('finds a following sibling that lives inside the same shadow root', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const navigationBar = document.createElement('nav');
    const following = document.createElement('button');
    shadow.append(navigationBar, following);
    attachScratch(host);

    expect(findFocusTargetAfterNavigationItems(navigationBar, null)).toBe(following);
  });

  test('falls back to a focusable following the shadow host once the shadow root is exhausted', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const navigationBar = document.createElement('nav');
    shadow.append(navigationBar);
    const following = document.createElement('button');
    const wrapper = document.createElement('div');
    wrapper.append(host, following);
    attachScratch(wrapper);

    expect(findFocusTargetAfterNavigationItems(navigationBar, null)).toBe(following);
  });

  test('returns null when nothing follows in either the shadow root or the outer document', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const navigationBar = document.createElement('nav');
    shadow.append(navigationBar);
    attachScratch(host);

    expect(findFocusTargetAfterNavigationItems(navigationBar, null)).toBeNull();
  });

  test('excludes a following candidate whose shadow HOST (not an ancestor inside the shadow root) is display:none', () => {
    // A plain `parentElement`-only walk stops climbing at the ShadowRoot
    // (its `parentElement` is null) and never inspects the host itself, so a
    // host hidden from outside the shadow tree would otherwise still be
    // reported as rendered.
    const host = document.createElement('div');
    host.style.display = 'none';
    const shadow = host.attachShadow({ mode: 'open' });
    const navigationBar = document.createElement('nav');
    const following = document.createElement('button');
    shadow.append(navigationBar, following);
    attachScratch(host);

    expect(findFocusTargetAfterNavigationItems(navigationBar, null)).toBeNull();
  });

  test('excludes an internal shadow-root descendant that still belongs to the navigation bar', () => {
    // A plain `navigationBar.contains(candidate)` check cannot see past the
    // shadow boundary of a child custom element, so a focusable control
    // inside that child's open shadow root would otherwise read as "not
    // contained" and get selected instead of the real following control.
    const wrapper = document.createElement('div');
    const navigationBar = document.createElement('nav');
    const internalHost = document.createElement('div');
    const internalShadow = internalHost.attachShadow({ mode: 'open' });
    const internalControl = document.createElement('button');
    internalShadow.append(internalControl);
    navigationBar.append(internalHost);
    const following = document.createElement('button');
    wrapper.append(navigationBar, following);
    attachScratch(wrapper);

    expect(findFocusTargetAfterNavigationItems(navigationBar, null)).toBe(following);
  });

  test('excludes a following candidate whose shadow HOST is inert', () => {
    // Plain `closest('[inert]')` cannot see past the shadow boundary, so an
    // `inert` shadow host would otherwise not disqualify a candidate that
    // lives inside it.
    const host = document.createElement('div');
    host.setAttribute('inert', '');
    const shadow = host.attachShadow({ mode: 'open' });
    const navigationBar = document.createElement('nav');
    const following = document.createElement('button');
    shadow.append(navigationBar, following);
    attachScratch(host);

    expect(findFocusTargetAfterNavigationItems(navigationBar, null)).toBeNull();
  });
});

describe('findFirstBrandFocusTargetAfterToggle', () => {
  function buildBeforeBrandBar(brandInnerHtml: string): {
    navigationBar: HTMLElement;
    toggle: HTMLButtonElement;
  } {
    const navigationBar = document.createElement('nav');
    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'cinder-navigation-bar__menu-toggle';
    const toggle = document.createElement('button');
    toggleWrapper.append(toggle);
    const brand = document.createElement('div');
    brand.className = 'cinder-navigation-bar__brand';
    brand.innerHTML = brandInnerHtml;
    navigationBar.append(toggleWrapper, brand);
    attachScratch(navigationBar);
    return { navigationBar, toggle };
  }

  test('skips a positive-tabindex brand control that native order already visited', () => {
    // The toggle is a default (zero-tier) control, so native forward Tab
    // order already visited any positive-tabindex brand target before it
    // ever reached the toggle. Tab from the toggle must continue to the
    // first zero/default brand target, not jump back to the positive one.
    const { navigationBar, toggle } = buildBeforeBrandBar(
      '<button type="button" id="brand-positive" tabindex="1">Positive</button>' +
        '<a href="/home" id="brand-normal">Acme</a>',
    );
    const normal = navigationBar.querySelector<HTMLAnchorElement>('#brand-normal');

    expect(findFirstBrandFocusTargetAfterToggle(navigationBar, toggle)).toBe(normal);
  });

  test('returns the only brand target when it is not positive', () => {
    const { navigationBar, toggle } = buildBeforeBrandBar(
      '<a href="/home" id="brand-link">Acme</a>',
    );
    const link = navigationBar.querySelector<HTMLAnchorElement>('#brand-link');

    expect(findFirstBrandFocusTargetAfterToggle(navigationBar, toggle)).toBe(link);
  });

  test('returns null when the brand has no target native order has not already visited', () => {
    // A brand containing only an already-visited positive-tabindex control
    // has nothing left to bridge into; the caller falls through to the
    // portaled items panel instead.
    const { navigationBar, toggle } = buildBeforeBrandBar(
      '<button type="button" tabindex="1">Positive</button>',
    );

    expect(findFirstBrandFocusTargetAfterToggle(navigationBar, toggle)).toBeNull();
  });

  test('returns null without a navigation bar', () => {
    const toggle = document.createElement('button');
    attachScratch(toggle);
    expect(findFirstBrandFocusTargetAfterToggle(null, toggle)).toBeNull();
  });

  test('returns null without a toggle', () => {
    const { navigationBar } = buildBeforeBrandBar('<a href="/home">Acme</a>');
    expect(findFirstBrandFocusTargetAfterToggle(navigationBar, null)).toBeNull();
  });

  test('returns null when the navigation bar has no brand', () => {
    const navigationBar = document.createElement('nav');
    const toggle = document.createElement('button');
    navigationBar.append(toggle);
    attachScratch(navigationBar);

    expect(findFirstBrandFocusTargetAfterToggle(navigationBar, toggle)).toBeNull();
  });
});

describe('findFocusTargetBeforeNavigationItems', () => {
  function buildBeforeBrandBar(brandInnerHtml: string): {
    navigationBar: HTMLElement;
    toggle: HTMLButtonElement;
  } {
    const navigationBar = document.createElement('nav');
    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'cinder-navigation-bar__menu-toggle';
    const toggle = document.createElement('button');
    toggleWrapper.append(toggle);
    const brand = document.createElement('div');
    brand.className = 'cinder-navigation-bar__brand';
    brand.innerHTML = brandInnerHtml;
    navigationBar.append(toggleWrapper, brand);
    attachScratch(navigationBar);
    return { navigationBar, toggle };
  }

  test('threads the focused item tab tier into the brand lookup', () => {
    // Brand focus targets are sorted globally (positive tabindex first), so
    // `.at(-1)` alone picks the last zero/default-tier target regardless of
    // the focused item's own tier. A positive-tabindex first item has
    // already passed any lower-or-equal positive brand control in native
    // order, so reverse Tab from it must land on that control instead of
    // skipping straight to the zero/default-tier one.
    const { navigationBar, toggle } = buildBeforeBrandBar(
      '<button type="button" id="brand-positive" tabindex="1">Positive</button>' +
        '<a href="/home" id="brand-normal">Acme</a>',
    );
    const positive = navigationBar.querySelector<HTMLButtonElement>('#brand-positive');
    const navigationItem = document.createElement('button');
    navigationItem.tabIndex = 2;

    expect(findFocusTargetBeforeNavigationItems(navigationBar, toggle, true, navigationItem)).toBe(
      positive,
    );
  });

  test('falls back to the last brand target when the focused item is not positive', () => {
    const { navigationBar, toggle } = buildBeforeBrandBar(
      '<button type="button" id="brand-positive" tabindex="1">Positive</button>' +
        '<a href="/home" id="brand-normal">Acme</a>',
    );
    const normal = navigationBar.querySelector<HTMLAnchorElement>('#brand-normal');
    const navigationItem = document.createElement('button');

    expect(findFocusTargetBeforeNavigationItems(navigationBar, toggle, true, navigationItem)).toBe(
      normal,
    );
  });

  test('falls back to the last brand target when no focused item is provided', () => {
    const { navigationBar, toggle } = buildBeforeBrandBar(
      '<a href="/home" id="brand-home">Home</a><a href="/products" id="brand-products">Products</a>',
    );
    const products = navigationBar.querySelector<HTMLAnchorElement>('#brand-products');

    expect(findFocusTargetBeforeNavigationItems(navigationBar, toggle, true)).toBe(products);
  });
});
