/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { findFirstBrandFocusTargetAfterToggle } = await import('./navigation-bar-focus.ts');

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
