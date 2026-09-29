/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { findFocusTargetBeforeNavigationItems } = await import('./navigation-bar-focus.ts');

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

  test('falls through to the toggle when a positive-tabindex item finds no qualifying brand control among zero-tier ones', () => {
    // A positive-tabindex item's reverse Tab bridge into the brand must
    // never land on a zero-tier brand target — zero tier is entirely
    // visited after every positive tier, so a brand containing only
    // zero-tier controls has nothing valid to bridge into. The caller's
    // toggle fallback is the correct next candidate, not `.at(-1)`.
    const { navigationBar, toggle } = buildBeforeBrandBar(
      '<a href="/home" id="brand-normal">Acme</a>',
    );
    const navigationItem = document.createElement('button');
    navigationItem.tabIndex = 2;

    expect(findFocusTargetBeforeNavigationItems(navigationBar, toggle, true, navigationItem)).toBe(
      toggle,
    );
  });

  test('falls through to the toggle when a positive-tabindex item finds no qualifying brand control among higher-positive ones', () => {
    // The mirror of the zero-tier case: a brand control at tabindex="3" has
    // not been visited yet when a tabindex="2" item has focus, so it cannot
    // be "before" that item in reverse Tab order even though it is the
    // brand's only (and therefore globally last-sorted) target.
    const { navigationBar, toggle } = buildBeforeBrandBar(
      '<button type="button" id="brand-higher" tabindex="3">Higher</button>',
    );
    const navigationItem = document.createElement('button');
    navigationItem.tabIndex = 2;

    expect(findFocusTargetBeforeNavigationItems(navigationBar, toggle, true, navigationItem)).toBe(
      toggle,
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
