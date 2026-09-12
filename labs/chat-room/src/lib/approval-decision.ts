/** Whether an asynchronous approval response may still mutate this surface. */
export function isFreshApprovalDecision(input: {
	readonly displayedCallId: string | undefined;
	readonly decidedCallId: string;
	readonly displayedGeneration: number;
	readonly currentGeneration: number;
	readonly displayedEpoch: number;
	readonly currentEpoch: number;
}): boolean {
	return (
		input.displayedCallId === input.decidedCallId &&
		input.displayedGeneration === input.currentGeneration &&
		input.displayedEpoch === input.currentEpoch
	);
}
