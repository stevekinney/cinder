import { describe, expect, it } from 'bun:test';

import { rejectionOf, throwingRejectionOf } from './promise-outcome.ts';

class CustomError extends Error {}

describe('rejectionOf', () => {
  it('returns the rejection reason', async () => {
    const reason = new CustomError('boom');
    expect(await rejectionOf(Promise.reject(reason))).toBe(reason);
  });

  it('returns a non-Error rejection reason unchanged', async () => {
    expect(await rejectionOf(Promise.reject('plain'))).toBe('plain');
  });

  it('treats a value that is not a promise as resolved', async () => {
    let failure: unknown;
    try {
      await rejectionOf(undefined);
    } catch (error) {
      failure = error;
    }
    expect((failure as Error).message).toBe(
      'Expected the promise to reject, but it resolved with undefined',
    );
  });

  it('throws, naming the value, when the promise resolves', async () => {
    let failure: unknown;
    try {
      await rejectionOf(Promise.resolve({ ok: true }));
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(
      'Expected the promise to reject, but it resolved with {\n  ok: true,\n}',
    );
  });
});

describe('throwingRejectionOf', () => {
  it('returns a function that rethrows the rejection reason', async () => {
    const reason = new CustomError('boom');
    const rethrow = await throwingRejectionOf(Promise.reject(reason));
    expect(rethrow).toThrow(reason);
    expect(rethrow).toThrow(CustomError);
    expect(rethrow).toThrow('boom');
    expect(rethrow).toThrow(/bo+m/);
    expect(rethrow).not.toThrow(TypeError);
  });

  it('throws when the promise resolves', async () => {
    let failure: unknown;
    try {
      await throwingRejectionOf(Promise.resolve(1));
    } catch (error) {
      failure = error;
    }
    expect((failure as Error).message).toBe(
      'Expected the promise to reject, but it resolved with 1',
    );
  });
});
