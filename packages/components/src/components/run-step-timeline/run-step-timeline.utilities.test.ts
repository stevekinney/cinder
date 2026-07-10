import { describe, expect, test } from 'bun:test';

import type { RunStep, RunStepBranchLane, RunStepStatus } from './run-step-timeline.types.ts';
import {
  actionsCountLabel,
  badgeVariant,
  branchGroupHasCurrentStep,
  branchOutcomeSummary,
  branchStartsCollapsed,
  hasProgress,
  hiddenNestedStepLabel,
  isCurrent,
  isTerminal,
  laneOutcomeBadgeVariant,
  laneOutcomeLabel,
  metadataItems,
  safeStepLinkHref,
  statusDotStatus,
  statusLabel,
} from './run-step-timeline.utilities.ts';

const ALL_STATUSES: RunStepStatus[] = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'skipped',
  'retrying',
  'waiting_approval',
];

describe('status mapping', () => {
  test('statusDotStatus maps every status to a StatusDot token', () => {
    const map = Object.fromEntries(ALL_STATUSES.map((s) => [s, statusDotStatus(s)]));
    expect(map).toEqual({
      pending: 'pending',
      running: 'online',
      succeeded: 'success',
      failed: 'danger',
      cancelled: 'offline',
      skipped: 'neutral',
      retrying: 'warning',
      waiting_approval: 'accent',
    });
  });

  test('statusLabel returns a human label for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(statusLabel(status).length).toBeGreaterThan(0);
    }
    expect(statusLabel('waiting_approval')).toBe('Waiting approval');
  });

  test('badgeVariant maps every status to a badge variant', () => {
    const map = Object.fromEntries(ALL_STATUSES.map((s) => [s, badgeVariant(s)]));
    expect(map).toEqual({
      pending: 'neutral',
      running: 'info',
      succeeded: 'success',
      failed: 'danger',
      cancelled: 'neutral',
      skipped: 'neutral',
      retrying: 'warning',
      waiting_approval: 'accent',
    });
  });

  test('isTerminal / isCurrent partition the statuses', () => {
    expect(ALL_STATUSES.filter(isTerminal)).toEqual([
      'succeeded',
      'failed',
      'cancelled',
      'skipped',
    ]);
    expect(ALL_STATUSES.filter(isCurrent)).toEqual(['running', 'retrying', 'waiting_approval']);
    expect(isTerminal('pending')).toBe(false);
    expect(isCurrent('pending')).toBe(false);
  });
});

describe('hasProgress', () => {
  const base: RunStep = { id: 'a', label: 'A', status: 'running' };
  test('true only for current steps with a progress value', () => {
    expect(hasProgress({ ...base, status: 'running', progress: 40 })).toBe(true);
    expect(hasProgress({ ...base, status: 'succeeded', progress: 40 })).toBe(false);
    expect(hasProgress({ ...base, status: 'running' })).toBe(false);
  });
});

describe('metadataItems', () => {
  test('collects present time/duration/attempt fields', () => {
    const items = metadataItems({
      id: 'a',
      label: 'A',
      status: 'succeeded',
      startTime: 's',
      endTime: 'e',
      duration: '1m',
      attemptCount: 3,
    });
    expect(items.map((i) => i.term)).toEqual(['Started', 'Ended', 'Duration', 'Attempts']);
    expect(items.at(-1)?.definition).toBe('3');
  });

  test('omits attemptCount when it is 1 or less, and omits absent fields', () => {
    expect(metadataItems({ id: 'a', label: 'A', status: 'pending', attemptCount: 1 })).toEqual([]);
  });
});

describe('labels', () => {
  test('actionsCountLabel pluralizes', () => {
    expect(actionsCountLabel(1)).toBe('1 action');
    expect(actionsCountLabel(4)).toBe('4 actions');
  });

  test('hiddenNestedStepLabel pluralizes', () => {
    expect(hiddenNestedStepLabel(1)).toBe('1 nested step hidden');
    expect(hiddenNestedStepLabel(5)).toBe('5 nested steps hidden');
  });
});

describe('branch lane outcomes', () => {
  test('laneOutcomeLabel covers won / lost / settled', () => {
    expect(laneOutcomeLabel('won')).toBe('Won');
    expect(laneOutcomeLabel('lost')).toBe('Lost');
    expect(laneOutcomeLabel('settled')).toBe('Settled');
  });

  test('laneOutcomeBadgeVariant covers won / lost / settled', () => {
    expect(laneOutcomeBadgeVariant('won')).toBe('success');
    expect(laneOutcomeBadgeVariant('lost')).toBe('neutral');
    expect(laneOutcomeBadgeVariant('settled')).toBe('info');
  });

  const lane = (outcome: RunStepBranchLane['outcome']): RunStepBranchLane => ({
    id: outcome ?? 'racing',
    steps: [],
    ...(outcome ? { outcome } : {}),
  });

  test('branchOutcomeSummary summarizes mixed outcomes', () => {
    expect(branchOutcomeSummary([lane('won'), lane('lost'), lane('lost')])).toBe('1 won, 2 lost');
    expect(branchOutcomeSummary([lane('settled'), lane('settled')])).toBe('2 settled');
    expect(branchOutcomeSummary([lane(undefined)])).toBe('1 lane racing');
    expect(branchOutcomeSummary([lane(undefined), lane(undefined)])).toBe('2 lanes racing');
    expect(branchOutcomeSummary([lane('won'), lane(undefined)])).toBe('1 won, 1 lane racing');
    expect(branchOutcomeSummary([])).toBe('No lanes');
  });
});

describe('branchGroupHasCurrentStep', () => {
  test('detects an in-flight step in any lane, including nested children', () => {
    expect(
      branchGroupHasCurrentStep({
        kind: 'branch',
        id: 'g',
        label: 'G',
        lanes: [
          { id: 'a', steps: [{ id: 'a1', label: 'A', status: 'succeeded' }] },
          {
            id: 'b',
            steps: [
              {
                id: 'b1',
                label: 'B',
                status: 'succeeded',
                children: [{ id: 'b1a', label: 'B1a', status: 'running' }],
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  test('returns false when every lane step is terminal', () => {
    expect(
      branchGroupHasCurrentStep({
        kind: 'branch',
        id: 'g',
        label: 'G',
        lanes: [
          { id: 'a', steps: [{ id: 'a1', label: 'A', status: 'succeeded' }] },
          { id: 'b', steps: [{ id: 'b1', label: 'B', status: 'failed' }] },
        ],
      }),
    ).toBe(false);
  });
});

describe('branchStartsCollapsed', () => {
  test('an explicit collapsed flag wins over the threshold', () => {
    expect(branchStartsCollapsed(1, undefined, true)).toBe(true);
    expect(branchStartsCollapsed(9, undefined, false)).toBe(false);
  });

  test('collapses once the lane count reaches the threshold (default 3)', () => {
    expect(branchStartsCollapsed(2, undefined, undefined)).toBe(false);
    expect(branchStartsCollapsed(3, undefined, undefined)).toBe(true);
    expect(branchStartsCollapsed(4, 5, undefined)).toBe(false);
    expect(branchStartsCollapsed(5, 5, undefined)).toBe(true);
  });
});

describe('safeStepLinkHref', () => {
  test('accepts http(s) absolute URLs and relative paths', () => {
    expect(safeStepLinkHref('https://example.com/x')).toBe('https://example.com/x');
    expect(safeStepLinkHref('http://example.com')).toBe('http://example.com');
    expect(safeStepLinkHref('/runs/123')).toBe('/runs/123');
    expect(safeStepLinkHref('  /runs/123  ')).toBe('/runs/123');
  });

  test('rejects empty, control-char, backslash, and protocol-relative hrefs', () => {
    expect(safeStepLinkHref('')).toBeUndefined();
    expect(safeStepLinkHref('   ')).toBeUndefined();
    expect(safeStepLinkHref('/runs\u0001id')).toBeUndefined(); // control character
    expect(safeStepLinkHref('back\\slash')).toBeUndefined();
    expect(safeStepLinkHref('//evil.example.com')).toBeUndefined();
  });

  test('rejects non-http(s) schemes', () => {
    expect(safeStepLinkHref('javascript:alert(1)')).toBeUndefined();
    expect(safeStepLinkHref('mailto:a@b.com')).toBeUndefined();
  });

  test('rejects a scheme-shaped href that is not a parseable URL', () => {
    // Matches the scheme regex but `new URL()` throws → the catch path.
    expect(safeStepLinkHref('http://')).toBeUndefined();
  });
});
