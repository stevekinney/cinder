/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
