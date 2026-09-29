/**
 * Tests for the typed `ListFilter` ↔ `URLSearchParams` serializer (plan §4,
 * T1.3). Three tiers:
 *
 * 1. Exact param-name assertions against the REST grammar, verified against
 *    `weft/src/server/operations/list-filter-query-extractor.ts` (ground
 *    truth, not the plan prose's shorthand naming — see `filters.ts`'s own
 *    header comment).
 * 2. Canonical round-trips: realistic, already-canonical filters must
 *    round-trip byte-for-byte.
 * 3. A property-style fixpoint test over hundreds of randomly generated
 *    filters (a seeded PRNG — no new test dependency). Several dimensions
 *    are lossy by construction (a 1-element array collapses to a scalar, an
 *    empty array disappears, a numeric-looking string becomes a number, a
 *    `Date` attribute value becomes an epoch number — see
 *    `attribute-filters.ts`), so exact equality after one pass isn't the
 *    right property to assert for arbitrary generated input. Idempotence
 *    is: once a filter has been through the codec once, going through it
 *    again must be a no-op. That holds regardless of which lossy
 *    normalization fired, and it's what actually matters for "the URL is
 *    the source of truth" (plan §1.5) — a filter read back from the URL and
 *    written back out must not drift on every render.
 */
import type { FailureCategory, WorkflowStatus } from '@lostgradient/weft';
import { describe, expect, test } from 'bun:test';

import type { AttributeFilter, AttributeScalar } from './attribute-filters.ts';
import {
  parseWorkflowListFilter,
  serializeWorkflowListFilter,
  type TimeRange,
  type WorkflowListQuery,
} from './filters.ts';

const WORKFLOW_STATUSES: readonly WorkflowStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timed-out',
  'suspended',
];

const FAILURE_CATEGORIES: readonly FailureCategory[] = [
  'application',
  'timeout',
  'cancellation',
  'resource',
  'system',
];

describe('serializeWorkflowListFilter — matches the REST grammar exactly', () => {
  test('status: repeated, one param per value', () => {
    const params = serializeWorkflowListFilter({ status: ['running', 'failed'] });
    expect(params.toString()).toBe('status=running&status=failed');
  });

  test('type: single param', () => {
    const params = serializeWorkflowListFilter({ type: 'order-fulfillment' });
    expect(params.toString()).toBe('type=order-fulfillment');
  });

  test('tag: repeated (AND semantics belong to the server, not encoded here)', () => {
    const params = serializeWorkflowListFilter({ tags: ['priority', 'eu-region'] });
    expect(params.toString()).toBe('tag=priority&tag=eu-region');
  });

  test('id_prefix: snake_case param name', () => {
    const params = serializeWorkflowListFilter({ idPrefix: 'wf_9f3c' });
    expect(params.toString()).toBe('id_prefix=wf_9f3c');
  });

  test('failure_category: repeated (OR semantics belong to the server, not encoded here)', () => {
    const params = serializeWorkflowListFilter({ failureCategory: ['timeout', 'resource'] });
    expect(params.toString()).toBe('failure_category=timeout&failure_category=resource');
  });

  test('created_at_{gte,gt,lte,lt}', () => {
    const params = serializeWorkflowListFilter({ createdAt: { gte: 1, gt: 2, lte: 3, lt: 4 } });
    expect(params.get('created_at_gte')).toBe('1');
    expect(params.get('created_at_gt')).toBe('2');
    expect(params.get('created_at_lte')).toBe('3');
    expect(params.get('created_at_lt')).toBe('4');
  });

  test('updated_at_* and execution_deadline_*', () => {
    const params = serializeWorkflowListFilter({
      updatedAt: { gte: 10 },
      executionDeadline: { lt: 20 },
    });
    expect(params.get('updated_at_gte')).toBe('10');
    expect(params.get('execution_deadline_lt')).toBe('20');
  });

  test('attr.<name>[.op] (ground truth spelling — see attribute-filters.ts)', () => {
    const params = serializeWorkflowListFilter({
      attributes: [{ key: 'region', value: 'us-east' }],
    });
    expect(params.toString()).toBe('attr.region=us-east');
  });

  test('include=failureCategory', () => {
    const params = serializeWorkflowListFilter({ includeFailureCategory: true });
    expect(params.toString()).toBe('include=failureCategory');
  });

  test('omits include when includeFailureCategory is false', () => {
    const params = serializeWorkflowListFilter({ includeFailureCategory: false });
    expect(params.toString()).toBe('');
  });

  test('limit / offset', () => {
    const params = serializeWorkflowListFilter({ limit: 50, offset: 100 });
    expect(params.get('limit')).toBe('50');
    expect(params.get('offset')).toBe('100');
  });
});

describe('parseWorkflowListFilter — single vs. multi collapsing', () => {
  test('a single status param parses to a scalar, not a 1-element array', () => {
    expect(parseWorkflowListFilter(new URLSearchParams('status=running'))).toEqual({
      status: 'running',
    });
  });

  test('two status params parse to an array', () => {
    expect(parseWorkflowListFilter(new URLSearchParams('status=running&status=failed'))).toEqual({
      status: ['running', 'failed'],
    });
  });

  test('an absent dimension is omitted, not present as undefined/empty', () => {
    const filter = parseWorkflowListFilter(new URLSearchParams(''));
    expect(filter).toEqual({});
    expect('status' in filter).toBe(false);
  });
});

describe('serializeWorkflowListFilter / parseWorkflowListFilter — canonical round-trip', () => {
  test('round-trips a realistic multi-dimension filter exactly', () => {
    const filter: WorkflowListQuery = {
      status: ['running', 'failed'],
      type: 'order-fulfillment',
      tags: ['priority', 'eu-region'],
      attributes: [
        { key: 'customerId', value: 'cust_123' },
        { key: 'amount', gte: 100, lte: 500 },
      ],
      idPrefix: 'wf_9f3c',
      failureCategory: ['timeout', 'resource'],
      createdAt: { gte: 1_700_000_000_000, lt: 1_800_000_000_000 },
      updatedAt: { gt: 1_700_000_000_000 },
      executionDeadline: { lte: 1_900_000_000_000 },
      includeFailureCategory: true,
      limit: 50,
      offset: 100,
    };

    expect(parseWorkflowListFilter(serializeWorkflowListFilter(filter))).toEqual(filter);
  });

  test('round-trips a minimal single-status filter', () => {
    const filter: WorkflowListQuery = { status: 'running', limit: 25 };
    expect(parseWorkflowListFilter(serializeWorkflowListFilter(filter))).toEqual(filter);
  });

  test('an empty filter round-trips to an empty filter', () => {
    expect(parseWorkflowListFilter(serializeWorkflowListFilter({}))).toEqual({});
  });

  test('a multi-constraint attribute filter round-trips as one filter, not two (regression)', () => {
    const filter: WorkflowListQuery = { attributes: [{ key: 'amount', gte: 10, lte: 100 }] };
    expect(parseWorkflowListFilter(serializeWorkflowListFilter(filter))).toEqual(filter);
  });
});

// ---------------------------------------------------------------------------
// Property-style fixpoint test over generated filters
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32) — no new test dependency (only cron-parser was authorized). */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pick<T>(rand: () => number, values: readonly T[]): T {
  const value = values[randomInt(rand, 0, values.length - 1)];
  if (value === undefined) throw new Error('weft-ui: pick() called with an empty array');
  return value;
}

const RANDOM_STRING_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789._- ';

function randomString(rand: () => number, maxLength: number): string {
  const length = randomInt(rand, 0, maxLength);
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += pick(rand, RANDOM_STRING_ALPHABET.split(''));
  }
  return result;
}

function randomArray<T>(rand: () => number, maxLength: number, generate: () => T): T[] {
  const length = randomInt(rand, 0, maxLength);
  return Array.from({ length }, generate);
}

function randomWorkflowStatus(rand: () => number): WorkflowStatus | WorkflowStatus[] {
  return rand() < 0.4
    ? pick(rand, WORKFLOW_STATUSES)
    : randomArray(rand, 4, () => pick(rand, WORKFLOW_STATUSES));
}

function randomFailureCategory(rand: () => number): FailureCategory | FailureCategory[] {
  return rand() < 0.4
    ? pick(rand, FAILURE_CATEGORIES)
    : randomArray(rand, 3, () => pick(rand, FAILURE_CATEGORIES));
}

function randomAttributeScalar(rand: () => number): AttributeScalar {
  const kind = randomInt(rand, 0, 3);
  if (kind === 0) return randomInt(rand, -1_000, 1_000);
  if (kind === 1) return rand() < 0.5;
  if (kind === 2) return new Date(randomInt(rand, 0, 2_000_000_000_000));

  const text = randomString(rand, 8);
  // Any string that `Number()` parses to -0 ("-0", "-00", "-0.0", …) is
  // excluded, not because the codec mishandles it, but because JS itself
  // can't round-trip `-0` through decimal text: `Number(String(-0))` is
  // `0`, never `-0` (verified above this file's property tests). weft's own
  // `jsonCodec()` rejects `-0` outright for the identical reason (see
  // `weft/src/core/json.ts`), so this is a documented wire-format limit,
  // not a bug — `attribute-filters.test.ts` has a dedicated regression test
  // pinning the exact (intentional) behavior. Appending a non-numeric
  // suffix keeps the case interesting (a string that merely *starts* like a
  // number) without hitting the unrepresentable value.
  return Object.is(Number(text), -0) ? `${text}x` : text;
}

function randomAttributeFilter(rand: () => number): AttributeFilter {
  const filter: AttributeFilter = { key: randomString(rand, 6) };
  if (rand() < 0.6) {
    filter.value =
      rand() < 0.5
        ? randomAttributeScalar(rand)
        : randomArray(rand, 3, () => randomAttributeScalar(rand));
  }
  if (rand() < 0.3) filter.gt = randomAttributeScalar(rand);
  if (rand() < 0.3) filter.lt = randomAttributeScalar(rand);
  if (rand() < 0.3) filter.gte = randomAttributeScalar(rand);
  if (rand() < 0.3) filter.lte = randomAttributeScalar(rand);
  return filter;
}

function randomTimeRange(rand: () => number): TimeRange | undefined {
  const range: TimeRange = {};
  if (rand() < 0.5) range.gte = randomInt(rand, 0, 2_000_000_000_000);
  if (rand() < 0.5) range.gt = randomInt(rand, 0, 2_000_000_000_000);
  if (rand() < 0.5) range.lte = randomInt(rand, 0, 2_000_000_000_000);
  if (rand() < 0.5) range.lt = randomInt(rand, 0, 2_000_000_000_000);
  return Object.keys(range).length > 0 ? range : undefined;
}

// Split into three small appliers (mirroring filters.ts's own
// appendAllTimeRanges/parseAllTimeRanges split) to stay under the repo's
// complexity budget — a single flat function touching every dimension trips
// it well before covering the whole grammar.

function applyRandomCoreDimensions(rand: () => number, filter: WorkflowListQuery): void {
  if (rand() < 0.7) filter.status = randomWorkflowStatus(rand);
  if (rand() < 0.5) filter.type = randomString(rand, 12);
  if (rand() < 0.5) filter.tags = randomArray(rand, 4, () => randomString(rand, 8));
  if (rand() < 0.5) filter.attributes = randomArray(rand, 3, () => randomAttributeFilter(rand));
  if (rand() < 0.4) filter.idPrefix = randomString(rand, 10);
  if (rand() < 0.5) filter.failureCategory = randomFailureCategory(rand);
}

function applyRandomTimeRanges(rand: () => number, filter: WorkflowListQuery): void {
  const createdAt = rand() < 0.5 ? randomTimeRange(rand) : undefined;
  if (createdAt) filter.createdAt = createdAt;
  const updatedAt = rand() < 0.5 ? randomTimeRange(rand) : undefined;
  if (updatedAt) filter.updatedAt = updatedAt;
  const executionDeadline = rand() < 0.5 ? randomTimeRange(rand) : undefined;
  if (executionDeadline) filter.executionDeadline = executionDeadline;
}

function applyRandomPagination(rand: () => number, filter: WorkflowListQuery): void {
  if (rand() < 0.5) filter.includeFailureCategory = true;
  if (rand() < 0.5) filter.limit = randomInt(rand, 0, 1_000);
  if (rand() < 0.5) filter.offset = randomInt(rand, 0, 1_000);
}

function randomWorkflowListQuery(rand: () => number): WorkflowListQuery {
  const filter: WorkflowListQuery = {};

  applyRandomCoreDimensions(rand, filter);
  applyRandomTimeRanges(rand, filter);
  applyRandomPagination(rand, filter);

  return filter;
}

describe('serializeWorkflowListFilter / parseWorkflowListFilter — fixpoint round-trip', () => {
  test('parse(serialize(x)) is a fixpoint of the codec across 500 generated filters', () => {
    const rand = mulberry32(0x5eed_1234);

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const generated = randomWorkflowListQuery(rand);

      const once = parseWorkflowListFilter(serializeWorkflowListFilter(generated));
      const twice = parseWorkflowListFilter(serializeWorkflowListFilter(once));

      expect(twice).toEqual(once);
    }
  });

  test('the fixpoint holds for attribute filters generated directly (dotted keys, arrays, Date values included)', () => {
    const rand = mulberry32(0x0ff5e7);

    for (let iteration = 0; iteration < 300; iteration += 1) {
      const generated: WorkflowListQuery = {
        attributes: randomArray(rand, 5, () => randomAttributeFilter(rand)),
      };

      const once = parseWorkflowListFilter(serializeWorkflowListFilter(generated));
      const twice = parseWorkflowListFilter(serializeWorkflowListFilter(once));

      expect(twice).toEqual(once);
    }
  });
});
