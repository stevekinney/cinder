import { describe, expect, test } from 'bun:test';

import { waitFor } from '@testing-library/svelte';

import { ActivityFeedBatcher, type ActivityFeedRow } from './activity-feed-batcher.svelte.ts';

function row(overrides: Partial<ActivityFeedRow> = {}): ActivityFeedRow {
  return {
    id: 'cursor-1',
    tier: 'info',
    icon: 'play',
    title: 'Workflow started',
    body: 'Workflow wf_12345',
    href: '/workflows/wf_1',
    emittedAtMs: 1_000,
    ...overrides,
  };
}

const FAST_WINDOW_MS = 5;

describe('ActivityFeedBatcher', () => {
  test('starts empty, not paused', () => {
    const batcher = new ActivityFeedBatcher();
    expect(batcher.items).toEqual([]);
    expect(batcher.pendingCount).toBe(0);
    expect(batcher.paused).toBe(false);
    batcher.dispose();
  });

  test('flushes an ingested row into items after the batch window', async () => {
    const batcher = new ActivityFeedBatcher({ batchWindowMs: FAST_WINDOW_MS });
    batcher.ingest(row({ id: 'a' }));

    await waitFor(() => expect(batcher.items).toHaveLength(1));
    expect(batcher.items[0]?.id).toBe('a');
    batcher.dispose();
  });

  test('coalesces multiple rows ingested within one window into a single flush, newest first', async () => {
    const batcher = new ActivityFeedBatcher({ batchWindowMs: FAST_WINDOW_MS });
    batcher.ingest(row({ id: 'a' }));
    batcher.ingest(row({ id: 'b' }));
    batcher.ingest(row({ id: 'c' }));

    await waitFor(() => expect(batcher.items).toHaveLength(3));
    expect(batcher.items.map((item) => item.id)).toEqual(['c', 'b', 'a']);
    batcher.dispose();
  });

  test('caps visible items at the configured limit', async () => {
    const batcher = new ActivityFeedBatcher({ batchWindowMs: FAST_WINDOW_MS, visibleCap: 2 });
    batcher.ingest(row({ id: 'a' }));
    await waitFor(() => expect(batcher.items).toHaveLength(1));
    batcher.ingest(row({ id: 'b' }));
    await waitFor(() => expect(batcher.items).toHaveLength(2));
    batcher.ingest(row({ id: 'c' }));

    await waitFor(() => expect(batcher.items.map((item) => item.id)).toEqual(['c', 'b']));
    batcher.dispose();
  });

  test('while paused, ingested rows accumulate as pendingCount instead of appending to items', async () => {
    const batcher = new ActivityFeedBatcher({ batchWindowMs: FAST_WINDOW_MS });
    batcher.pause();
    batcher.ingest(row({ id: 'a' }));
    batcher.ingest(row({ id: 'b' }));

    await waitFor(() => expect(batcher.pendingCount).toBe(2));
    expect(batcher.items).toEqual([]);
    batcher.dispose();
  });

  test('resume() flushes held rows into items and clears pendingCount', async () => {
    const batcher = new ActivityFeedBatcher({ batchWindowMs: FAST_WINDOW_MS });
    batcher.pause();
    batcher.ingest(row({ id: 'a' }));
    await waitFor(() => expect(batcher.pendingCount).toBe(1));

    batcher.resume();

    expect(batcher.paused).toBe(false);
    expect(batcher.pendingCount).toBe(0);
    expect(batcher.items.map((item) => item.id)).toEqual(['a']);
    batcher.dispose();
  });

  test('resume() with nothing held is a no-op beyond unpausing', () => {
    const batcher = new ActivityFeedBatcher({ batchWindowMs: FAST_WINDOW_MS });
    batcher.pause();
    batcher.resume();
    expect(batcher.paused).toBe(false);
    expect(batcher.items).toEqual([]);
    batcher.dispose();
  });

  test('rows ingested after resume append normally', async () => {
    const batcher = new ActivityFeedBatcher({ batchWindowMs: FAST_WINDOW_MS });
    batcher.pause();
    batcher.ingest(row({ id: 'a' }));
    await waitFor(() => expect(batcher.pendingCount).toBe(1));
    batcher.resume();

    batcher.ingest(row({ id: 'b' }));
    await waitFor(() => expect(batcher.items.map((item) => item.id)).toEqual(['b', 'a']));
    batcher.dispose();
  });

  test('dispose() cancels a pending flush so it never lands', async () => {
    const batcher = new ActivityFeedBatcher({ batchWindowMs: FAST_WINDOW_MS });
    batcher.ingest(row({ id: 'a' }));
    batcher.dispose();

    await new Promise((resolve) => setTimeout(resolve, FAST_WINDOW_MS * 3));
    expect(batcher.items).toEqual([]);
  });
});
