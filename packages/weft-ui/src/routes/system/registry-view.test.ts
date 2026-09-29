import { describe, expect, test } from 'bun:test';

import {
  buildSchemaTree,
  isRegistryEmpty,
  registryActivityRows,
  type RegistrySnapshotSource,
} from './registry-view.ts';

const SNAPSHOT: RegistrySnapshotSource = {
  registryVersion: 2,
  generatedAt: '2026-01-01T00:00:00.000Z',
  workflows: [
    {
      manifestVersion: 1,
      name: 'order-processing',
      workflowVersion: '1.0.0',
      revision: 'sha256:order-processing-revision',
      contractHash: 'sha256:order-processing-hash',
      contract: {
        name: 'order-processing',
        workflowVersion: '1.0.0',
        description: 'Processes an order end to end.',
        tags: ['commerce'],
        inputSchema: {
          type: 'object',
          required: ['orderId'],
          properties: { orderId: { type: 'string' } },
        },
        signals: {
          cancel: { inputSchema: { type: 'object', properties: { reason: {} } } },
        },
        updates: {
          expedite: {
            inputSchema: { type: 'object', properties: { rush: { type: 'boolean' } } },
            outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
          },
        },
        queries: {
          status: { outputSchema: { type: 'object', properties: { state: { type: 'string' } } } },
        },
        activities: {
          chargeCard: {
            inputSchema: { type: 'object', properties: { amountCents: { type: 'number' } } },
          },
        },
        finalizer: { inputSchema: { type: 'object', properties: { orderId: { type: 'string' } } } },
      },
    },
    {
      manifestVersion: 1,
      name: 'audit-sweep',
      workflowVersion: '1.0.0',
      revision: 'sha256:audit-sweep-revision',
      contractHash: 'sha256:audit-sweep-hash',
      contract: { name: 'audit-sweep', workflowVersion: '1.0.0' },
    },
  ],
  activeRevisions: {
    'order-processing': 'sha256:order-processing-revision',
    'audit-sweep': 'sha256:audit-sweep-revision',
  },
  activities: {
    chargeCard: { queue: 'default', description: 'Charges a card.' },
    reserveInventory: {
      queue: 'inventory',
      inputSchema: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
      },
      retry: { maxAttempts: 3, initialBackoff: '200ms', backoffMultiplier: 2, maxBackoff: '2s' },
      timeout: '30s',
    },
  },
};

describe('registryActivityRows', () => {
  test('sorts by name', () => {
    const rows = registryActivityRows(SNAPSHOT);
    expect(rows.map((row) => row.name)).toEqual(['chargeCard', 'reserveInventory']);
    expect(rows[1]?.hasInputSchema).toBe(true);
  });

  test('surfaces retry/timeout when the wire snapshot supplies them', () => {
    const rows = registryActivityRows(SNAPSHOT);
    const reserveInventory = rows.find((row) => row.name === 'reserveInventory');
    expect(reserveInventory?.retry).toEqual({
      maxAttempts: 3,
      initialBackoff: '200ms',
      backoffMultiplier: 2,
      maxBackoff: '2s',
    });
    expect(reserveInventory?.timeout).toBe('30s');
  });

  test('omits retry/timeout — never fabricated — when the wire snapshot has none', () => {
    const rows = registryActivityRows(SNAPSHOT);
    const chargeCard = rows.find((row) => row.name === 'chargeCard');
    expect(chargeCard?.retry).toBeUndefined();
    expect(chargeCard?.timeout).toBeUndefined();
  });
});

describe('buildSchemaTree', () => {
  test('returns [] for an undefined schema', () => {
    expect(buildSchemaTree(undefined)).toEqual([]);
  });

  test('leaf properties have no children', () => {
    const tree = buildSchemaTree({
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string' } },
    });
    expect(tree).toEqual([
      {
        id: 'field.orderId',
        name: 'orderId',
        type: 'string',
        required: true,
        description: undefined,
        children: [],
      },
    ]);
  });

  test('nested object properties expand into children with prefixed, stable ids', () => {
    const tree = buildSchemaTree({
      type: 'object',
      properties: {
        customer: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            id: { type: 'string' },
          },
        },
      },
    });

    expect(tree).toEqual([
      {
        id: 'field.customer',
        name: 'customer',
        type: 'object',
        required: false,
        description: undefined,
        children: [
          {
            id: 'field.customer.email',
            name: 'email',
            type: 'string',
            required: false,
            description: undefined,
            children: [],
          },
          {
            id: 'field.customer.id',
            name: 'id',
            type: 'string',
            required: false,
            description: undefined,
            children: [],
          },
        ],
      },
    ]);
  });

  test('an array-of-strings property is a leaf, not expanded', () => {
    const tree = buildSchemaTree({
      type: 'object',
      properties: { tags: { type: 'array', items: { type: 'string' } } },
    });
    expect(tree[0]?.children).toEqual([]);
  });
});

describe('isRegistryEmpty', () => {
  test('true when both the workflow array and activities map are empty', () => {
    expect(
      isRegistryEmpty({ registryVersion: 2, workflows: [], activeRevisions: {}, activities: {} }),
    ).toBe(true);
  });

  test('false when at least one workflow or activity exists', () => {
    expect(isRegistryEmpty(SNAPSHOT)).toBe(false);
    expect(
      isRegistryEmpty({
        registryVersion: 2,
        workflows: [],
        activeRevisions: {},
        activities: SNAPSHOT.activities,
      }),
    ).toBe(false);
  });
});
