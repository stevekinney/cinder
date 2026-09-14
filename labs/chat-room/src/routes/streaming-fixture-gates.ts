import type { ServerResponse } from 'node:http';

/** Per-marker request counts and lifecycle state for gated fixture responses. */
export const requestCounts = new Map<string, number>();
export const heldGates = new Map<string, () => void>();
export const earlyReleases = new Set<string>();

/** Parks a response until its marker is released or its client disconnects. */
export function gate(marker: string, res: ServerResponse): Promise<'released' | 'disconnected'> {
	if (earlyReleases.delete(marker)) return Promise.resolve('released');

	return new Promise((resolve) => {
		let settled = false;
		const onClose = (): void => {
			if (settled) return;
			settled = true;
			heldGates.delete(marker);
			resolve('disconnected');
		};

		heldGates.set(marker, () => {
			if (settled) return;
			settled = true;
			res.off('close', onClose);
			resolve('released');
		});
		res.on('close', onClose);
	});
}
