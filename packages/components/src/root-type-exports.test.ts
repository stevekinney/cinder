import { expect, test } from 'bun:test';

import type { EventStreamEntry, RunStepLink, StreamReconnectedBoundary } from './index.ts';

test('root barrel exposes Stardust agent-ops public helper types', () => {
  const reconnectBoundary: StreamReconnectedBoundary = {
    id: 'reconnect-1',
    kind: 'reconnected',
    replayedCount: 2,
  };
  const entry: EventStreamEntry = reconnectBoundary;
  const link: RunStepLink = {
    href: '/runs/run-123',
    label: 'Open run',
  };

  expect(entry.kind).toBe('reconnected');
  expect(link.label).toBe('Open run');
});
