import { beforeEach, describe, expect, test } from 'bun:test';

import { createIdFactory, defaultIdFactory, useStableId } from './id-factory.ts';

describe('createIdFactory', () => {
  test('increments deterministically starting from 1', () => {
    const factory = createIdFactory('test');
    expect(factory.next()).toBe('test-1');
    expect(factory.next()).toBe('test-2');
    expect(factory.next()).toBe('test-3');
  });

  test('uses empty string prefix when none supplied', () => {
    const factory = createIdFactory();
    expect(factory.next()).toBe('-1');
    expect(factory.next()).toBe('-2');
  });

  test('reset sets counter back to 0 so next call returns prefix-1', () => {
    const factory = createIdFactory('reset-test');
    factory.next();
    factory.next();
    factory.reset();
    expect(factory.next()).toBe('reset-test-1');
  });

  test('two factories with the same prefix produce independent sequences', () => {
    const factoryA = createIdFactory('shared');
    const factoryB = createIdFactory('shared');

    const a1 = factoryA.next();
    const a2 = factoryA.next();
    const b1 = factoryB.next();

    expect(a1).toBe('shared-1');
    expect(a2).toBe('shared-2');
    // factoryB is independent — its first call is still 1
    expect(b1).toBe('shared-1');
  });

  test('resetting one factory does not affect the other', () => {
    const factoryA = createIdFactory('independent');
    const factoryB = createIdFactory('independent');

    factoryA.next();
    factoryA.next();
    factoryA.reset();

    // factoryB is unaffected
    expect(factoryB.next()).toBe('independent-1');
    // factoryA restarts from 1
    expect(factoryA.next()).toBe('independent-1');
  });
});

describe('defaultIdFactory', () => {
  beforeEach(() => {
    defaultIdFactory.reset();
  });

  test('is a reusable singleton with a stable prefix', () => {
    const first = defaultIdFactory.next();
    const second = defaultIdFactory.next();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^cinder-\d+$/);
    expect(second).toMatch(/^cinder-\d+$/);
  });

  test('reset restores the counter', () => {
    defaultIdFactory.next();
    defaultIdFactory.next();
    defaultIdFactory.reset();
    expect(defaultIdFactory.next()).toBe('cinder-1');
  });
});

describe('useStableId', () => {
  beforeEach(() => {
    defaultIdFactory.reset();
  });

  test('same seed always produces the same ID', () => {
    const idA = useStableId('hello-world');
    const idB = useStableId('hello-world');
    expect(idA).toBe(idB);
  });

  test('different seeds produce different IDs', () => {
    const idA = useStableId('seed-one');
    const idB = useStableId('seed-two');
    expect(idA).not.toBe(idB);
  });

  test('seeded ID has the expected format (id-<8 hex chars>)', () => {
    const result = useStableId('stable-seed');
    expect(result).toMatch(/^id-[0-9a-f]{8}$/);
  });

  test('falls back to defaultIdFactory when no seed is given', () => {
    const first = useStableId();
    const second = useStableId();
    expect(first).toBe('cinder-1');
    expect(second).toBe('cinder-2');
  });
});
