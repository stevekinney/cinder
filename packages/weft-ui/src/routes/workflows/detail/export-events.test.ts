import { requireElement } from '../../../../tests/dom-test-support.ts';

import { describe, expect, mock, test } from 'bun:test';

import type { WorkflowEvent, WorkflowTimelineEntry } from '@lostgradient/weft';

import {
  buildEventHistoryExport,
  buildEventsAndTimelineExport,
  downloadJson,
  exportFilename,
} from './export-events.ts';

const events: readonly WorkflowEvent[] = [
  { type: 'workflow:checkpoint', timestamp: 1000, data: { step: 1 } },
];

const timeline: readonly WorkflowTimelineEntry[] = [
  {
    step: 1,
    operationType: 'activity',
    operationLabel: 'chargeCard',
    inputSummary: '{}',
    timestamp: 1000,
    status: 'completed',
  },
];

describe('buildEventHistoryExport', () => {
  test('includes workflow id, an ISO exportedAt, and the events verbatim', () => {
    const result = buildEventHistoryExport('wf_1', events, 1_700_000_000_000);
    expect(result.workflowId).toBe('wf_1');
    expect(result.exportedAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(result.events).toEqual(events);
  });
});

describe('buildEventsAndTimelineExport', () => {
  test('includes events and timeline together', () => {
    const result = buildEventsAndTimelineExport('wf_1', events, timeline, 1_700_000_000_000);
    expect(result.events).toEqual(events);
    expect(result.timeline).toEqual(timeline);
    expect(result.workflowId).toBe('wf_1');
  });
});

describe('exportFilename', () => {
  test('never contains a colon (filesystem-hostile on Windows)', () => {
    expect(exportFilename('wf_1', 'events')).not.toContain(':');
  });

  test('includes the workflow id and export kind', () => {
    const filename = exportFilename('wf_1', 'events-and-timeline');
    expect(filename.startsWith('wf_1-events-and-timeline-')).toBe(true);
    expect(filename.endsWith('.json')).toBe(true);
  });
});

describe('downloadJson', () => {
  test('serializes data into a Blob URL, clicks a download anchor, and revokes the URL', () => {
    const createObjectURL = mock((_blob: Blob) => 'blob:mock-url');
    const revokeObjectURL = mock((_url: string) => undefined);
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const click = mock(() => undefined);
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = click;

    let createdAnchor: HTMLAnchorElement | undefined;
    const originalCreateElement = document.createElement.bind(document);
    const createElement = mock((tagName: string): HTMLElement => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') createdAnchor = requireElement(element, HTMLAnchorElement);
      return element;
    });
    document.createElement = createElement;

    try {
      downloadJson({ hello: 'world' }, 'wf_1-events-2026-01-01T00-00-00.json');

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const [blob] = createObjectURL.mock.calls[0] ?? [];
      // happy-dom normalizes the MIME type by appending a charset — assert
      // the essence rather than the literal string this repo's real
      // browsers wouldn't append either way.
      expect(blob?.type.startsWith('application/json')).toBe(true);

      expect(createdAnchor).not.toBeUndefined();
      expect(createdAnchor?.href).toBe('blob:mock-url');
      expect(createdAnchor?.download).toBe('wf_1-events-2026-01-01T00-00-00.json');
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      HTMLAnchorElement.prototype.click = originalClick;
      document.createElement = originalCreateElement;
    }
  });

  test('revokes the object URL even when the anchor click throws', () => {
    const revokeObjectURL = mock(() => undefined);
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mock(() => 'blob:mock-url');
    URL.revokeObjectURL = revokeObjectURL;

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {
      throw new Error('boom');
    };

    try {
      expect(() => downloadJson({ hello: 'world' }, 'wf_1-events.json')).toThrow('boom');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
});
