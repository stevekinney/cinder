/**
 * Tests for the `attr.<name>[.op]` query-parameter grammar (plan §4, T1.3).
 * Ground truth: `weft/src/server/attribute-filters.ts`
 * (`parseAttributeFilters` / `inferAttributeValue`) — every case here
 * documents a specific line of that file's behavior.
 */
import { describe, expect, test } from 'bun:test';

import {
  appendAttributeFilter,
  parseAttributeFilters,
  type AttributeFilter,
} from './attribute-filters.ts';

describe('appendAttributeFilter', () => {
  test('serializes an exact-match string value', () => {
    const params = new URLSearchParams();
    appendAttributeFilter(params, { key: 'region', value: 'us-east' });
    expect(params.toString()).toBe('attr.region=us-east');
  });

  test('serializes a multi-value exact match as repeated params, not a joined string', () => {
    const params = new URLSearchParams();
    appendAttributeFilter(params, { key: 'region', value: ['us-east', 'us-west'] });
    expect(params.getAll('attr.region')).toEqual(['us-east', 'us-west']);
  });

  test('serializes all four range operators', () => {
    const params = new URLSearchParams();
    appendAttributeFilter(params, { key: 'amount', gt: 1, lt: 100, gte: 2, lte: 99 });
    expect(params.get('attr.amount.gt')).toBe('1');
    expect(params.get('attr.amount.lt')).toBe('100');
    expect(params.get('attr.amount.gte')).toBe('2');
    expect(params.get('attr.amount.lte')).toBe('99');
  });

  test('serializes a Date value as epoch milliseconds', () => {
    const date = new Date('2026-07-20T00:00:00.000Z');
    const params = new URLSearchParams();
    appendAttributeFilter(params, { key: 'startedAt', gte: date });
    expect(params.get('attr.startedAt.gte')).toBe(String(date.getTime()));
  });

  test('serializes a boolean value verbatim', () => {
    const params = new URLSearchParams();
    appendAttributeFilter(params, { key: 'urgent', value: true });
    expect(params.get('attr.urgent')).toBe('true');
  });
});

describe('parseAttributeFilters', () => {
  test('parses a single exact-match value, inferring its type', () => {
    const params = new URLSearchParams('attr.region=us-east&attr.retries=3&attr.urgent=true');
    expect(parseAttributeFilters(params)).toEqual([
      { key: 'region', value: 'us-east' },
      { key: 'retries', value: 3 },
      { key: 'urgent', value: true },
    ]);
  });

  test('aggregates repeated exact-match params for the same name into a value array', () => {
    const params = new URLSearchParams('attr.region=us-east&attr.region=us-west');
    expect(parseAttributeFilters(params)).toEqual([
      { key: 'region', value: ['us-east', 'us-west'] },
    ]);
  });

  test('aggregates multiple range operators for the same name into one filter (the crux case)', () => {
    // A naive per-entry parser would emit two separate { key: 'amount', ... }
    // objects here instead of one filter carrying both bounds.
    const params = new URLSearchParams('attr.amount.gte=10&attr.amount.lte=100');
    expect(parseAttributeFilters(params)).toEqual([{ key: 'amount', gte: 10, lte: 100 }]);
  });

  test('merges an exact-match value and a range bound for the same name', () => {
    const params = new URLSearchParams('attr.amount=50&attr.amount.gt=0');
    expect(parseAttributeFilters(params)).toEqual([{ key: 'amount', value: 50, gt: 0 }]);
  });

  test('the empty string stays a string rather than coercing to 0', () => {
    const params = new URLSearchParams('attr.label=');
    expect(parseAttributeFilters(params)).toEqual([{ key: 'label', value: '' }]);
  });

  test('silently skips an unrecognized operator without storing an entry', () => {
    const params = new URLSearchParams('attr.region.bogus=us-east');
    expect(parseAttributeFilters(params)).toEqual([]);
  });

  test('an unrecognized operator does not clobber a real filter for the same name', () => {
    const params = new URLSearchParams('attr.region=us-east&attr.region.bogus=nope');
    expect(parseAttributeFilters(params)).toEqual([{ key: 'region', value: 'us-east' }]);
  });

  test('reads the operator via the FIRST dot after "attr." — a dotted name misparses as an unknown operator (matches the server)', () => {
    const params = new URLSearchParams('attr.foo.bar=x');
    // "foo.bar" splits into name "foo", operator "bar" — an unrecognized
    // operator, so it is dropped entirely, exactly as it would be by
    // weft's server-side parser.
    expect(parseAttributeFilters(params)).toEqual([]);
  });

  test('ignores params that are not attr.* entries', () => {
    const params = new URLSearchParams('status=running&attr.region=us-east');
    expect(parseAttributeFilters(params)).toEqual([{ key: 'region', value: 'us-east' }]);
  });

  test('a "-0" string value survives one parse as the number -0, but loses its sign on a second pass (documented wire-format limit, not a bug)', () => {
    // JS cannot round-trip -0 through decimal text: `Number(String(-0))` is
    // `0`, never `-0`. weft's own `jsonCodec()` rejects `-0` outright for
    // the identical reason (`weft/src/core/json.ts`). This module makes no
    // attempt to invent a sign-preserving encoding the server doesn't also
    // use — parity with the real grammar matters more than self-consistency
    // on an input no operator would type by coincidence.
    const params = new URLSearchParams();
    appendAttributeFilter(params, { key: 'code', value: '-0' });

    const [firstPass] = parseAttributeFilters(params);
    expect(firstPass).toEqual({ key: 'code', value: -0 });
    expect(Object.is(firstPass?.value, -0)).toBe(true);

    const reserialized = new URLSearchParams();
    appendAttributeFilter(reserialized, firstPass!);
    const [secondPass] = parseAttributeFilters(reserialized);
    expect(secondPass).toEqual({ key: 'code', value: 0 });
    expect(Object.is(secondPass?.value, -0)).toBe(false);
  });

  test('never infers a Date — a parsed value is always string, number, or boolean', () => {
    const date = new Date('2026-07-20T00:00:00.000Z');
    const params = new URLSearchParams();
    appendAttributeFilter(params, { key: 'startedAt', gte: date });

    const [parsed] = parseAttributeFilters(params);
    expect(parsed).toEqual({ key: 'startedAt', gte: date.getTime() });
    expect(typeof parsed?.gte).toBe('number');
  });
});

describe('appendAttributeFilter + parseAttributeFilters round-trip', () => {
  test('a multi-constraint filter round-trips as one filter object', () => {
    const filter: AttributeFilter = { key: 'amount', gte: 10, lte: 100 };
    const params = new URLSearchParams();
    appendAttributeFilter(params, filter);
    expect(parseAttributeFilters(params)).toEqual([filter]);
  });

  test('a multi-value exact-match filter round-trips as an array', () => {
    const filter: AttributeFilter = { key: 'region', value: ['us-east', 'us-west', 'eu-west'] };
    const params = new URLSearchParams();
    appendAttributeFilter(params, filter);
    expect(parseAttributeFilters(params)).toEqual([filter]);
  });

  test('a numeric-looking string value round-trips as a number (inherent to the wire grammar)', () => {
    const params = new URLSearchParams();
    appendAttributeFilter(params, { key: 'code', value: '404' });
    expect(parseAttributeFilters(params)).toEqual([{ key: 'code', value: 404 }]);
  });
});
