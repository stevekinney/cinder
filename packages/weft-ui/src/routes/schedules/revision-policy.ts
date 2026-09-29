/**
 * Revision-policy vocabulary (WFT-20), mirroring `overlap-policy.ts`'s
 * value/label/consequence descriptor shape. Values/labels use the engine's
 * actual `ScheduleRevisionPolicy` vocabulary (`active-at-fire | pinned`,
 * `@lostgradient/weft`).
 */
import type { ScheduleRevisionPolicy } from '@lostgradient/weft';

import { FRESH_START_REVISION_HEDGE } from '../../lib/workflow-revision.ts';

export interface RevisionPolicyDescriptor {
  readonly value: ScheduleRevisionPolicy;
  readonly label: string;
  readonly consequence: string;
}

const ACTIVE_AT_FIRE_DESCRIPTOR: RevisionPolicyDescriptor = {
  value: 'active-at-fire',
  label: 'Active at fire',
  consequence: `Each occurrence resolves whichever revision is active at the moment it fires. This is the default. ${FRESH_START_REVISION_HEDGE}`,
};

export const REVISION_POLICIES: readonly RevisionPolicyDescriptor[] = [
  ACTIVE_AT_FIRE_DESCRIPTOR,
  {
    value: 'pinned',
    label: 'Pinned',
    consequence:
      'Every occurrence resolves the exact revision captured when the schedule was created or last re-pinned. If that revision later becomes unavailable, the schedule pauses instead of silently running a different one.',
  },
];

const REVISION_POLICY_BY_VALUE: ReadonlyMap<ScheduleRevisionPolicy, RevisionPolicyDescriptor> =
  new Map(REVISION_POLICIES.map((descriptor) => [descriptor.value, descriptor]));

/** Falls back to the `active-at-fire` descriptor for a value outside the known set (defensive — every persisted schedule's `revisionPolicy` is engine-validated). */
function revisionPolicyDescriptor(policy: ScheduleRevisionPolicy): RevisionPolicyDescriptor {
  return REVISION_POLICY_BY_VALUE.get(policy) ?? ACTIVE_AT_FIRE_DESCRIPTOR;
}

export function revisionPolicyLabel(policy: ScheduleRevisionPolicy): string {
  return revisionPolicyDescriptor(policy).label;
}

export function revisionPolicyConsequence(policy: ScheduleRevisionPolicy): string {
  return revisionPolicyDescriptor(policy).consequence;
}
