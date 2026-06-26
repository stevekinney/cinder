import type { ApprovalState } from './approval-card.types.ts';

export function resolveEffectiveApprovalState(
  approvalState: ApprovalState,
  expirationTimestamp: number | undefined,
  currentTime: number | undefined,
): ApprovalState {
  if (approvalState !== 'pending' || expirationTimestamp === undefined) return approvalState;
  return resolveComparisonTime(currentTime) >= expirationTimestamp ? 'expired' : approvalState;
}

export function isApprovalActionable(
  approvalState: ApprovalState,
  expirationTimestamp: number | undefined,
  currentTime: number | undefined,
): boolean {
  if (approvalState !== 'pending') return false;
  if (expirationTimestamp === undefined) return true;
  return resolveComparisonTime(currentTime) < expirationTimestamp;
}

function resolveComparisonTime(currentTime: number | undefined): number {
  return currentTime ?? Date.now();
}
