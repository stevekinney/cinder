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
});
