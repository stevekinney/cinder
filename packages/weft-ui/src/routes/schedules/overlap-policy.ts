/**
 * Overlap-policy vocabulary (Track B, plan §9.3: "overlap policy with
 * one-sentence consequence text — the four-policy table from the source doc
 * is retained verbatim"). The consequence copy below is quoted VERBATIM from
 * the source doc (`Weft UI.md` §6.3 "Overlap Policy Consequence Statements")
 * — do not rephrase it to match the design mock's shorter card copy (design
 * `Weft New Surfaces.dc.html` §A2's "Buffer one" wording contradicts the
 * engine: `queuedRuns` grows unbounded for the `queue` policy — see
 * `weft/src/core/engine/schedules.ts` `queuedRuns + 1` and Weft UI.md's own
 * "Queue can grow unbounded during outages" — so §A2 is binding for
 * layout/structure, not for this specific string).
 *
 * Values/labels use the engine's actual `ScheduleOverlapPolicy` vocabulary
 * (`skip | queue | cancel-running | allow`, `@lostgradient/weft`), not the
 * design mock's alternate "Buffer one / Cancel other / Allow all" labels.
 */
import type { ScheduleOverlapPolicy } from '@lostgradient/weft';

export interface OverlapPolicyDescriptor {
  readonly value: ScheduleOverlapPolicy;
  readonly label: string;
  readonly consequence: string;
}

const SKIP_DESCRIPTOR: OverlapPolicyDescriptor = {
  value: 'skip',
  label: 'Skip',
  consequence:
    'If a run is still active when this fires, the new occurrence is silently dropped. Missed fires are not retried.',
};

/** Ordered for the create/edit form's radio-card layout — matches the source doc's table order. */
export const OVERLAP_POLICIES: readonly OverlapPolicyDescriptor[] = [
  SKIP_DESCRIPTOR,
  {
    value: 'queue',
    label: 'Queue',
    consequence:
      'If a run is still active, the new occurrence is queued and will start when the previous run completes. Queue can grow unbounded during outages.',
  },
  {
    value: 'cancel-running',
    label: 'Cancel running',
    consequence:
      'If a run is still active, it is cancelled immediately and the new occurrence starts. Use only for idempotent workflows.',
  },
  {
    value: 'allow',
    label: 'Allow',
    consequence:
      'Concurrent runs are permitted. Multiple instances may run simultaneously. Use only if the workflow is safe to parallelize.',
  },
];

const OVERLAP_POLICY_BY_VALUE: ReadonlyMap<ScheduleOverlapPolicy, OverlapPolicyDescriptor> =
  new Map(OVERLAP_POLICIES.map((descriptor) => [descriptor.value, descriptor]));

/** Falls back to the `skip` descriptor for a value outside the known set (defensive — every persisted schedule's `overlap` is engine-validated). */
function overlapDescriptor(policy: ScheduleOverlapPolicy): OverlapPolicyDescriptor {
  return OVERLAP_POLICY_BY_VALUE.get(policy) ?? SKIP_DESCRIPTOR;
}

export function overlapLabel(policy: ScheduleOverlapPolicy): string {
  return overlapDescriptor(policy).label;
}

export function overlapConsequence(policy: ScheduleOverlapPolicy): string {
  return overlapDescriptor(policy).consequence;
}
