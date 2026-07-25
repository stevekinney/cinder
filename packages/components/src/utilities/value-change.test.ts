import { describe, expect, test } from 'bun:test';

import { commitValue } from './value-change.ts';

describe('commitValue', () => {
  test('commits the proposed value when no handler is provided', () => {
    let value = '';
    commitValue('next', undefined, (next) => {
      value = next;
    });

    expect(value).toBe('next');
  });

  test('commits a transformed handler return value', () => {
    let value = '';
    commitValue(
      'next',
      (next) => next.toUpperCase(),
      (next) => {
        value = next;
      },
    );

    expect(value).toBe('NEXT');
  });

  test('commits the proposed value when the handler returns void', () => {
    let value = '';
    commitValue(
      'next',
      () => {},
      (next) => {
        value = next;
      },
    );

    expect(value).toBe('next');
  });

  test('notifies after the final value is committed', () => {
    let value = '';
    const notifications: string[] = [];

    commitValue(
      'next',
      (next) => next.toUpperCase(),
      (next) => {
        value = next;
      },
      (next) => notifications.push(next),
    );

    expect(value).toBe('NEXT');
    expect(notifications).toEqual(['NEXT']);
  });

  test('commits null returned by a request handler instead of falling back to the proposed value', () => {
    let value: string | null = 'initial';

    const committed = commitValue<string | null>(
      'next',
      () => null,
      (next) => {
        value = next;
      },
    );

    expect(committed).toBeNull();
    expect(value).toBeNull();
  });
});
