import type { ApprovalState } from './approval-card.types.ts';

export function resolveEffectiveApprovalState(
  approvalState: ApprovalState,
  expirationTimestamp: number | undefined,
  currentTime: number | undefined,
): ApprovalState {
  if (approvalState !== 'pending' || expirationTimestamp === undefined) return approvalState;
  if (currentTime === undefined) return approvalState;
  return currentTime >= expirationTimestamp ? 'expired' : approvalState;
}

export function isApprovalExpirationCheckPending(
  approvalState: ApprovalState,
  expirationTimestamp: number | undefined,
  currentTime: number | undefined,
): boolean {
  return (
    approvalState === 'pending' && expirationTimestamp !== undefined && currentTime === undefined
  );
}

export function isApprovalActionable(
  approvalState: ApprovalState,
  expirationTimestamp: number | undefined,
  currentTime: number | undefined,
): boolean {
  if (approvalState !== 'pending') return false;
  if (expirationTimestamp === undefined) return true;
  if (currentTime === undefined) return false;
  return currentTime < expirationTimestamp;
}
