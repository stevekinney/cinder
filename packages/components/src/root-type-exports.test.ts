import { expect, test } from 'bun:test';

import type {
  EventStreamEntry,
  EventStreamSchemaEntry,
  EventStreamViewerSchemaProps,
  RunStepLink,
  StreamReconnectedBoundary,
} from './index.ts';

test('root barrel exposes Stardust agent-ops public helper types', () => {
  const reconnectBoundary: StreamReconnectedBoundary = {
    id: 'reconnect-1',
    kind: 'reconnected',
    replayedCount: 2,
  };
  const entry = reconnectBoundary satisfies EventStreamEntry;
  const link: RunStepLink = {
    href: '/runs/run-123',
    label: 'Open run',
  };
  const schemaEntry: EventStreamSchemaEntry = {
    id: 'event-1',
    datetime: '2026-06-24T12:00:00.000Z',
    summary: 'Started',
  };
  const schemaProps: EventStreamViewerSchemaProps = {
    events: [schemaEntry],
  };

  expect(entry.kind).toBe('reconnected');
  expect(link.label).toBe('Open run');
  expect(schemaProps.events[0]?.id).toBe('event-1');
});
