import { describe, expect, test } from 'bun:test';

import type { WorkflowListQuery } from '../../../lib/filters.ts';
import { toBulkListFilterInput } from './bulk-list-filter.ts';

describe('toBulkListFilterInput', () => {
  test('empty filter converts to an empty object', () => {
    expect(toBulkListFilterInput({})).toEqual({});
  });

  test('drops limit/offset — a bulk action targets the full filtered set, not a page', () => {
    const filter: WorkflowListQuery = { status: 'failed', limit: 50, offset: 100 };
    const result = toBulkListFilterInput(filter);
    expect(result).not.toHaveProperty('limit');
    expect(result).not.toHaveProperty('offset');
    expect(result.status).toBe('failed');
  });

  test('drops includeFailureCategory — a REST projection flag with no bulk equivalent', () => {
    const filter: WorkflowListQuery = { status: 'failed', includeFailureCategory: true };
    expect(toBulkListFilterInput(filter)).not.toHaveProperty('includeFailureCategory');
  });

  test('carries through every scoping dimension', () => {
    const filter: WorkflowListQuery = {
      status: ['failed', 'timed-out'],
      type: 'checkout',
      tags: ['nightly'],
      idPrefix: 'wf_',
      failureCategory: 'application',
      createdAt: { gte: 1000 },
      updatedAt: { lte: 2000 },
      executionDeadline: { gt: 500 },
    };
    expect(toBulkListFilterInput(filter)).toEqual({
      status: ['failed', 'timed-out'],
      type: 'checkout',
      tags: ['nightly'],
      idPrefix: 'wf_',
      failureCategory: 'application',
      createdAt: { gte: 1000 },
      updatedAt: { lte: 2000 },
      executionDeadline: { gt: 500 },
    });
  });

  test('omits undefined time-range bounds while retaining zero', () => {
    const result = toBulkListFilterInput({
      createdAt: { gte: undefined, gt: 0 },
      updatedAt: { lte: undefined, lt: 0 },
      executionDeadline: { gt: undefined, gte: 0 },
    });

    expect(result.createdAt).toEqual({ gt: 0 });
    expect(result.updatedAt).toEqual({ lt: 0 });
    expect(result.executionDeadline).toEqual({ gte: 0 });
    expect(Object.hasOwn(result.createdAt ?? {}, 'gte')).toBe(false);
    expect(Object.hasOwn(result.updatedAt ?? {}, 'lte')).toBe(false);
    expect(Object.hasOwn(result.executionDeadline ?? {}, 'gt')).toBe(false);
  });

  test('converts attribute filters, including scalar arrays', () => {
    const filter: WorkflowListQuery = {
      attributes: [
        { key: 'customerTier', value: 'gold' },
        { key: 'region', value: ['us', 'eu'] },
        { key: 'score', gt: 10, lte: 100 },
      ],
    };
    expect(toBulkListFilterInput(filter).attributes).toEqual([
      { key: 'customerTier', value: 'gold' },
      { key: 'region', value: ['us', 'eu'] },
      { key: 'score', gt: 10, lte: 100 },
    ]);
  });

  test('normalizes a Date attribute scalar to epoch milliseconds (defensive — see module doc)', () => {
    const when = new Date('2026-01-01T00:00:00.000Z');
    const filter: WorkflowListQuery = { attributes: [{ key: 'placedAt', gte: when }] };
    expect(toBulkListFilterInput(filter).attributes).toEqual([
      { key: 'placedAt', gte: when.getTime() },
    ]);
  });
});
