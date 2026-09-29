import { describe, expect, test } from 'bun:test';

import { DIAGNOSTIC_GUIDANCE, DIAGNOSTIC_KINDS } from './diagnostics-guidance.ts';

describe('DIAGNOSTIC_GUIDANCE', () => {
  test('has an entry for every diagnostic kind', () => {
    for (const kind of DIAGNOSTIC_KINDS) {
      expect(DIAGNOSTIC_GUIDANCE[kind]).toBeDefined();
    }
    expect(Object.keys(DIAGNOSTIC_GUIDANCE)).toHaveLength(DIAGNOSTIC_KINDS.length);
  });

  test('every entry has non-empty icon, title, and guidance copy', () => {
    for (const kind of DIAGNOSTIC_KINDS) {
      const entry = DIAGNOSTIC_GUIDANCE[kind];
      expect(entry.icon.length).toBeGreaterThan(0);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.guidance.length).toBeGreaterThan(0);
      expect(['warning', 'danger']).toContain(entry.variant);
    }
  });

  test('dead-lettered and all-workers-at-capacity are danger; the rest are warning (matches the design mock)', () => {
    expect(DIAGNOSTIC_GUIDANCE['dead-lettered'].variant).toBe('danger');
    expect(DIAGNOSTIC_GUIDANCE['all-workers-at-capacity'].variant).toBe('danger');
    expect(DIAGNOSTIC_GUIDANCE['stuck-queued'].variant).toBe('warning');
    expect(DIAGNOSTIC_GUIDANCE['stale-inflight'].variant).toBe('warning');
    expect(DIAGNOSTIC_GUIDANCE['retry-storm'].variant).toBe('warning');
  });

  test('guidance copy matches the design mock verbatim', () => {
    expect(DIAGNOSTIC_GUIDANCE['stuck-queued'].guidance).toBe(
      'Tasks are queued but no worker has picked them up. Check that workers polling this queue are healthy and not at capacity; scale up the deployment if utilization is sustained near 100%.',
    );
    expect(DIAGNOSTIC_GUIDANCE['dead-lettered'].guidance).toBe(
      'Tasks exhausted their retry policy and were moved to the dead-letter queue. Inspect the failing activity, fix the root cause, then redrive or clear the dead letter from Queue detail.',
    );
    expect(DIAGNOSTIC_GUIDANCE['stale-inflight'].guidance).toBe(
      'In-flight tasks have stopped heart-beating. The worker may have crashed or hung. The task will be re-queued after the heartbeat timeout; investigate the worker if this recurs.',
    );
    expect(DIAGNOSTIC_GUIDANCE['retry-storm'].guidance).toBe(
      'A high rate of retries is saturating the queue. Likely a downstream dependency is failing. Consider pausing the source schedule or applying a circuit breaker until the dependency recovers.',
    );
    expect(DIAGNOSTIC_GUIDANCE['all-workers-at-capacity'].guidance).toBe(
      'Every worker on this queue is at maximum concurrency. New work will wait. Scale out the deployment or raise per-worker concurrency if the hosts have headroom.',
    );
  });
});
