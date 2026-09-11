import { ChatRunFailureError } from '@lostgradient/chat';

/**
 * A failure banner's state, kept structured rather than flattened to a string.
 *
 * `retryable` is what a message alone cannot say: a rate-limited provider and
 * a rejected API key produce the same sentence, and only one of them is worth
 * pressing Retry over. `undefined` means the host did not classify the
 * failure — rendered as neither, because inventing an answer here is how a
 * user ends up retrying something that can only fail again.
 */
export type BannerFailure = { message: string; retryable?: boolean };

/**
 * Narrows whatever reaches an error hook into the banner's shape.
 *
 * A `ChatRunFailureError` carries the host's own classification off the wire.
 * Anything else — a transport rejection, a thrown observer — carries no claim
 * about retryability, so none is made.
 *
 * Shared by every route that renders a failure banner. It lives here rather
 * than in one page because the second route to need it copied the first, and
 * two copies of a classification rule drift in exactly the way that makes one
 * route quietly stop reporting retryability.
 */
export function toBannerFailure(cause: unknown): BannerFailure {
	if (cause instanceof ChatRunFailureError) {
		const { message, retryable } = cause.runError;
		return { message, ...(retryable === undefined ? {} : { retryable }) };
	}
	return { message: cause instanceof Error ? cause.message : 'Something went wrong.' };
}
