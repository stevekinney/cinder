import type { ServerOwnedConversationSnapshot } from './server-owned-snapshot';

export type ServerOwnedSynchronizationOptions = {
	id: string;
	visible: () => boolean;
	streaming: () => boolean;
	apply: (snapshot: ServerOwnedConversationSnapshot) => void;
	onResponseError?: (cause: unknown) => void;
	fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
	clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

export type ServerOwnedSynchronizer = {
	trigger: () => void;
	setStreaming: (streaming: boolean) => void;
	setVisible: (visible: boolean) => void;
	dispose: () => void;
};

/** Coordinates idle-only full snapshot reads for a server-owned conversation. */
export function createServerOwnedSynchronizer(
	options: ServerOwnedSynchronizationOptions
): ServerOwnedSynchronizer {
	const fetcher = options.fetcher ?? fetch;
	const setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
	const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
	let visible = options.visible();
	let active = options.streaming();
	let disposed = false;
	let pending = false;
	let epoch = 0;
	let readController: AbortController | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const cancelTimer = (): void => {
		if (timer !== undefined) {
			clearTimer(timer);
			timer = undefined;
		}
	};

	const eligible = (): boolean => !disposed && visible && !active;

	const schedule = (): void => {
		cancelTimer();
		if (!eligible()) return;
		timer = setTimer(() => {
			timer = undefined;
			trigger();
		}, 5000);
	};

	const read = async (): Promise<void> => {
		if (!eligible() || readController !== undefined) return;
		const controller = new AbortController();
		const readEpoch = epoch;
		readController = controller;
		try {
			const response = await fetcher(`/api/server-owned/conversations/${options.id}`, {
				signal: controller.signal,
				headers: { Accept: 'application/json' }
			});
			const current = !disposed && readEpoch === epoch && eligible();
			if (!current) {
				// The response is stale, but the common cleanup below still owns
				// releasing the read slot and scheduling any coalesced trigger.
			} else if (!response.ok) {
				options.onResponseError?.(response);
			} else {
				const snapshot = (await response.json()) as ServerOwnedConversationSnapshot;
				if (!disposed && readEpoch === epoch && eligible()) options.apply(snapshot);
			}
		} catch (cause) {
			// Aborts are lifecycle control, and ambiguous transport failures are
			// deliberately left to the next scheduled read. Neither is a rejection
			// of the user's send.
			if (!controller.signal.aborted) options.onResponseError?.(cause);
		}
		if (readController === controller) readController = undefined;
		if (disposed || readEpoch !== epoch) return;
		if (pending && eligible()) {
			pending = false;
			void read();
		} else {
			schedule();
		}
	};

	function trigger(): void {
		if (disposed) return;
		cancelTimer();
		if (!eligible()) {
			if (visible) pending = true;
			return;
		}
		if (readController !== undefined) {
			pending = true;
			return;
		}
		void read();
	}

	return {
		trigger,
		setStreaming(value) {
			if (active === value || disposed) return;
			active = value;
			if (value) {
				epoch += 1;
				readController?.abort();
				readController = undefined;
				cancelTimer();
			} else {
				queueMicrotask(() => trigger());
			}
		},
		setVisible(value) {
			if (visible === value || disposed) return;
			visible = value;
			if (!value) {
				epoch += 1;
				readController?.abort();
				readController = undefined;
				cancelTimer();
			} else {
				trigger();
			}
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			epoch += 1;
			readController?.abort();
			readController = undefined;
			cancelTimer();
		}
	};
}
