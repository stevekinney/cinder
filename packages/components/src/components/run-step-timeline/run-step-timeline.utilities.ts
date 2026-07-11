import type { StatusDotStatus } from '../status-dot/status-dot.types.ts';
import type {
  RunStep,
  RunStepBranchGroup,
  RunStepBranchLane,
  RunStepBranchLaneOutcome,
  RunStepStatus,
  RunStepTimelineEntry,
} from './run-step-timeline.types.ts';

/**
 * Relocate resolved compensation steps immediately after the subtree of the
 * sibling they reverse. Unresolved, self-referential, and cyclic links retain
 * consumer order. Multiple compensations retain their relative input order.
 */
export function relocateCompensationSteps(steps: RunStep[]): RunStep[] {
  return relocateSiblingItems(steps, (step) => step);
}

function relocateSiblingItems<T>(items: T[], getStep: (item: T) => RunStep | undefined): T[] {
  const stepById = new Map<string, RunStep>();
  for (const item of items) {
    const step = getStep(item);
    if (step !== undefined) {
      stepById.set(step.id, step);
    }
  }
  const canRelocate = (step: RunStep): boolean => {
    const visited = new Set<string>([step.id]);
    let targetId = step.compensates;
    while (targetId !== undefined) {
      const target = stepById.get(targetId);
      if (target === undefined || visited.has(targetId)) return false;
      visited.add(targetId);
      targetId = target.compensates;
    }
    return true;
  };
  const relocatable = new Set<RunStep>();
  const compensationsByTarget = new Map<string, T[]>();
  for (const item of items) {
    const step = getStep(item);
    if (step === undefined || step.compensates === undefined || !canRelocate(step)) continue;
    relocatable.add(step);
    const compensations = compensationsByTarget.get(step.compensates) ?? [];
    compensations.push(item);
    compensationsByTarget.set(step.compensates, compensations);
  }
  const result: T[] = [];
  const appendWithCompensations = (item: T): void => {
    result.push(item);
    const step = getStep(item);
    if (step === undefined) return;
    for (const compensation of compensationsByTarget.get(step.id) ?? []) {
      appendWithCompensations(compensation);
    }
  };
  for (const item of items) {
    const step = getStep(item);
    if (step === undefined || !relocatable.has(step)) appendWithCompensations(item);
  }
  return result;
}

/** Relocate top-level compensations while preserving branch rows as rail entries. */
export function relocateCompensationEntries(
  entries: RunStepTimelineEntry[],
): RunStepTimelineEntry[] {
  const normalized = entries.map((entry) =>
    isBranchGroup(entry)
      ? {
          ...entry,
          lanes: entry.lanes.map((lane) => ({
            ...lane,
            steps: relocateCompensationSteps(lane.steps),
          })),
        }
      : entry,
  );
  return relocateSiblingItems(normalized, (entry) => (isBranchGroup(entry) ? undefined : entry));
}

function isBranchGroup(entry: RunStepTimelineEntry): entry is RunStepBranchGroup {
  return 'kind' in entry && entry.kind === 'branch';
}

/** Badge variants used for the per-step status chip. */
export type RunStepBadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

/** Map a generic {@link RunStepStatus} onto a StatusDot status token. */
export function statusDotStatus(status: RunStepStatus): StatusDotStatus {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'danger';
    case 'running':
      return 'online';
    case 'retrying':
      return 'warning';
    case 'waiting_approval':
      return 'accent';
    case 'cancelled':
      return 'offline';
    case 'skipped':
      return 'neutral';
    case 'pending':
      return 'pending';
  }
}

/** Human-readable label for the StatusDot accessible name. */
export function statusLabel(status: RunStepStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'succeeded':
      return 'Succeeded';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'skipped':
      return 'Skipped';
    case 'retrying':
      return 'Retrying';
    case 'waiting_approval':
      return 'Waiting approval';
  }
}

/** Map a {@link RunStepStatus} to a Badge variant for the status chip. */
export function badgeVariant(status: RunStepStatus): RunStepBadgeVariant {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'danger';
    case 'running':
      return 'info';
    case 'retrying':
      return 'warning';
    case 'waiting_approval':
      return 'accent';
    case 'cancelled':
      return 'neutral';
    case 'skipped':
      return 'neutral';
    case 'pending':
      return 'neutral';
  }
}

/** Whether this status is a terminal state (no further changes expected). */
export function isTerminal(status: RunStepStatus): boolean {
  return (
    status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'skipped'
  );
}

/** Whether this status represents an in-flight ("current") step. */
export function isCurrent(status: RunStepStatus): boolean {
  return status === 'running' || status === 'retrying' || status === 'waiting_approval';
}

/** Whether this step should render a progress bar. */
export function hasProgress(step: RunStep): boolean {
  return step.progress !== undefined && isCurrent(step.status);
}

/** Metadata items for a step, as term/definition pairs. */
export function metadataItems(step: RunStep): { term: string; definition: string }[] {
  const items: { term: string; definition: string }[] = [];
  if (step.startTime !== undefined) {
    items.push({ term: 'Started', definition: step.startTime });
  }
  if (step.endTime !== undefined) {
    items.push({ term: 'Ended', definition: step.endTime });
  }
  if (step.duration !== undefined) {
    items.push({ term: 'Duration', definition: step.duration });
  }
  if (step.attemptCount !== undefined && step.attemptCount > 1) {
    items.push({ term: 'Attempts', definition: String(step.attemptCount) });
  }
  return items;
}

/** Pluralized "N action(s)" label. */
export function actionsCountLabel(actionsCount: number): string {
  return actionsCount === 1 ? '1 action' : `${actionsCount} actions`;
}

/** Pluralized "N nested step(s) hidden" label for the depth-cap row. */
export function hiddenNestedStepLabel(hiddenStepCount: number): string {
  return hiddenStepCount === 1 ? '1 nested step hidden' : `${hiddenStepCount} nested steps hidden`;
}

/** Human-readable label for a branch-lane outcome, used in badges and announcements. */
export function laneOutcomeLabel(outcome: RunStepBranchLaneOutcome): string {
  switch (outcome) {
    case 'won':
      return 'Won';
    case 'lost':
      return 'Lost';
    case 'settled':
      return 'Settled';
  }
}

/** Badge variant for a branch-lane outcome. */
export function laneOutcomeBadgeVariant(outcome: RunStepBranchLaneOutcome): RunStepBadgeVariant {
  switch (outcome) {
    case 'won':
      return 'success';
    case 'lost':
      return 'neutral';
    case 'settled':
      return 'info';
  }
}

/**
 * One-line accessible summary of a branch group's lane outcomes, e.g.
 * "1 won, 2 lost" or "3 lanes racing" while outcomes are still pending.
 */
export function branchOutcomeSummary(lanes: RunStepBranchLane[]): string {
  const counts = { won: 0, lost: 0, settled: 0, pending: 0 };
  for (const lane of lanes) {
    if (lane.outcome === undefined) counts.pending += 1;
    else counts[lane.outcome] += 1;
  }
  const parts: string[] = [];
  if (counts.won > 0) parts.push(`${counts.won} won`);
  if (counts.lost > 0) parts.push(`${counts.lost} lost`);
  if (counts.settled > 0) parts.push(`${counts.settled} settled`);
  if (counts.pending > 0) {
    parts.push(counts.pending === 1 ? '1 lane racing' : `${counts.pending} lanes racing`);
  }
  return parts.length > 0 ? parts.join(', ') : 'No lanes';
}

/**
 * Whether any step in any lane of a branch group is currently in-flight.
 * Iterative (explicit stack) so a deeply-nested lane can't overflow the call
 * stack — this runs before the render path's depth cap.
 */
export function branchGroupHasCurrentStep(group: RunStepBranchGroup): boolean {
  const stack: RunStep[] = group.lanes.flatMap((lane) => lane.steps);
  while (stack.length > 0) {
    const step = stack.pop();
    if (step === undefined) continue;
    if (isCurrent(step.status)) return true;
    if (step.children) {
      for (const child of step.children) stack.push(child);
    }
  }
  return false;
}

/**
 * Resolve whether a branch group starts collapsed. An explicit `collapsed`
 * wins; otherwise the group collapses once its lane count reaches the
 * threshold (default 3).
 */
export function branchStartsCollapsed(
  laneCount: number,
  collapseThreshold: number | undefined,
  collapsed: boolean | undefined,
): boolean {
  if (collapsed !== undefined) return collapsed;
  // Normalize the public `collapseThreshold` to a finite positive integer so a
  // stray 0, negative, NaN, or fractional value can't produce surprising
  // always-/never-collapsed behavior; fall back to the default of 3.
  const threshold =
    collapseThreshold !== undefined && Number.isInteger(collapseThreshold) && collapseThreshold > 0
      ? collapseThreshold
      : 3;
  return laneCount >= threshold;
}

/** Whether the string contains an ASCII control character (0x00-0x1F or 0x7F). */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Normalize a step link href to a safe value, or `undefined` when the href is
 * empty, control-character-laden, backslash-bearing, protocol-relative, or a
 * non-http(s) scheme.
 */
export function safeStepLinkHref(href: string): string | undefined {
  const trimmedHref = href.trim();
  if (trimmedHref === '') return undefined;
  // Reject control characters (0x00-0x1F, 0x7F) without a control-char regex.
  if (hasControlCharacter(trimmedHref)) return undefined;
  if (trimmedHref.includes('\\')) return undefined;
  const leadingSeparators = trimmedHref.match(/^[\\/]+/)?.[0] ?? '';
  if (leadingSeparators.length > 1) return undefined;

  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(trimmedHref)) {
    try {
      const parsedUrl = new URL(trimmedHref);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
        ? trimmedHref
        : undefined;
    } catch {
      return undefined;
    }
  }

  return trimmedHref;
}
