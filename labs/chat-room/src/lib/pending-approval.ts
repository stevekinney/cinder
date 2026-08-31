import type { SignedPendingToolApproval } from 'armorer';

import type { ChatToolResult } from '@lostgradient/chat';

export type PendingApprovalResult = ChatToolResult;

function isSignedPendingToolApproval(value: unknown): value is SignedPendingToolApproval {
	if (typeof value !== 'object' || value === null) return false;
	return (
		typeof Reflect.get(value, 'callId') === 'string' &&
		typeof Reflect.get(value, 'toolName') === 'string' &&
		typeof Reflect.get(value, 'approvalToken') === 'string' &&
		typeof Reflect.get(value, 'action') === 'object' &&
		Reflect.get(value, 'action') !== null
	);
}

export function updatePendingApproval(
	pendingApprovals: Map<string, SignedPendingToolApproval>,
	result: PendingApprovalResult
): void {
	if (isSignedPendingToolApproval(result.pendingApproval)) {
		pendingApprovals.set(result.callId, result.pendingApproval);
	} else {
		pendingApprovals.delete(result.callId);
	}
}
