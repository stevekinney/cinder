/// <reference lib="dom" />
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();
export const nativeGetComputedStyle = globalThis.getComputedStyle;
const originalGlobalDescriptors = {
  getComputedStyle: Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle'),
  matchMedia: Object.getOwnPropertyDescriptor(globalThis, 'matchMedia'),
  MutationObserver: Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver'),
};
const originalWindowDescriptors = {
  getComputedStyle: Object.getOwnPropertyDescriptor(window, 'getComputedStyle'),
  matchMedia: Object.getOwnPropertyDescriptor(window, 'matchMedia'),
  MutationObserver: Object.getOwnPropertyDescriptor(window, 'MutationObserver'),
};

export function withComputedDirection(
  style: CSSStyleDeclaration,
  direction: string,
): CSSStyleDeclaration {
  return new Proxy(style, {
    get(target, property, receiver) {
      return property === 'direction' ? direction : Reflect.get(target, property, receiver);
    },
  });
}

export const { render, cleanup, waitFor } = await import('@testing-library/svelte');
export const { default: Portal } = await import('./portal.svelte');
export const { default: PortalAttachmentTest } =
  await import('./_portal-attachment-test-harness.svelte');
export const {
  copyInheritedPortalAttributes,
  findNearestOpenTopLayer,
  getInheritedPortalStyle,
  invalidatePortalDirection,
  observePortalSourceAvailability,
  redispatchPortaledEvent,
} = await import('./portal.utilities.svelte.ts');

export const childSnippet = createRawSnippet(() => ({
  render: () => '<button data-testid="portal-child">Portaled child</button>',
}));

function restoreProperty(
  target: object,
  property: string,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(target, property, descriptor);
  else Reflect.deleteProperty(target, property);
}

export function restorePortalGlobalState(): void {
  // Unmount rendered components (runs Svelte teardown) before clearing the DOM —
  // replaceChildren() alone removes nodes but leaks component effects/subscriptions.
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-cinder-theme');
  document.documentElement.removeAttribute('dir');
  restoreProperty(globalThis, 'getComputedStyle', originalGlobalDescriptors.getComputedStyle);
  restoreProperty(globalThis, 'matchMedia', originalGlobalDescriptors.matchMedia);
  restoreProperty(globalThis, 'MutationObserver', originalGlobalDescriptors.MutationObserver);
  restoreProperty(window, 'getComputedStyle', originalWindowDescriptors.getComputedStyle);
  restoreProperty(window, 'matchMedia', originalWindowDescriptors.matchMedia);
  restoreProperty(window, 'MutationObserver', originalWindowDescriptors.MutationObserver);
  document.head.replaceChildren();
  document.body.replaceChildren();
}
