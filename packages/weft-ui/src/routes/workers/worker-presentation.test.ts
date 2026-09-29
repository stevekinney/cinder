import { describe, expect, test } from 'bun:test';

import type { WorkerDeploymentSummary, WorkerSummary } from './worker-catalog-types.ts';
import {
  asDisplayString,
  deploymentHealthPresentation,
  formatDeploymentIdentity,
  formatDeploymentName,
  HEARTBEAT_ELEVATED_AFTER_MS,
  HEARTBEAT_STALE_AFTER_MS,
  heartbeatSeverity,
  heartbeatSeverityCssVariable,
  heartbeatSeverityVariant,
  presentationStatusDotStatus,
  queueBacklogVariant,
  summarizeFleet,
  workerHealthPresentation,
} from './worker-presentation.ts';

function worker(overrides: Partial<WorkerSummary> = {}): WorkerSummary {
  return {
    id: 'wkr_1',
    transport: 'websocket',
    queue: 'default',
    activities: ['Workflow.activity'],
    concurrency: 4,
    inFlight: 1,
    availableCapacity: 3,
    connectedAt: 0,
    lastHeartbeatAt: 0,
    startedAt: 0,
    heartbeatAgeMs: 1_000,
    capabilities: {},
    health: 'active',
    ...overrides,
  };
}

function deployment(overrides: Partial<WorkerDeploymentSummary> = {}): WorkerDeploymentSummary {
  return {
    activeWorkers: 1,
    buildId: '#4821',
    deploymentName: 'api-prod',
    drainedWorkers: 0,
    drainingWorkers: 0,
    health: 'active',
    inFlight: 1,
    oldestStartedAt: null,
    runtimeVersion: 'node 20',
    transports: ['websocket'],
    workers: 1,
    ...overrides,
  };
}

describe('heartbeatSeverity', () => {
  test('fresh below the elevated threshold', () => {
    expect(heartbeatSeverity(HEARTBEAT_ELEVATED_AFTER_MS - 1)).toBe('fresh');
  });

  test('elevated at/above the elevated threshold, below stale', () => {
    expect(heartbeatSeverity(HEARTBEAT_ELEVATED_AFTER_MS)).toBe('elevated');
    expect(heartbeatSeverity(HEARTBEAT_STALE_AFTER_MS - 1)).toBe('elevated');
  });

  test('stale at/above the stale threshold', () => {
    expect(heartbeatSeverity(HEARTBEAT_STALE_AFTER_MS)).toBe('stale');
  });

  test('heartbeatSeverityVariant maps each tier to its status tone', () => {
    expect(heartbeatSeverityVariant('fresh')).toBe('success');
    expect(heartbeatSeverityVariant('elevated')).toBe('warning');
    expect(heartbeatSeverityVariant('stale')).toBe('danger');
  });
});

describe('workerHealthPresentation — priority order', () => {
  test('draining wins even with a fresh heartbeat', () => {
    expect(workerHealthPresentation(worker({ health: 'draining', heartbeatAgeMs: 500 }))).toEqual({
      label: 'Draining',
      variant: 'warning',
    });
  });

  test('draining wins even with a stale heartbeat (design mock: 1m12s draining worker)', () => {
    expect(
      workerHealthPresentation(worker({ health: 'draining', heartbeatAgeMs: 72_000 })),
    ).toEqual({ label: 'Draining', variant: 'warning' });
  });

  test('drained wins over heartbeat state', () => {
    expect(
      workerHealthPresentation(
        worker({ health: 'drained', heartbeatAgeMs: HEARTBEAT_STALE_AFTER_MS }),
      ),
    ).toEqual({ label: 'Drained', variant: 'neutral' });
  });

  test('active + stale heartbeat renders Stale', () => {
    expect(
      workerHealthPresentation(
        worker({ health: 'active', heartbeatAgeMs: HEARTBEAT_STALE_AFTER_MS }),
      ),
    ).toEqual({ label: 'Stale', variant: 'danger' });
  });

  test('active + fresh/elevated heartbeat renders Healthy', () => {
    expect(workerHealthPresentation(worker({ health: 'active', heartbeatAgeMs: 4_000 }))).toEqual({
      label: 'Healthy',
      variant: 'success',
    });
    expect(
      workerHealthPresentation(
        worker({ health: 'active', heartbeatAgeMs: HEARTBEAT_ELEVATED_AFTER_MS }),
      ),
    ).toEqual({ label: 'Healthy', variant: 'success' });
  });
});

describe('deploymentHealthPresentation', () => {
  test('draining, drained, and active map to their tones', () => {
    expect(deploymentHealthPresentation(deployment({ health: 'draining' }))).toEqual({
      label: 'Draining',
      variant: 'warning',
    });
    expect(deploymentHealthPresentation(deployment({ health: 'drained' }))).toEqual({
      label: 'Drained',
      variant: 'neutral',
    });
    expect(deploymentHealthPresentation(deployment({ health: 'active' }))).toEqual({
      label: 'Healthy',
      variant: 'success',
    });
  });
});

describe('summarizeFleet', () => {
  test('empty fleet', () => {
    expect(summarizeFleet([])).toEqual({
      totalWorkers: 0,
      activeWorkers: 0,
      drainingWorkers: 0,
      inFlight: 0,
      capacity: 0,
      utilizationPercent: 0,
    });
  });

  test('tallies active/draining counts, sums inFlight/capacity, and rounds utilization', () => {
    const workers = [
      worker({ health: 'active', inFlight: 3, concurrency: 10 }),
      worker({ health: 'active', inFlight: 8, concurrency: 10 }),
      worker({ health: 'draining', inFlight: 1, concurrency: 4 }),
    ];
    expect(summarizeFleet(workers)).toEqual({
      totalWorkers: 3,
      activeWorkers: 2,
      drainingWorkers: 1,
      inFlight: 12,
      capacity: 24,
      utilizationPercent: 50,
    });
  });

  test('drained workers count toward the total but not active/draining', () => {
    const workers = [worker({ health: 'drained', inFlight: 0, concurrency: 4 })];
    const totals = summarizeFleet(workers);
    expect(totals.totalWorkers).toBe(1);
    expect(totals.activeWorkers).toBe(0);
    expect(totals.drainingWorkers).toBe(0);
  });
});

describe('presentationStatusDotStatus', () => {
  test('maps success to online and passes the rest through unchanged', () => {
    expect(presentationStatusDotStatus('success')).toBe('online');
    expect(presentationStatusDotStatus('warning')).toBe('warning');
    expect(presentationStatusDotStatus('danger')).toBe('danger');
    expect(presentationStatusDotStatus('neutral')).toBe('neutral');
  });
});

describe('heartbeatSeverityCssVariable', () => {
  test('returns a distinct Cinder status-tone variable per severity', () => {
    expect(heartbeatSeverityCssVariable('fresh')).toBe('var(--cinder-color-success-fg)');
    expect(heartbeatSeverityCssVariable('elevated')).toBe('var(--cinder-color-warning-fg)');
    expect(heartbeatSeverityCssVariable('stale')).toBe('var(--cinder-color-danger-fg)');
  });
});

describe('queueBacklogVariant', () => {
  test('zero is neutral, some backlog is warning, over 50 is danger', () => {
    expect(queueBacklogVariant(0)).toBe('neutral');
    expect(queueBacklogVariant(1)).toBe('warning');
    expect(queueBacklogVariant(50)).toBe('warning');
    expect(queueBacklogVariant(51)).toBe('danger');
  });
});

describe('asDisplayString', () => {
  test('passes through non-empty strings', () => {
    expect(asDisplayString('node 20')).toBe('node 20');
  });

  test('falls back for null, non-string, and empty string', () => {
    expect(asDisplayString(null)).toBe('—');
    expect(asDisplayString(undefined)).toBe('—');
    expect(asDisplayString(42)).toBe('—');
    expect(asDisplayString('')).toBe('—');
  });

  test('accepts a custom fallback', () => {
    expect(asDisplayString(null, '(none)')).toBe('(none)');
  });
});

describe('formatDeploymentIdentity / formatDeploymentName', () => {
  test('joins build/runtime with the metadata separator', () => {
    expect(formatDeploymentIdentity(deployment())).toBe('#4821 · node 20');
  });

  test('missing fields fall back to an em dash', () => {
    expect(formatDeploymentIdentity(deployment({ buildId: null, runtimeVersion: null }))).toBe(
      '— · —',
    );
  });

  test('deployment name falls back to a labeled placeholder, not an em dash', () => {
    expect(formatDeploymentName(deployment())).toBe('api-prod');
    expect(formatDeploymentName(deployment({ deploymentName: null }))).toBe('(no deployment)');
  });
});
