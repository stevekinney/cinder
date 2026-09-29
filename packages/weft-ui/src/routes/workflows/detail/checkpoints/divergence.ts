/**
 * Step-aligned divergence between an original workflow's timeline and its
 * fork's (plan T3.3, §7.3 "Replay side-by-side divergence view — two
 * aligned RunStepTimeline instances with step-alignment and divergence
 * highlighting; Weft-specific semantics"). App-local — no upstream Cinder
 * primitive expresses "compare two timelines," and this is a genuinely
 * Weft-specific concept (fork lineage), matching §7.3's bespoke-net-new
 * list.
 *
 * `client.fork(id, { fromStep })` clones the checkpoint history up to and
 * including `fromStep` verbatim (`weft/src/server/operations/fork-workflow.ts`
 * → `engine.fork`), so both timelines are identical through that step by
 * construction — divergence, when it appears, only ever begins at or after
 * the fork point. This module doesn't assume that though: it aligns by step
 * number and compares independently, so it stays correct even if a caller
 * points it at two unrelated timelines.
 */
import type { WorkflowTimelineEntry } from '@lostgradient/weft';

import { timelineStepId } from '../timeline/timeline-mapping.ts';

export type DivergenceKind = 'same' | 'diverged' | 'original-only' | 'forked-only';

export interface DivergenceRow {
  readonly step: number;
  readonly stepId: string;
  readonly original: WorkflowTimelineEntry | null;
  readonly forked: WorkflowTimelineEntry | null;
  readonly kind: DivergenceKind;
}

function entryDiffers(a: WorkflowTimelineEntry, b: WorkflowTimelineEntry): boolean {
  return (
    a.operationType !== b.operationType ||
    a.operationLabel !== b.operationLabel ||
    a.status !== b.status
  );
}

/** Aligns two timelines by step number and classifies each row. Sorted by step, ascending. */
export function alignTimelinesForDivergence(
  original: readonly WorkflowTimelineEntry[],
  forked: readonly WorkflowTimelineEntry[],
): DivergenceRow[] {
  const originalByStep = new Map(original.map((entry) => [entry.step, entry]));
  const forkedByStep = new Map(forked.map((entry) => [entry.step, entry]));
  const steps = [...new Set([...originalByStep.keys(), ...forkedByStep.keys()])].toSorted(
    (a, b) => a - b,
  );

  return steps.map((step) => {
    const originalEntry = originalByStep.get(step) ?? null;
    const forkedEntry = forkedByStep.get(step) ?? null;
    const kind: DivergenceKind =
      originalEntry === null
        ? 'forked-only'
        : forkedEntry === null
          ? 'original-only'
          : entryDiffers(originalEntry, forkedEntry)
            ? 'diverged'
            : 'same';

    return {
      step,
      stepId: timelineStepId(step),
      original: originalEntry,
      forked: forkedEntry,
      kind,
    };
  });
}

/** Step ids (as minted by `timeline-mapping.ts`) that diverge in the ORIGINAL timeline's own step-id space. */
export function divergedOriginalStepIds(rows: readonly DivergenceRow[]): ReadonlySet<string> {
  return new Set(
    rows
      .filter((row) => row.kind === 'diverged' || row.kind === 'original-only')
      .map((row) => row.stepId),
  );
}

/** Step ids that diverge in the FORKED timeline's own step-id space. */
export function divergedForkedStepIds(rows: readonly DivergenceRow[]): ReadonlySet<string> {
  return new Set(
    rows
      .filter((row) => row.kind === 'diverged' || row.kind === 'forked-only')
      .map((row) => row.stepId),
  );
}
