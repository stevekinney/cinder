import { describe, expect, test } from 'bun:test';

import { inputInterfaceName, previewInterface } from './codegen-preview.ts';

describe('inputInterfaceName', () => {
  test('PascalCases a kebab-case workflow type and appends Input', () => {
    expect(inputInterfaceName('order-processing')).toBe('OrderProcessingInput');
  });

  test('handles a single-word type', () => {
    expect(inputInterfaceName('welcome')).toBe('WelcomeInput');
  });
});

describe('previewInterface', () => {
  test('undefined for a missing schema', () => {
    expect(previewInterface('OrderInput', undefined)).toBeUndefined();
  });

  test('undefined for a schema with no properties (e.g. a bare-type schema)', () => {
    expect(previewInterface('OrderInput', { type: 'string' })).toBeUndefined();
  });

  test('renders required/optional fields, an enum union, and an array type', () => {
    const output = previewInterface('OrderInput', {
      type: 'object',
      required: ['orderId', 'items'],
      properties: {
        orderId: { type: 'string' },
        customerTier: { enum: ['bronze', 'silver', 'gold'] },
        items: { type: 'array', items: { type: 'string' } },
        note: { type: 'string' },
      },
    });

    expect(output).toBe(
      [
        'export interface OrderInput {',
        '  customerTier?: "bronze" | "silver" | "gold";',
        '  items: string[];',
        '  note?: string;',
        '  orderId: string;',
        '}',
      ].join('\n'),
    );
  });

  test('renders a nullable field with the | null suffix', () => {
    const output = previewInterface('X', {
      type: 'object',
      properties: { note: { type: ['string', 'null'] } },
    });
    expect(output).toBe(['export interface X {', '  note?: unknown | null;', '}'].join('\n'));
  });

  test('renders number and integer fields as the TypeScript number type', () => {
    const output = previewInterface('OrderInput', {
      type: 'object',
      required: ['amount', 'quantity'],
      properties: {
        amount: { type: 'number' },
        quantity: { type: 'integer' },
      },
    });

    expect(output).toBe(
      ['export interface OrderInput {', '  amount: number;', '  quantity: number;', '}'].join('\n'),
    );
  });

  test('falls back to unknown for an unrecognized fragment type', () => {
    const output = previewInterface('X', {
      type: 'object',
      required: ['payload'],
      properties: { payload: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
    });
    expect(output).toBe(['export interface X {', '  payload: unknown;', '}'].join('\n'));
  });
});
