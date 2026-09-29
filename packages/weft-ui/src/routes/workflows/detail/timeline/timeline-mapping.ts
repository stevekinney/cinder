/**
 * `WorkflowTimelineEntry[]` (`GET …/timeline`) → Cinder `RunStepTimelineEntry[]`
 * (plan T3.1/T3.2). Trusts the server timeline rather than re-deriving
 * attempts client-side (this repo's CLAUDE.md, plan §9.9 portability caveat).
 *
 * ## What this module can and cannot honestly render
 *
 * Verified against weft v0.11.0 (`src/core/types/state.ts`
 * `WorkflowTimelineEntry`, `src/core/engine/checkpoint-io.ts`
 * `appendTimelineBatchOperations`/`finalizePendingTimelineEntry`, and a live
 * dev-harness curl against the `checkout-coordination` and
 * `trip-booking-saga` fixtures):
 *
 * - **One entry per durable step**, not per attempt. There is no
 *   `attemptCount`, per-attempt error, heartbeat, or retry-policy data
 *   anywhere in `WorkflowTimelineEntry` — a retried activity collapses into
 *   one entry carrying only its FINAL status. `RunStep.attemptCount` is
 *   therefore always left `undefined` here rather than guessed at 1.
 * - **Saga compensation is real, structural data — not a guess.**
 *   `ctx.saga()` (`weft/src/core/context/saga.ts`) names its compensating
 *   activity call literally `` `compensate:${forwardStep.name}` ``, which
 *   becomes the timeline entry's `operationLabel` via
 *   `getTimelineOperationLabel`'s `activityName` case (confirmed live:
 *   `trip-booking-saga`'s timeline has `operationLabel: "compensate:reserveHotel"`
 *   immediately after `"reserveHotel"`). This module reads that
 *   deterministic, engine-established naming convention to set `compensates`
 *   — it is not inferring anything from business data.
 * - **Coordination groups (`ctx.race`/`ctx.all`/`ctx.speculate`) carry bounded
 *   branch detail in the current wire format.** `branches` contains the
 *   operation id, key, label, and outcome for `race`/`all`; `children` and
 *   `speculationOutcome` do the same for `speculate`. This module maps those
 *   fields to Cinder's native branch groups and keeps an opaque step only for
 *   older or incomplete timeline entries.
 * - **No timeline entry exists for finalizer execution at all** — durable
 *   finalizers run on the engine host outside the normal workflow generator
 *   (this repo's CLAUDE.md), so `destroySandbox`-style teardown never
 *   appears in `getTimeline()`. See `workflow-live-observations.svelte.ts`
 *   for the (live-event-only) finalizer strip this track builds instead.
 */
import type { WorkflowTimelineEntry, WorkflowTimelineOperationDetail } from '@lostgradient/weft';

import type {
  RunStep,
  RunStepBranchGroup,
  RunStepBranchLane,
  RunStepBranchLaneOutcome,
  RunStepDetail,
  RunStepStatus,
  RunStepTimelineEntry,
} from '@lostgradient/cinder';

import { formatDuration } from '../../../../lib/format/index.ts';
import { timelineStepStatus } from './timeline-step-state.ts';

const COMPENSATE_PREFIX = 'compensate:';

/** Structural operation types with no single "name" field — displayed by kind, not by `operationLabel` (which just repeats `operationType` for these). */
const STRUCTURAL_OPERATION_LABEL: Readonly<Record<string, string>> = {
  race: 'Race',
  parallel: 'All (parallel)',
  speculate: 'Speculate',
  sleep: 'Sleep',
  memo: 'Memo',
  offload: 'Offload',
  archive: 'Archive',
  stream: 'Stream',
  'wait-condition': 'Wait for condition',
  'state-read': 'Read state',
  'state-commit': 'Write state',
  'wait-review': 'Human review',
};

/** Operation types whose `operationLabel` (via `getTimelineOperationLabel`) is already a meaningful name. */
const NAMED_OPERATION_PREFIX: Readonly<Record<string, string>> = {
  'wait-signal': 'Signal',
  'wait-update': 'Update',
  'child-workflow': 'Child',
  'get-version': 'Version check',
  load: 'Load',
};

/** Best-effort `{ operationCount: number }` read out of a coordination entry's `inputSummary` JSON. `null` when absent or malformed — never guessed. */
function parseOperationCount(inputSummary: string): number | null {
  try {
    const parsed: unknown = JSON.parse(inputSummary);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'operationCount' in parsed &&
      typeof parsed.operationCount === 'number'
    ) {
      return parsed.operationCount;
    }
  } catch {
    // Not JSON, or not the shape we expect — fall through to `null`.
  }
  return null;
}

/** Display label for one timeline entry (plan T3.1/T3.2 — see module doc for what's real vs. degraded). */
export function timelineEntryLabel(entry: WorkflowTimelineEntry): string {
  if (entry.operationType === 'activity') return entry.operationLabel;

  const namedPrefix = NAMED_OPERATION_PREFIX[entry.operationType];
  if (namedPrefix !== undefined) return `${namedPrefix}: ${entry.operationLabel}`;

  const structuralLabel = STRUCTURAL_OPERATION_LABEL[entry.operationType];
  if (structuralLabel === undefined) return entry.operationLabel;

  const operationCount = parseOperationCount(entry.inputSummary);
  return operationCount === null
    ? structuralLabel
    : `${structuralLabel} · ${operationCount} branches`;
}

function isCoordinationEntry(entry: WorkflowTimelineEntry): boolean {
  return (
    entry.operationType === 'race' ||
    entry.operationType === 'parallel' ||
    entry.operationType === 'speculate'
  );
}

function coordinatorDetails(
  entry: WorkflowTimelineEntry,
): readonly WorkflowTimelineOperationDetail[] | undefined {
  return entry.operationType === 'speculate' ? entry.children : entry.branches;
}

function coordinatorOmittedCount(entry: WorkflowTimelineEntry): number {
  return entry.operationType === 'speculate'
    ? (entry.childrenOmitted ?? 0)
    : (entry.branchesOmitted ?? 0);
}

/** True when a coordination entry has no branch detail to render. */
export function isDegradedCoordinationEntry(entry: WorkflowTimelineEntry): boolean {
  return isCoordinationEntry(entry) && coordinatorDetails(entry) === undefined;
}

/** `compensate:<name>` → the forward step's real name, or `null` when this entry isn't a saga compensation. */
export function compensatedActivityName(entry: WorkflowTimelineEntry): string | null {
  if (entry.operationType !== 'activity') return null;
  if (!entry.operationLabel.startsWith(COMPENSATE_PREFIX)) return null;
  return entry.operationLabel.slice(COMPENSATE_PREFIX.length);
}

/**
 * Resolves each compensating entry's `compensates` id to the LATEST prior
 * (in step order) plain-activity entry sharing the compensated name — a
 * saga's forward call for a given activity is unique per run, so "latest
 * prior match" is unambiguous here, unlike the child-workflow-id case this
 * track deliberately does not guess at.
 */
function resolveCompensationTargets(
  entries: readonly WorkflowTimelineEntry[],
): ReadonlyMap<number, number> {
  const forwardStepByName = new Map<string, number>();
  const compensatesStep = new Map<number, number>();

  for (const entry of entries) {
    const compensatedName = compensatedActivityName(entry);
    if (compensatedName !== null) {
      const forwardStep = forwardStepByName.get(compensatedName);
      if (forwardStep !== undefined) compensatesStep.set(entry.step, forwardStep);
      continue;
    }
    if (entry.operationType === 'activity') forwardStepByName.set(entry.operationLabel, entry.step);
  }

  return compensatesStep;
}

/** The `RunStep.id` this module mints for a given timeline step number — exported so sibling modules (async-activity step matching) mint the identical id rather than duplicating the format. */
export function timelineStepId(step: number): string {
  return `step-${step}`;
}

/**
 * Given a mapped step id back to its timeline step number, or `null` if it
 * isn't one of ours. Handles both a top-level step (`step-N`) and a
 * branch-lane step nested inside a coordination group (`step-N-branch-M`,
 * minted by `mapCoordinatorEntry`). The engine only ever checkpoints at the
 * coordination entry's own step number — see this module's doc and
 * `events-tab.svelte`'s module doc ("the durable per-workflow event log
 * records ONLY `workflow:checkpoint` entries") — a `race`/`all`/`speculate`
 * branch has no checkpoint of its own, so selecting a branch-lane row
 * correctly filters Events to the parent coordination step's checkpoint(s)
 * rather than failing to filter at all.
 */
export function stepNumberFromRunStepId(id: string): number | null {
  const match = /^step-(\d+)(?:-branch-\d+)?$/.exec(id);
  if (match === null) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function buildDetails(entry: WorkflowTimelineEntry): RunStepDetail[] {
  const details: RunStepDetail[] = [
    {
      id: `${timelineStepId(entry.step)}-input`,
      label: 'Input',
      type: 'text',
      content: entry.inputSummary,
    },
  ];

  if (entry.outputSummary !== undefined) {
    details.push({
      id: `${timelineStepId(entry.step)}-output`,
      label: entry.status === 'failed' || entry.status === 'timed-out' ? 'Error' : 'Output',
      type: 'text',
      content: entry.outputSummary,
    });
  }

  if (isDegradedCoordinationEntry(entry)) {
    details.push({
      id: `${timelineStepId(entry.step)}-coordination-note`,
      label: 'About this step',
      type: 'text',
      content: 'The timeline API did not include per-branch detail for this coordinated operation.',
    });
  }

  return details;
}

function branchStepStatus(detail: WorkflowTimelineOperationDetail): RunStepStatus {
  if (detail.outcome === 'rejected' || detail.errorSummary !== undefined) return 'failed';
  return 'succeeded';
}

function branchLaneOutcome(detail: WorkflowTimelineOperationDetail): RunStepBranchLaneOutcome {
  if (detail.outcome === 'won') return 'won';
  if (detail.outcome === 'lost') return 'lost';
  return 'settled';
}

function branchStepDetails(
  entry: WorkflowTimelineEntry,
  detail: WorkflowTimelineOperationDetail,
): RunStepDetail[] {
  const id = `${timelineStepId(entry.step)}-branch-${String(detail.index)}`;
  const details: RunStepDetail[] = [
    { id: `${id}-operation-id`, label: 'Operation ID', type: 'text', content: detail.operationId },
    {
      id: `${id}-operation-type`,
      label: 'Operation type',
      type: 'text',
      content: detail.operationType,
    },
  ];
  if (detail.errorSummary !== undefined) {
    details.push({ id: `${id}-error`, label: 'Error', type: 'text', content: detail.errorSummary });
  }
  return details;
}

function branchGroupLabel(entry: WorkflowTimelineEntry): string {
  const omitted = coordinatorOmittedCount(entry);
  const omissionLabel = omitted > 0 ? ` · ${omitted} more omitted` : '';
  const speculationLabel =
    entry.speculationOutcome === undefined ? '' : ` · ${entry.speculationOutcome}`;
  return `${timelineEntryLabel(entry)}${speculationLabel}${omissionLabel}`;
}

function mapCoordinatorEntry(
  entry: WorkflowTimelineEntry,
  details: readonly WorkflowTimelineOperationDetail[],
): RunStepBranchGroup {
  const lanes: RunStepBranchLane[] = details.map((detail) => {
    const stepId = `${timelineStepId(entry.step)}-branch-${String(detail.index)}`;
    const step: RunStep = {
      id: stepId,
      label: detail.operationLabel,
      status: branchStepStatus(detail),
      details: branchStepDetails(entry, detail),
      ...(entry.speculationOutcome === 'rolled-back' ? { rewound: true } : {}),
    };
    return {
      id: `${stepId}-lane`,
      ...(detail.key === undefined ? {} : { label: detail.key }),
      outcome: branchLaneOutcome(detail),
      steps: [step],
    };
  });

  return {
    kind: 'branch',
    id: timelineStepId(entry.step),
    label: branchGroupLabel(entry),
    lanes,
  };
}

/**
 * Maps the full timeline to Cinder's timeline-entry union in step order.
 * Coordinator metadata becomes native branch groups; ordinary entries remain
 * top-level steps.
 */
export function mapTimelineToSteps(
  entries: readonly WorkflowTimelineEntry[],
): RunStepTimelineEntry[] {
  const compensatesStep = resolveCompensationTargets(entries);

  return entries.map((entry) => {
    const details = coordinatorDetails(entry);
    if (isCoordinationEntry(entry) && details !== undefined) {
      return mapCoordinatorEntry(entry, details);
    }

    const compensatesTargetStep = compensatesStep.get(entry.step);
    const step: RunStep = {
      id: timelineStepId(entry.step),
      label: timelineEntryLabel(entry),
      status: timelineStepStatus(entry.status),
      startTime: new Date(entry.timestamp).toISOString(),
      details: buildDetails(entry),
      ...(entry.duration !== undefined
        ? {
            duration: formatDuration(entry.duration),
            endTime: new Date(entry.timestamp + entry.duration).toISOString(),
          }
        : {}),
      ...(compensatesTargetStep !== undefined
        ? { compensates: timelineStepId(compensatesTargetStep) }
        : {}),
    };
    return step;
  });
}
