import { describe, expect, test } from 'bun:test';

import {
  aggregateDrillThroughFilter,
  aggregateGroupByLabel,
  aggregateGroupByToWire,
  aggregateGroupKeyLabel,
  attributeGroupByName,
  parseAggregateGroupBy,
} from './aggregate-group-by.ts';

describe('parseAggregateGroupBy', () => {
  test('parses the three fixed dimensions', () => {
    expect(parseAggregateGroupBy('status')).toBe('status');
    expect(parseAggregateGroupBy('type')).toBe('type');
    expect(parseAggregateGroupBy('failureCategory')).toBe('failureCategory');
  });

  test('parses an attribute dimension', () => {
    expect(parseAggregateGroupBy('attribute:customerTier')).toBe('attribute:customerTier');
  });

  test('rejects an empty attribute name, unknown dimensions, and null', () => {
    expect(parseAggregateGroupBy('attribute:')).toBeNull();
    expect(parseAggregateGroupBy('bogus')).toBeNull();
    expect(parseAggregateGroupBy(null)).toBeNull();
  });
});

describe('attributeGroupByName', () => {
  test('extracts the attribute name from an attribute dimension', () => {
    expect(attributeGroupByName('attribute:customerTier')).toBe('customerTier');
  });

  test('returns null for a fixed dimension', () => {
    expect(attributeGroupByName('status')).toBeNull();
  });
});

describe('aggregateGroupByToWire', () => {
  test('passes fixed dimensions through unchanged', () => {
    expect(aggregateGroupByToWire('status')).toBe('status');
    expect(aggregateGroupByToWire('failureCategory')).toBe('failureCategory');
  });

  test('converts an attribute dimension to the { attribute } wire shape', () => {
    expect(aggregateGroupByToWire('attribute:customerTier')).toEqual({
      attribute: 'customerTier',
    });
  });
});

describe('aggregateGroupByLabel', () => {
  test('labels every fixed dimension', () => {
    expect(aggregateGroupByLabel('status')).toBe('Status');
    expect(aggregateGroupByLabel('type')).toBe('Type');
    expect(aggregateGroupByLabel('failureCategory')).toBe('Failure category');
  });

  test('labels an attribute dimension with its raw attribute name', () => {
    expect(aggregateGroupByLabel('attribute:customerTier')).toBe('customerTier');
  });
});

describe('aggregateGroupKeyLabel', () => {
  test('renders "(none)" for a null key', () => {
    expect(aggregateGroupKeyLabel(null)).toBe('(none)');
  });

  test('renders a real key verbatim', () => {
    expect(aggregateGroupKeyLabel('failed')).toBe('failed');
  });
});

describe('aggregateDrillThroughFilter', () => {
  test('builds a status filter', () => {
    expect(aggregateDrillThroughFilter('status', 'failed')).toEqual({ status: 'failed' });
  });

  test('builds a type filter', () => {
    expect(aggregateDrillThroughFilter('type', 'order-processing')).toEqual({
      type: 'order-processing',
    });
  });

  test('builds a failureCategory filter', () => {
    expect(aggregateDrillThroughFilter('failureCategory', 'application')).toEqual({
      failureCategory: 'application',
    });
  });

  test('builds an attribute equality filter', () => {
    expect(aggregateDrillThroughFilter('attribute:customerTier', 'gold')).toEqual({
      attributes: [{ key: 'customerTier', value: 'gold' }],
    });
  });

  test('returns null for the "(none)" bucket — no drill-through for a missing dimension', () => {
    expect(aggregateDrillThroughFilter('status', null)).toBeNull();
    expect(aggregateDrillThroughFilter('attribute:customerTier', null)).toBeNull();
  });
});
