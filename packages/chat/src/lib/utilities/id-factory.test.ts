import { beforeEach, describe, expect, test } from 'bun:test';

import { createIdFactory, defaultIdFactory, useStableId } from './id-factory.ts';

describe('ID factories', () => {
  beforeEach(() => defaultIdFactory.reset());

  test('increments and resets independent factories', () => {
    const factory = createIdFactory('chat');
    expect(factory.next()).toBe('chat-1');
    expect(factory.next()).toBe('chat-2');
    factory.reset();
    expect(factory.next()).toBe('chat-1');
    expect(createIdFactory().next()).toBe('-1');
  });

  test('derives deterministic seeded IDs and falls back to the default factory', () => {
    expect(useStableId('attachment')).toBe(useStableId('attachment'));
    expect(useStableId('attachment')).toMatch(/^id-[0-9a-f]{8}$/);
    expect(useStableId('different')).not.toBe(useStableId('attachment'));
    expect(useStableId()).toBe('cinder-1');
  });
});
