import { describe, expect, it } from 'bun:test';

import { isFreshApprovalDecision } from './approval-decision.ts';

const current = {
	displayedCallId: 'call-a',
	decidedCallId: 'call-a',
	displayedGeneration: 1,
	currentGeneration: 1,
	displayedEpoch: 2,
	currentEpoch: 2
};

describe('isFreshApprovalDecision', () => {
	for (const outcome of ['success', '409', 'other HTTP error', 'network rejection']) {
		it(`rejects a stale ${outcome} after the displayed question is removed`, () => {
			expect(isFreshApprovalDecision({ ...current, displayedCallId: undefined })).toBe(false);
		});

		it(`rejects a stale ${outcome} after the displayed question is replaced`, () => {
			expect(isFreshApprovalDecision({ ...current, displayedCallId: 'call-b' })).toBe(false);
		});
	}

	it('accepts a response for the displayed question in the same polling session', () => {
		expect(isFreshApprovalDecision(current)).toBe(true);
	});
});
