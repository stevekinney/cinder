/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { reconnectedBoundaryKey, streamEventKey } from './event-stream-viewer-keys.ts';
import type { EventStreamEntry, StreamEvent } from './event-stream-viewer.types.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: EventStreamViewer } = await import('./event-stream-viewer.svelte');

const baseEvent: StreamEvent = {
  id: 'evt-1',
  datetime: '2026-05-12T14:30:00Z',
  timestamp: '14:30:00',
  severity: 'info',
  source: 'worker-1',
  summary: 'Activity completed successfully',
};

const errorEvent: StreamEvent = {
  id: 'evt-2',
  datetime: '2026-05-12T14:31:00Z',
  timestamp: '14:31:00',
  severity: 'error',
  source: 'worker-1',
  summary: 'Activity failed with unhandled exception',
  details: { code: 'ERR_TIMEOUT', retries: 3 },
};

const warningEvent: StreamEvent = {
  id: 'evt-3',
  datetime: '2026-05-12T14:32:00Z',
  timestamp: '14:32:00',
  severity: 'warning',
  summary: 'Retry attempt 2 of 3',
};

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

describe('EventStreamViewer', () => {
  describe('structure', () => {
    test('renders root element with cinder-event-stream-viewer class', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      const root = container.querySelector('.cinder-event-stream-viewer');
      expect(root).not.toBeNull();
      expect(root?.tagName).toBe('DIV');
    });

    test('renders a log region with the default label', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      const log = container.querySelector('[role="log"]');
      expect(log).not.toBeNull();
      expect(log?.getAttribute('aria-label')).toBe('Event stream');
    });

    test('renders a log region with a custom label', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], label: 'Workflow run events' },
      });
      const log = container.querySelector('[role="log"]');
      expect(log?.getAttribute('aria-label')).toBe('Workflow run events');
    });

    test('renders toolbar with group role', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      const toolbar = container.querySelector('[role="group"]');
      expect(toolbar).not.toBeNull();
      expect(toolbar?.getAttribute('aria-label')).toBe('Stream controls');
    });

    test('merges class prop with cinder-event-stream-viewer', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], class: 'custom-class' },
      });
      const root = container.querySelector('.cinder-event-stream-viewer');
      expect(root?.classList.contains('cinder-event-stream-viewer')).toBe(true);
      expect(root?.classList.contains('custom-class')).toBe(true);
    });

    test('rest attributes pass through to the root element', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], id: 'my-viewer', 'data-testid': 'stream' },
      });
      const root = container.querySelector('.cinder-event-stream-viewer');
      expect(root?.getAttribute('id')).toBe('my-viewer');
      expect(root?.getAttribute('data-testid')).toBe('stream');
    });
  });

  describe('event rendering', () => {
    test('accepts existing usage with an array typed as StreamEvent[]', () => {
      const legacyEvents: StreamEvent[] = [baseEvent, warningEvent];
      const { container } = render(EventStreamViewer, {
        props: { events: legacyEvents },
      });
      const items = container.querySelectorAll('.cinder-event-stream-viewer__event');
      expect(items.length).toBe(2);
      expect(container.textContent).toContain('Activity completed successfully');
      expect(container.querySelector('.cinder-event-stream-viewer__boundary-marker')).toBeNull();
      expect(
        container.querySelector('.cinder-event-stream-viewer__sequence-gap-marker'),
      ).toBeNull();
    });

    test('renders event list items', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent, warningEvent] },
      });
      const items = container.querySelectorAll('.cinder-event-stream-viewer__event');
      expect(items.length).toBe(2);
    });

    test('renders event summary text', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      const summary = container.querySelector('.cinder-event-stream-viewer__event-summary');
      expect(summary?.textContent).toContain('Activity completed successfully');
    });

    test('renders timestamp inside a <time> element with datetime attribute', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      const time = container.querySelector('time.cinder-event-stream-viewer__event-time');
      expect(time).not.toBeNull();
      expect(time?.getAttribute('datetime')).toBe('2026-05-12T14:30:00Z');
      expect(time?.textContent).toContain('14:30:00');
    });

    test('falls back to datetime when timestamp is omitted', () => {
      const eventWithoutTimestamp: StreamEvent = {
        id: 'no-ts',
        datetime: '2026-05-12T15:00:00Z',
        summary: 'Event without timestamp',
      };
      const { container } = render(EventStreamViewer, {
        props: { events: [eventWithoutTimestamp] },
      });
      const time = container.querySelector('time');
      expect(time?.textContent?.trim()).toBe('2026-05-12T15:00:00Z');
    });

    test('renders severity badge when present', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      const severity = container.querySelector('.cinder-event-stream-viewer__event-severity');
      expect(severity).not.toBeNull();
      expect(severity?.textContent).toContain('info');
    });

    test('omits severity badge when severity is not provided', () => {
      const eventNoSeverity: StreamEvent = {
        id: 'no-sev',
        datetime: '2026-05-12T14:30:00Z',
        summary: 'Plain',
      };
      const { container } = render(EventStreamViewer, { props: { events: [eventNoSeverity] } });
      expect(container.querySelector('.cinder-event-stream-viewer__event-severity')).toBeNull();
    });

    test('renders source label when present', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      const source = container.querySelector('.cinder-event-stream-viewer__event-source');
      expect(source?.textContent?.trim()).toBe('worker-1');
    });

    test('sets data-cinder-severity attribute on event entry', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent, errorEvent] },
      });
      const items = container.querySelectorAll<HTMLElement>('.cinder-event-stream-viewer__event');
      expect(items[0]?.getAttribute('data-cinder-severity')).toBe('info');
      expect(items[1]?.getAttribute('data-cinder-severity')).toBe('error');
    });

    test('defaults data-cinder-severity to info when severity is omitted', () => {
      const eventNoSeverity: StreamEvent = {
        id: 'x',
        datetime: '2026-05-12T14:30:00Z',
        summary: 'Plain',
      };
      const { container } = render(EventStreamViewer, { props: { events: [eventNoSeverity] } });
      const item = container.querySelector<HTMLElement>('.cinder-event-stream-viewer__event');
      expect(item?.getAttribute('data-cinder-severity')).toBe('info');
    });

    test('renders a copy button per event', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent, warningEvent] },
      });
      const copyButtons = container.querySelectorAll(
        '.cinder-event-stream-viewer__copy-event-button',
      );
      expect(copyButtons.length).toBe(2);
    });

    test('copy event button has accessible aria-label', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      const copyBtn = container.querySelector('.cinder-event-stream-viewer__copy-event-button');
      expect(copyBtn?.getAttribute('aria-label')).toContain('Activity completed successfully');
    });

    test('reconnect boundary renders labeled divider with replayed count', () => {
      const entries: EventStreamEntry[] = [
        { ...baseEvent, id: 'evt-1', sequence: 1 },
        {
          id: 'reconnect-1',
          kind: 'reconnected',
          timestamp: '14:30:10',
          replayedCount: 2,
        },
        { ...warningEvent, id: 'evt-2', sequence: 2 },
      ];
      const { container } = render(EventStreamViewer, {
        props: { events: entries },
      });
      const marker = container.querySelector(
        '.cinder-event-stream-viewer__boundary-marker [role="separator"]',
      );
      expect(marker).not.toBeNull();
      expect(marker?.getAttribute('aria-label')).toBe('Reconnected — 2 events replayed');
      expect(marker?.textContent).toContain('Reconnected — 2 events replayed');
    });

    test('reconnect boundary timestamp is exposed as machine-readable time when datetime is omitted', () => {
      const entries: EventStreamEntry[] = [
        {
          id: 'reconnect-1',
          kind: 'reconnected',
          timestamp: '14:30:10',
          replayedCount: 2,
        },
      ];
      const { container } = render(EventStreamViewer, {
        props: { events: entries },
      });
      const time = container.querySelector<HTMLTimeElement>(
        '.cinder-event-stream-viewer__marker-time',
      );

      expect(time?.textContent?.trim()).toBe('14:30:10');
      expect(time?.getAttribute('datetime')).toBe('14:30:10');
      expect(time?.getAttribute('title')).toBe('14:30:10');
    });

    test('non-contiguous sequence renders distinct accessible gap marker', () => {
      const entries: EventStreamEntry[] = [
        { ...baseEvent, id: 'evt-1', sequence: 7 },
        { ...warningEvent, id: 'evt-2', sequence: 10 },
      ];
      const { container } = render(EventStreamViewer, {
        props: { events: entries },
      });
      const marker = container.querySelector(
        '.cinder-event-stream-viewer__sequence-gap-marker [role="note"]',
      );
      expect(marker).not.toBeNull();
      expect(marker?.getAttribute('aria-label')).toBe('Sequence gap — expected 8, received 10');
      expect(marker?.textContent).toContain('Sequence gap — expected 8, received 10');
    });

    test('filtered subsets do not synthesize sequence gaps from omitted events', () => {
      const entries: EventStreamEntry[] = [
        { ...baseEvent, id: 'evt-1', sequence: 7 },
        { ...warningEvent, id: 'evt-2', sequence: 10 },
      ];
      const { container } = render(EventStreamViewer, {
        props: {
          events: entries,
          onfilter: () => {},
          filterQuery: 'retry',
        },
      });

      expect(
        container.querySelector('.cinder-event-stream-viewer__sequence-gap-marker'),
      ).toBeNull();
    });
  });

  describe('details expansion', () => {
    test('does not render details toggle when event has no details', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      expect(container.querySelector('.cinder-event-stream-viewer__details-toggle')).toBeNull();
    });

    test('renders details toggle when event has details', () => {
      const { container } = render(EventStreamViewer, { props: { events: [errorEvent] } });
      const toggle = container.querySelector('.cinder-event-stream-viewer__details-toggle');
      expect(toggle).not.toBeNull();
      expect(toggle?.textContent).toContain('Show details');
    });

    test('details toggle starts with aria-expanded="false"', () => {
      const { container } = render(EventStreamViewer, { props: { events: [errorEvent] } });
      const toggle = container.querySelector('.cinder-event-stream-viewer__details-toggle');
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    });

    test('clicking details toggle expands the JSON details panel', async () => {
      const { container } = render(EventStreamViewer, { props: { events: [errorEvent] } });
      const toggle = container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__details-toggle',
      );
      expect(toggle).not.toBeNull();
      await fireEvent.click(toggle!);
      expect(toggle?.getAttribute('aria-expanded')).toBe('true');
      expect(toggle?.textContent).toContain('Hide details');
      const panel = container.querySelector('.cinder-event-stream-viewer__event-details');
      expect(panel).not.toBeNull();
    });

    test('clicking details toggle again collapses the panel', async () => {
      const { container } = render(EventStreamViewer, { props: { events: [errorEvent] } });
      const toggle = container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__details-toggle',
      );
      await fireEvent.click(toggle!);
      await fireEvent.click(toggle!);
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
      expect(
        container
          .querySelector('.cinder-event-stream-viewer__event-details')
          ?.hasAttribute('hidden'),
      ).toBe(true);
    });

    test('details toggle always controls the mounted details panel', async () => {
      const { container } = render(EventStreamViewer, { props: { events: [errorEvent] } });
      const toggle = container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__details-toggle',
      );
      const controls = toggle?.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      const panel = container.querySelector(`#${controls}`);
      expect(panel).not.toBeNull();
      expect(panel?.hasAttribute('hidden')).toBe(true);
      await fireEvent.click(toggle!);
      expect(panel?.hasAttribute('hidden')).toBe(false);
    });

    test('details panel id is namespaced by the instance, not the raw event id', async () => {
      // Regression: DOM ids used to embed the consumer-supplied event id
      // directly, so ids with spaces/punctuation or duplicates across composed
      // viewers produced invalid or colliding `id`/`aria-controls`. The id must
      // be derived from the component instance + row index instead.
      const dirtyEvent = {
        ...errorEvent,
        id: 'evt with spaces & punctuation!',
      };
      const { container } = render(EventStreamViewer, { props: { events: [dirtyEvent] } });
      const toggle = container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__details-toggle',
      );
      await fireEvent.click(toggle!);
      const controls = toggle?.getAttribute('aria-controls') ?? '';
      // The raw, unsafe id must not appear in the DOM id.
      expect(controls).not.toContain('evt with spaces');
      expect(controls).not.toContain(' ');
      // aria-controls still resolves to a real panel (use an attribute selector
      // because the namespaced id is safe but not necessarily a valid CSS ident
      // for `#...` selectors).
      const panel = container.querySelector(`[id="${controls}"]`);
      expect(panel).not.toBeNull();
    });

    test('two viewers with the same event id produce distinct details panel ids', async () => {
      // Regression: composed viewers used to collide because the DOM id embedded
      // the (possibly shared) event id. Each instance's $props.id() namespace
      // must keep their aria-controls / panel ids distinct.
      const shared = { ...errorEvent, id: 'logs' };
      const first = render(EventStreamViewer, { props: { events: [shared] } });
      const second = render(EventStreamViewer, { props: { events: [shared] } });
      const firstToggle = first.container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__details-toggle',
      );
      const secondToggle = second.container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__details-toggle',
      );
      await fireEvent.click(firstToggle!);
      await fireEvent.click(secondToggle!);
      const firstControls = firstToggle?.getAttribute('aria-controls');
      const secondControls = secondToggle?.getAttribute('aria-controls');
      expect(firstControls).toBeTruthy();
      expect(secondControls).toBeTruthy();
      expect(firstControls).not.toBe(secondControls);
    });

    test('duplicate event ids expand only the selected row details', async () => {
      const replayedEvents: StreamEvent[] = [
        {
          ...errorEvent,
          id: 'replayed-id',
          summary: 'Original event',
          details: { replay: false },
        },
        {
          ...errorEvent,
          id: 'replayed-id',
          summary: 'Replayed event',
          details: { replay: true },
        },
      ];
      const { container } = render(EventStreamViewer, { props: { events: replayedEvents } });
      const toggles = Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '.cinder-event-stream-viewer__details-toggle',
        ),
      );

      expect(toggles).toHaveLength(2);
      await fireEvent.click(toggles[0]!);

      expect(toggles[0]?.getAttribute('aria-expanded')).toBe('true');
      expect(toggles[1]?.getAttribute('aria-expanded')).toBe('false');

      const firstPanel = container.querySelector(
        `[id="${toggles[0]?.getAttribute('aria-controls')}"]`,
      );
      const secondPanel = container.querySelector(
        `[id="${toggles[1]?.getAttribute('aria-controls')}"]`,
      );
      expect(firstPanel?.hasAttribute('hidden')).toBe(false);
      expect(secondPanel?.hasAttribute('hidden')).toBe(true);
    });

    test('event and reconnect boundary keys do not depend on source index', () => {
      const firstEvent: StreamEvent = {
        ...baseEvent,
        id: 'event-1',
        sequence: 1,
        summary: 'First event',
        details: { index: 1 },
      };
      const retainedEvent: StreamEvent = {
        ...errorEvent,
        id: 'event-2',
        sequence: 2,
        summary: 'Retained event',
        details: { index: 2 },
      };
      const nextEvent: StreamEvent = {
        ...warningEvent,
        id: 'event-3',
        sequence: 3,
        summary: 'Next event',
        details: { index: 3 },
      };

      const firstWindowKeys = [firstEvent, retainedEvent].map(streamEventKey);
      const retainedWindowKeys = [retainedEvent, nextEvent].map(streamEventKey);

      expect(firstWindowKeys[1]).toBe(retainedWindowKeys[0]);
      expect(retainedWindowKeys[0]).toBe(
        'event|id=event-2|sequence=2|datetime=2026-05-12T14:31:00Z|timestamp=14:31:00|summary=Retained event',
      );

      expect(
        reconnectedBoundaryKey({
          id: 'reconnect-1',
          kind: 'reconnected',
          timestamp: '14:31:10',
          replayedCount: 2,
        }),
      ).toBe('reconnected|id=reconnect-1|datetime=|timestamp=14:31:10|replayed=2');
    });
  });

  describe('states', () => {
    test('renders loading state with skeleton placeholders', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], loading: true },
      });
      expect(container.querySelector('.cinder-event-stream-viewer__loading')).not.toBeNull();
      const skeletons = container.querySelectorAll('.cinder-event-stream-viewer__skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
      // Event list should not render while loading
      expect(container.querySelector('.cinder-event-stream-viewer__list')).toBeNull();
    });

    test('sets data-cinder-loading attribute when loading', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], loading: true },
      });
      const root = container.querySelector('.cinder-event-stream-viewer');
      expect(root?.hasAttribute('data-cinder-loading')).toBe(true);
    });

    test('renders empty state when events array is empty and not loading', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      const empty = container.querySelector('.cinder-event-stream-viewer__empty');
      expect(empty).not.toBeNull();
      expect(empty?.textContent).toContain('No events to display');
    });

    test('sets data-cinder-empty attribute when empty', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      const root = container.querySelector('.cinder-event-stream-viewer');
      expect(root?.hasAttribute('data-cinder-empty')).toBe(true);
    });

    test('does not render empty state when events exist', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      expect(container.querySelector('.cinder-event-stream-viewer__empty')).toBeNull();
    });

    test('renders truncation notice when truncated is true', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent], truncated: true },
      });
      const notice = container.querySelector('.cinder-event-stream-viewer__truncation-notice');
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain('truncated');
    });

    test('does not render truncation notice when truncated is false', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent], truncated: false },
      });
      expect(container.querySelector('.cinder-event-stream-viewer__truncation-notice')).toBeNull();
    });
  });

  describe('connection indicator', () => {
    test('renders ConnectionIndicator when connectionState is provided', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], connectionState: 'connected' },
      });
      expect(container.querySelector('.cinder-connection-indicator')).not.toBeNull();
    });

    test('does not render ConnectionIndicator when connectionState is omitted', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      expect(container.querySelector('.cinder-connection-indicator')).toBeNull();
    });

    test('passes connection state to the indicator', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], connectionState: 'disconnected' },
      });
      const indicator = container.querySelector('.cinder-connection-indicator');
      expect(indicator?.getAttribute('data-cinder-state')).toBe('disconnected');
    });
  });

  describe('filter input', () => {
    test('renders filter input when onfilter callback is provided', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], onfilter: () => {} },
      });
      const input = container.querySelector<HTMLInputElement>(
        '.cinder-event-stream-viewer__filter-input',
      );
      expect(input).not.toBeNull();
      expect(input?.getAttribute('aria-label')).toBe('Filter events');
    });

    test('does not render filter input when onfilter is omitted', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      expect(container.querySelector('.cinder-event-stream-viewer__filter-input')).toBeNull();
    });

    test('filter input reflects filterQuery prop', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], onfilter: () => {}, filterQuery: 'error' },
      });
      const input = container.querySelector<HTMLInputElement>(
        '.cinder-event-stream-viewer__filter-input',
      );
      expect(input?.value).toBe('error');
    });
  });

  describe('copy visible', () => {
    test('renders copy-visible button when oncopyvisible is provided', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent], oncopyvisible: () => {} },
      });
      const btn = container.querySelector('.cinder-event-stream-viewer__copy-all-button');
      expect(btn).not.toBeNull();
    });

    test('does not render copy-visible button when oncopyvisible is omitted', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent] },
      });
      const btn = container.querySelector('.cinder-event-stream-viewer__copy-all-button');
      expect(btn).toBeNull();
    });

    test('copy-visible button is disabled when events array is empty', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], oncopyvisible: () => {} },
      });
      const btn = container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__copy-all-button',
      );
      expect(btn?.disabled).toBe(true);
    });

    test('clicking copy-visible calls oncopyvisible with formatted text', async () => {
      let received = '';
      const { container } = render(EventStreamViewer, {
        props: {
          events: [baseEvent],
          oncopyvisible: (text: string) => {
            received = text;
          },
        },
      });
      const btn = container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__copy-all-button',
      );
      await fireEvent.click(btn!);
      expect(received).toContain('Activity completed successfully');
    });

    test('copy-visible announcement does not claim clipboard success', async () => {
      const { container } = render(EventStreamViewer, {
        props: {
          events: [baseEvent],
          oncopyvisible: () => {},
        },
      });
      const btn = container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__copy-all-button',
      );
      await fireEvent.click(btn!);
      const liveRegion = container.querySelector('.cinder-event-stream-viewer__live-region');
      expect(liveRegion?.textContent).toBe('1 event sent to copy handler');
      expect(liveRegion?.textContent).not.toContain('clipboard');
    });

    test('copy-visible text includes reconnect and sequence gap markers', async () => {
      let received = '';
      const entries: EventStreamEntry[] = [
        { ...baseEvent, id: 'evt-1', sequence: 1 },
        {
          id: 'reconnect-1',
          kind: 'reconnected',
          timestamp: '14:30:05',
          replayedCount: 1,
        },
        { ...warningEvent, id: 'evt-2', sequence: 4 },
      ];
      const { container } = render(EventStreamViewer, {
        props: {
          events: entries,
          oncopyvisible: (text: string) => {
            received = text;
          },
        },
      });
      const btn = container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__copy-all-button',
      );
      await fireEvent.click(btn!);
      expect(received).toContain('Reconnected — 1 event replayed');
      expect(received).toContain('Sequence gap — expected 2, received 4');
      expect(received).toContain('Retry attempt 2 of 3');
    });
  });

  describe('follow-latest', () => {
    test('does not render resume button when followLatest is true', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent], followLatest: true },
      });
      expect(container.querySelector('.cinder-event-stream-viewer__resume-button')).toBeNull();
    });

    test('does not render resume button when followLatest is not provided (defaults true)', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      expect(container.querySelector('.cinder-event-stream-viewer__resume-button')).toBeNull();
    });

    test('renders resume button when followLatest is false', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent], followLatest: false },
      });
      const btn = container.querySelector('.cinder-event-stream-viewer__resume-button');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toContain('Resume following');
    });

    test('sets data-cinder-paused attribute when followLatest is false', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent], followLatest: false },
      });
      const root = container.querySelector('.cinder-event-stream-viewer');
      expect(root?.hasAttribute('data-cinder-paused')).toBe(true);
    });

    test('no data-cinder-paused attribute when followLatest is true', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent], followLatest: true },
      });
      const root = container.querySelector('.cinder-event-stream-viewer');
      expect(root?.hasAttribute('data-cinder-paused')).toBe(false);
    });

    test('scrolls when a fixed-size stream replaces the tail event', async () => {
      const firstEvent = { ...baseEvent, id: 'event-1', summary: 'First event' };
      const secondEvent = { ...baseEvent, id: 'event-2', summary: 'Second event' };
      const thirdEvent = { ...baseEvent, id: 'event-3', summary: 'Third event' };
      const { container, rerender } = render(EventStreamViewer, {
        props: { events: [firstEvent, secondEvent], followLatest: true },
      });
      const viewport = container.querySelector<HTMLElement>(
        '.cinder-event-stream-viewer__viewport',
      );
      if (!viewport) throw new Error('No event viewport found');

      Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 400 });
      viewport.scrollTop = 0;

      await rerender({ events: [secondEvent, thirdEvent], followLatest: true });

      expect(viewport.scrollTop).toBe(400);
    });
  });

  describe('accessibility', () => {
    test('log region relies on role="log" implicit live semantics', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      const log = container.querySelector('[role="log"]');
      expect(log?.getAttribute('aria-live')).toBeNull();
      expect(log?.getAttribute('aria-atomic')).toBeNull();
    });

    test('log region is keyboard focusable (tabindex=0)', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      const log = container.querySelector('[role="log"]');
      expect(log?.getAttribute('tabindex')).toBe('0');
    });

    test('loading region has accessible aria-label', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], loading: true },
      });
      const loading = container.querySelector('.cinder-event-stream-viewer__loading');
      expect(loading?.getAttribute('aria-label')).toBe('Loading events');
    });

    test('empty state has role=status', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      const empty = container.querySelector('.cinder-event-stream-viewer__empty');
      expect(empty?.getAttribute('role')).toBe('status');
    });

    test('truncation notice has role=status with aria-live=polite', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [baseEvent], truncated: true },
      });
      const notice = container.querySelector('.cinder-event-stream-viewer__truncation-notice');
      expect(notice?.getAttribute('role')).toBe('status');
      expect(notice?.getAttribute('aria-live')).toBe('polite');
    });

    test('skeleton placeholders are aria-hidden', () => {
      const { container } = render(EventStreamViewer, {
        props: { events: [], loading: true },
      });
      const skeletons = container.querySelectorAll('.cinder-event-stream-viewer__skeleton');
      for (const skeleton of skeletons) {
        expect(skeleton.getAttribute('aria-hidden')).toBe('true');
      }
    });

    test('severity badge has accessible aria-label', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      const severity = container.querySelector('.cinder-event-stream-viewer__event-severity');
      expect(severity?.getAttribute('aria-label')).toBe('Severity: info');
    });

    test('event time has machine-readable datetime attribute', () => {
      const { container } = render(EventStreamViewer, { props: { events: [baseEvent] } });
      const time = container.querySelector('time');
      expect(time?.getAttribute('datetime')).toBe('2026-05-12T14:30:00Z');
    });

    test('live region is always in DOM even with no message', () => {
      const { container } = render(EventStreamViewer, { props: { events: [] } });
      const liveRegion = container.querySelector('.cinder-event-stream-viewer__live-region');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion?.getAttribute('role')).toBe('status');
      expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
      expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
    });

    test('details toggle has aria-expanded and controls only when expanded', async () => {
      const { container } = render(EventStreamViewer, { props: { events: [errorEvent] } });
      const toggle = container.querySelector<HTMLButtonElement>(
        '.cinder-event-stream-viewer__details-toggle',
      );
      expect(toggle?.getAttribute('aria-expanded')).not.toBeNull();
      expect(toggle?.getAttribute('aria-controls')).not.toBeNull();
      await fireEvent.click(toggle!);
      expect(toggle?.getAttribute('aria-controls')).not.toBeNull();
    });
  });

  describe('CSS snapshot', () => {
    test('CSS file exists and contains cinder-event-stream-viewer class', () => {
      const { readFileSync } = require('node:fs');
      const css = readFileSync(
        new URL('./event-stream-viewer.css', import.meta.url).pathname,
        'utf8',
      );
      expect(css).toContain('cinder-event-stream-viewer');
    });

    test('CSS file has @layer cinder.components wrapper', () => {
      const { readFileSync } = require('node:fs');
      const css = readFileSync(
        new URL('./event-stream-viewer.css', import.meta.url).pathname,
        'utf8',
      );
      expect(css).toContain('@layer cinder.components');
    });

    test('CSS file has four-layer order declaration', () => {
      const { readFileSync } = require('node:fs');
      const css = readFileSync(
        new URL('./event-stream-viewer.css', import.meta.url).pathname,
        'utf8',
      );
      expect(css).toContain(
        '@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities',
      );
    });
  });
});
