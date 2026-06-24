import { describe, expect, mock, test } from 'bun:test';

import { devWarn } from './dev-warn.ts';

describe('devWarn', () => {
  test('forwards the message and extra args to console.warn in DEV', () => {
    // The test runner builds with DEV truthy (esm-env resolves DEV from the
    // bundle condition; under bun:test it is dev), so the call goes through.
    const warn = mock(() => {});
    const original = console.warn;
    console.warn = warn;
    try {
      devWarn('[cinder/Thing] bad', { id: 'x' }, 42);
    } finally {
      console.warn = original;
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[cinder/Thing] bad', { id: 'x' }, 42);
  });

  test('works with just a message', () => {
    const warn = mock(() => {});
    const original = console.warn;
    console.warn = warn;
    try {
      devWarn('[cinder/Thing] solo');
    } finally {
      console.warn = original;
    }
    expect(warn).toHaveBeenCalledWith('[cinder/Thing] solo');
  });
});
