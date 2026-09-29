import { describe, expect, test } from 'bun:test';

import { appendAttributeFilter, parseAttributeFilters } from '../../../lib/attribute-filters.ts';
import {
  attributeFiltersToQueryConditionRows,
  createEmptyQueryConditionRow,
  queryConditionRowsToAttributeFilters,
  queryConditionRowsToRawPreview,
  type QueryConditionRow,
} from './query-builder.ts';

function row(
  key: string,
  operator: QueryConditionRow['operator'],
  value: string,
): QueryConditionRow {
  return { id: createEmptyQueryConditionRow().id, key, operator, value };
}

describe('queryConditionRowsToAttributeFilters', () => {
  test('drops blank rows (no key or no value yet)', () => {
    const rows = [row('', 'eq', ''), row('customerTier', 'eq', '')];
    expect(queryConditionRowsToAttributeFilters(rows)).toEqual([]);
  });

  test('one row per distinct key/operator', () => {
    const rows = [row('customerTier', 'eq', 'gold'), row('amount', 'gte', '500')];
    expect(queryConditionRowsToAttributeFilters(rows)).toEqual([
      { key: 'customerTier', value: 'gold' },
      { key: 'amount', gte: 500 },
    ]);
  });

  test('infers booleans and numbers, keeps everything else as a string', () => {
    const rows = [
      row('isFlaky', 'eq', 'true'),
      row('retryCount', 'eq', '3'),
      row('region', 'eq', 'us-east'),
    ];
    expect(queryConditionRowsToAttributeFilters(rows)).toEqual([
      { key: 'isFlaky', value: true },
      { key: 'retryCount', value: 3 },
      { key: 'region', value: 'us-east' },
    ]);
  });

  test('merges same-key eq rows into one filter with an array value', () => {
    const rows = [row('region', 'eq', 'us-east'), row('region', 'eq', 'us-west')];
    expect(queryConditionRowsToAttributeFilters(rows)).toEqual([
      { key: 'region', value: ['us-east', 'us-west'] },
    ]);
  });

  test('does not merge a range operator across rows with a different operator on the same key', () => {
    const rows = [row('amount', 'gte', '100'), row('amount', 'lte', '900')];
    expect(queryConditionRowsToAttributeFilters(rows)).toEqual([
      { key: 'amount', gte: 100, lte: 900 },
    ]);
  });
});

describe('attributeFiltersToQueryConditionRows', () => {
  test('expands an array-valued eq filter into one row per entry', () => {
    const rows = attributeFiltersToQueryConditionRows([
      { key: 'region', value: ['us-east', 'us-west'] },
    ]);
    expect(rows.map(({ key, operator, value }) => ({ key, operator, value }))).toEqual([
      { key: 'region', operator: 'eq', value: 'us-east' },
      { key: 'region', operator: 'eq', value: 'us-west' },
    ]);
  });

  test('emits one row per populated operator on a filter', () => {
    const rows = attributeFiltersToQueryConditionRows([{ key: 'amount', gte: 100, lte: 900 }]);
    expect(rows.map(({ key, operator, value }) => ({ key, operator, value }))).toEqual([
      { key: 'amount', operator: 'gte', value: '100' },
      { key: 'amount', operator: 'lte', value: '900' },
    ]);
  });

  test('round-trips through queryConditionRowsToAttributeFilters for a simple set', () => {
    const original = [row('customerTier', 'eq', 'gold'), row('amount', 'gte', '500')];
    const filters = queryConditionRowsToAttributeFilters(original);
    const rebuilt = attributeFiltersToQueryConditionRows(filters);
    expect(rebuilt.map(({ key, operator, value }) => ({ key, operator, value }))).toEqual([
      { key: 'customerTier', operator: 'eq', value: 'gold' },
      { key: 'amount', operator: 'gte', value: '500' },
    ]);
  });

  test('agrees with the URL grammar (attribute-filters.ts) on inference and merging', () => {
    const rows = [row('region', 'eq', 'us-east'), row('region', 'eq', 'us-west')];
    const filters = queryConditionRowsToAttributeFilters(rows);

    const params = new URLSearchParams();
    for (const filter of filters) appendAttributeFilter(params, filter);
    const reparsed = parseAttributeFilters(params);

    expect(reparsed).toEqual(filters);
  });
});

describe('queryConditionRowsToRawPreview', () => {
  test('matches the design mock shape: { and: [{ key: { op: value } }] }', () => {
    const rows = [row('customerTier', 'eq', 'gold'), row('amount', 'gte', '500')];
    expect(queryConditionRowsToRawPreview(rows)).toEqual({
      and: [{ customerTier: { eq: 'gold' } }, { amount: { gte: 500 } }],
    });
  });

  test('empty rows produce an empty AND list', () => {
    expect(queryConditionRowsToRawPreview([])).toEqual({ and: [] });
  });
});

describe('createEmptyQueryConditionRow', () => {
  test('produces a blank eq row with a unique id', () => {
    const a = createEmptyQueryConditionRow();
    const b = createEmptyQueryConditionRow();
    expect(a.key).toBe('');
    expect(a.operator).toBe('eq');
    expect(a.value).toBe('');
    expect(a.id).not.toBe(b.id);
  });
});
