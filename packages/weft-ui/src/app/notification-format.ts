import type { FleetEventFrame } from '../lib/live-source/fleet-event-source.svelte.ts';
import { workflowDetailPath } from '../lib/router.svelte.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringField(payload: unknown, key: string): string | undefined {
  if (!isRecord(payload)) return undefined;
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

export function numberField(payload: unknown, key: string): number | undefined {
  if (!isRecord(payload)) return undefined;
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Truncates an identifier for readable inline notification copy. */
export function truncateId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function workflowBody(frame: FleetEventFrame, fallback: string): string {
  return frame.workflowId ? `Workflow ${truncateId(frame.workflowId)}` : fallback;
}

export function workflowHref(frame: FleetEventFrame): string {
  return frame.workflowId ? workflowDetailPath(frame.workflowId) : '/workflows';
}
