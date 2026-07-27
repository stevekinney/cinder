import { expect, test } from 'bun:test';

import { setupHappyDom } from './happy-dom';

test('keeps the installed MutationObserver replaceable', () => {
  setupHappyDom();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');

  expect(descriptor).toMatchObject({
    configurable: true,
    enumerable: true,
    writable: true,
  });
});
