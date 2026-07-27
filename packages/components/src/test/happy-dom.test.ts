import { expect, test } from 'bun:test';

test('keeps the installed MutationObserver replaceable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');

  expect(descriptor).toMatchObject({
    configurable: true,
    enumerable: true,
    writable: true,
  });
});
