import type { SignedPendingToolApproval } from 'armorer';

import type { ToolResult } from '@lostgradient/chat';

export type PendingApprovalResult = ToolResult & {
	pendingApproval?: SignedPendingToolApproval;
};

export function updatePendingApproval(
	pendingApprovals: Map<string, SignedPendingToolApproval>,
	result: PendingApprovalResult
): void {
	if (result.pendingApproval) {
		pendingApprovals.set(result.callId, result.pendingApproval);
	} else {
		pendingApprovals.delete(result.callId);
	}
}
