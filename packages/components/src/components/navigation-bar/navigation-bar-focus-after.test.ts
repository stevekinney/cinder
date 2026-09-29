/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { findFocusTargetAfterNavigationItems } = await import('./navigation-bar-focus.ts');

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

  test('reaches a higher positive-tabindex page control positioned earlier in the page', () => {
    // The composed-position boundary used to scope the outward search must
    // never gate a strictly-higher tier: native Tab order sorts positive
    // tabindex values ascending regardless of DOM position, so a
    // tabindex="3" control structurally BEFORE the nav bar is still the
    // correct next stop from a tabindex="2" item, not the zero-tier button
    // that happens to sit after the bar.
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
    wrapper.append(pageControl, navigationBar, normal);
    attachScratch(wrapper);

    expect(findFocusTargetAfterNavigationItems(navigationBar, items, navigationItem)).toBe(
      pageControl,
    );
  });

  test('does not settle for a zero-tier action when a higher positive-tabindex page control still lies ahead', () => {
    // A positive-tabindex item that finds no same/higher-tier action inside
    // `actions` must not fall back to `actions`' zero-tier button here —
    // that would move focus backward, since zero tier is entirely visited
    // after every positive tier. The composed-scope search must still get a
    // chance to find the tabindex="3" page control outside the bar.
    const wrapper = document.createElement('div');
    const navigationBar = document.createElement('nav');
    const items = document.createElement('div');
    const navigationItem = document.createElement('button');
    navigationItem.setAttribute('data-cinder-navigation-item', '');
    navigationItem.tabIndex = 2;
    items.append(navigationItem);
    const actions = document.createElement('div');
    actions.className = 'cinder-navigation-bar__actions';
    const normalAction = document.createElement('button');
    actions.append(normalAction);
    navigationBar.append(items, actions);
    const pageControl = document.createElement('button');
    pageControl.tabIndex = 3;
    wrapper.append(navigationBar, pageControl);
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
