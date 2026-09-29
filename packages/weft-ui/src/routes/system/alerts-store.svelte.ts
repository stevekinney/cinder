/**
 * Session-scoped alert/warning collection for the Alerts view (plan §9.7
 * T7.6; design `Weft New Surfaces.dc.html` §D). Ingests exactly the fleet
 * event kinds the plan names — `alert:fired`/`alert:resolved`/
 * `constraint:violated` plus the four operational-warning kinds
 * (`checkpoint:size-warning`/`development:warning`/`cleanup:warning`/
 * `storage:size-reported`) — into a flat, newest-first event log.
 *
 * **"Since page load", never persistent** (design §D copy, plan §9.7's
 * caveat): this class holds state only for the lifetime of the `System`
 * route's mounted component; nothing is written to storage. See
 * `alerts-tab.svelte`'s module doc for why it opens its OWN `FleetEventSource`
 * connection rather than reusing the shell's shared one.
 *
 * A flat log (not a de-duplicated "current alerts" table) matches the design
 * reference's row shape (one row per event, a "Details" link, a per-row
 * timestamp) — this is a log of alert *events*, not a live alert-manager
 * snapshot (weft's alert manager has no list/query operation to snapshot
 * from; see plan §14.1 item 5). An `alert:resolved` event both appends its
 * own row AND retroactively dims the most recent still-firing row for the
 * same alert `name`, so a resolved alert reads as resolved wherever it
 * appears in the log.
 */
import type { FleetEventFrame } from '../../lib/live-source/fleet-event-source.svelte.ts';

export type AlertRowState = 'firing' | 'resolved' | 'warning';

export interface AlertRow {
  readonly id: string;
  readonly kind: string;
  readonly name: string | undefined;
  readonly workflowId: string | undefined;
  readonly title: string;
  readonly body: string;
  state: AlertRowState;
  readonly emittedAtMs: number;
}

const ALERT_EVENT_KINDS: ReadonlySet<string> = new Set([
  'alert:fired',
  'alert:resolved',
  'constraint:violated',
  'checkpoint:size-warning',
  'development:warning',
  'cleanup:warning',
  'storage:size-reported',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(payload: unknown, key: string): string | undefined {
  if (!isRecord(payload)) return undefined;
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function truncateId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

interface AlertRule {
  readonly state: AlertRowState;
  readonly title: (frame: FleetEventFrame) => string;
  readonly body: (frame: FleetEventFrame) => string;
}

const ALERT_RULES: Readonly<Record<string, AlertRule>> = {
  'alert:fired': {
    state: 'firing',
    title: (frame) => `Alert fired · ${stringField(frame.payload, 'name') ?? 'unnamed'}`,
    body: (frame) => stringField(frame.payload, 'message') ?? 'An alert condition is firing.',
  },
  'alert:resolved': {
    state: 'resolved',
    title: (frame) => `Alert resolved · ${stringField(frame.payload, 'name') ?? 'unnamed'}`,
    body: (frame) => stringField(frame.payload, 'message') ?? 'This alert has resolved.',
  },
  'constraint:violated': {
    state: 'firing',
    title: (frame) =>
      `Constraint violated · ${stringField(frame.payload, 'constraint') ?? 'unnamed'}`,
    body: (frame) =>
      frame.workflowId
        ? `Workflow ${truncateId(frame.workflowId)} exceeded a configured constraint.`
        : 'A workflow exceeded a configured constraint.',
  },
  'checkpoint:size-warning': {
    state: 'warning',
    title: () => 'Checkpoint size warning',
    body: (frame) =>
      stringField(frame.payload, 'message') ?? 'A checkpoint is approaching the size limit.',
  },
  'development:warning': {
    state: 'warning',
    title: () => 'Development warning',
    body: (frame) =>
      stringField(frame.payload, 'message') ?? 'A development-mode diagnostic fired.',
  },
  'cleanup:warning': {
    state: 'warning',
    title: () => 'Cleanup warning',
    body: (frame) =>
      stringField(frame.payload, 'message') ?? 'A retention cleanup pass reported a warning.',
  },
  'storage:size-reported': {
    state: 'warning',
    title: () => 'Storage size warning',
    body: (frame) =>
      stringField(frame.payload, 'message') ?? 'Storage usage crossed a reporting threshold.',
  },
};

/** `true` when `frame.kind` is one of the seven kinds this view tracks — the filter `alerts-tab.svelte` applies to its `FleetEventSource` subscription. */
export function isAlertEventKind(kind: string): boolean {
  return ALERT_EVENT_KINDS.has(kind);
}

const ALERT_HISTORY_LIMIT = 200;

export class AlertsStore {
  rows: AlertRow[] = $state([]);

  get isEmpty(): boolean {
    return this.rows.length === 0;
  }

  /** Ingests one fleet frame. No-op for a kind this view doesn't track. Returns the appended row, or `null`. */
  ingest(frame: FleetEventFrame): AlertRow | null {
    const rule = ALERT_RULES[frame.kind];
    if (!rule) return null;

    const name = stringField(frame.payload, 'name') ?? stringField(frame.payload, 'constraint');
    const row: AlertRow = {
      id: frame.cursor,
      kind: frame.kind,
      name,
      workflowId: frame.workflowId,
      title: rule.title(frame),
      body: rule.body(frame),
      state: rule.state,
      emittedAtMs: frame.emittedAtMs,
    };

    if (frame.kind === 'alert:resolved' && name !== undefined) {
      const stillFiring = this.rows.find(
        (candidate) =>
          candidate.kind === 'alert:fired' &&
          candidate.name === name &&
          candidate.state === 'firing',
      );
      if (stillFiring) stillFiring.state = 'resolved';
    }

    this.rows = [row, ...this.rows].slice(0, ALERT_HISTORY_LIMIT);
    return row;
  }
}
