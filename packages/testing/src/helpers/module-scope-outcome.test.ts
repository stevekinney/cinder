import { describe, expect, it } from 'bun:test';

import { outcomeOf, rethrow, ScenarioHangError } from './module-scope-outcome.ts';

describe('outcomeOf', () => {
  it('records nothing when the scenario finishes', async () => {
    expect(await outcomeOf(() => undefined)).toBeUndefined();
    expect(await outcomeOf(async () => undefined)).toBeUndefined();
  });

  it('records a failed assertion so rethrow reports it with its original message', async () => {
    const outcome = await outcomeOf(async () => {
      expect(2).toBe(3);
    });
    expect(() => rethrow(outcome)).toThrow('Expected: 3');
  });

  it('records a synchronous throw', async () => {
    const outcome = await outcomeOf(() => {
      throw new Error('synchronous failure');
    });
    expect(() => rethrow(outcome)).toThrow('synchronous failure');
  });

  it('substitutes an error when the scenario rejects with a nullish value', async () => {
    const outcome = await outcomeOf(() => Promise.reject(undefined));
    expect(() => rethrow(outcome)).toThrow('scenario failed');
  });

  it('reports a scenario that never settles as hung once its guard elapses', async () => {
    const outcome = await outcomeOf(() => new Promise<void>(() => {}), 5);
    expect(outcome).toBeInstanceOf(ScenarioHangError);
    expect(() => rethrow(outcome)).toThrow('scenario did not settle within 5 ms; it is hung');
  });
});

describe('rethrow', () => {
  it('returns normally for a scenario that passed', () => {
    expect(() => rethrow(undefined)).not.toThrow();
  });
});
