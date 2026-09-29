import { describe, expect, test } from 'bun:test';

import type { WorkflowListQuery } from '../../../lib/filters.ts';
import { isBulkOperationScoped } from './bulk-filter-scope.ts';

describe('isBulkOperationScoped', () => {
  test('empty filter is unscoped', () => {
    expect(isBulkOperationScoped({})).toBe(false);
  });

  test('status alone scopes', () => {
    expect(isBulkOperationScoped({ status: 'failed' })).toBe(true);
    expect(isBulkOperationScoped({ status: ['failed', 'timed-out'] })).toBe(true);
    expect(isBulkOperationScoped({ status: [] })).toBe(false);
  });

  test('type alone scopes, blank type does not', () => {
    expect(isBulkOperationScoped({ type: 'checkout' })).toBe(true);
    expect(isBulkOperationScoped({ type: '   ' })).toBe(false);
  });

  test('tags alone scopes, empty tags array does not', () => {
    expect(isBulkOperationScoped({ tags: ['nightly'] })).toBe(true);
    expect(isBulkOperationScoped({ tags: [] })).toBe(false);
  });

  test('attributes with a real key scope, a blank-key attribute does not', () => {
    expect(isBulkOperationScoped({ attributes: [{ key: 'customerTier' }] })).toBe(true);
    expect(isBulkOperationScoped({ attributes: [{ key: '  ' }] })).toBe(false);
    expect(isBulkOperationScoped({ attributes: [] })).toBe(false);
  });

  test('idPrefix scopes only at 3+ characters', () => {
    expect(isBulkOperationScoped({ idPrefix: 'wf_' })).toBe(true);
    expect(isBulkOperationScoped({ idPrefix: 'wf' })).toBe(false);
    expect(isBulkOperationScoped({ idPrefix: '' })).toBe(false);
  });

  test('failureCategory and time ranges alone do NOT scope (mirrors the server assertion)', () => {
    const filter: WorkflowListQuery = {
      failureCategory: 'application',
      createdAt: { gte: 0 },
      updatedAt: { lte: 100 },
      executionDeadline: { gt: 0 },
    };
    expect(isBulkOperationScoped(filter)).toBe(false);
  });

  test('failureCategory paired with status scopes (status is what does the scoping)', () => {
    expect(isBulkOperationScoped({ failureCategory: 'application', status: 'failed' })).toBe(true);
  });
});
