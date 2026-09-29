/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

import { resolveTargetElement } from './table-of-contents-heading-derivation.ts';

setupHappyDom();

// The rest of this module (slugifyHeading, deriveItemsFromHeadings, id
// conflict resolution, …) is already exercised end-to-end through
// TableOfContentsHeadingRegistry's own tests (see
// table-of-contents-heading-registry.test.ts), which construct
// `resolveTargetElement`'s "string selector resolves to a live element" and
// "HTMLElement target" success paths as a side effect of normal use. This
// file targets `resolveTargetElement`'s remaining branches specifically,
// none of which any existing test reaches.
describe('resolveTargetElement', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test('returns null when document is unavailable (SSR)', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'document');
    try {
      expect(resolveTargetElement('#main')).toBeNull();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    }
  });

  test('returns null for a blank (whitespace-only) selector string', () => {
    expect(resolveTargetElement('   ')).toBeNull();
  });

  test('returns null for an HTMLElement target that has been removed from the document', () => {
    const detached = document.createElement('div');
    expect(detached.isConnected).toBe(false);
    expect(resolveTargetElement(detached)).toBeNull();
  });

  test('returns null when target is neither a string nor an HTMLElement', () => {
    expect(resolveTargetElement(undefined)).toBeNull();
  });
});
