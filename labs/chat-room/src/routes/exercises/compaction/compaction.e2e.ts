/**
 * Context compaction, and the boundary it does not cross.
 *
 * Two claims, and the second is the one that is easy to get wrong. Compaction
 * rewrites the model-visible projection — a summary system message plus the
 * retained tail — while carrying the pinned message through verbatim from
 * outside the retain window. It does NOT touch the history the page handed to
 * `run()`, because `run()` snapshots that history before the loop starts.
 *
 * The second claim is asserted by content and count, never by object
 * identity: `getMessages()` returns a fresh array per call, so an identity
 * comparison would report "changed" for a transcript nothing touched.
 */

import { expect, test } from '@playwright/test';

import { gotoHydrated } from '../hydration';

const field = (name: string) => `[data-testid="compaction-${name}"]`;

test('summarizes the transcript the model sees, and carries the pinned fact through', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/compaction');

	// Five, from fourteen: the injected summary, the original system message,
	// the pinned message, and the two retained recent messages.
	await expect(page.locator(field('projection-length'))).toHaveText('5');
	await expect(page.locator(field('projection-roles'))).toHaveText(
		'system, system, user, user, assistant'
	);
	await expect(page.locator(field('projection-summary'))).toHaveText('true');

	// A summary-SHAPED message is not evidence that the context reached the
	// summarizer: a compaction that handed it an empty or truncated slice
	// would still produce one, and every other assertion here would hold.
	// Ten is the complement of the four the projection carries verbatim — the
	// system message, the pinned message, and the two retained recent ones.
	//
	// Counted by distinct message id, not by call. Compaction chunked this
	// into 3/3/3/1, and those sizes are conversationalist's business; the id
	// count is the same however the work is divided.
	await expect(page.locator(field('summarized-messages'))).toHaveText('10');
	await expect(page.locator(field('foreign-messages'))).toHaveText('0');

	// The partition itself, sorted per message rather than inferred from two
	// totals: a compaction that both summarized AND retained one message
	// while dropping another sums to 14 just the same.
	await expect(page.locator(field('carried-verbatim'))).toHaveText('4');
	await expect(page.locator(field('bucket-overlap'))).toHaveText('0 / 0');
	await expect(page.locator(field('partition'))).toHaveText('true');

	// Matched by role + content + METADATA, and this is the field that says
	// why. A carried-through message whose `pinned` flag was stripped would
	// look identical by content and then be summarized away on the next
	// compaction — the exact failure the preserve policy exists to prevent,
	// arriving one round later than anyone would look for it.
	await expect(page.locator(field('pinned-metadata'))).toHaveText('true');

	// The pinned message is the second of fourteen — far outside
	// `retainRecentMessages: 2`. It survives because the preserve policy
	// carries it, not because it was recent.
	await expect(page.locator(field('projection-pin'))).toHaveText('true');

	// Its unpinned neighbour, appended immediately after it, does not. Without
	// this the pin assertion would pass on a projection that simply kept
	// everything.
	await expect(page.locator(field('projection-filler'))).toHaveText('false');
});

test("leaves the page's own transcript exactly as it was", async ({ page }) => {
	await gotoHydrated(page, '/exercises/compaction');

	// The whole-transcript claim, and the only assertion here that can catch
	// a rewrite this page does not specifically look for: a reordering, a
	// stripped `pinned` flag, an edit to a filler message. Count-and-two-
	// strings would stay green through all three.
	await expect(page.locator(field('seeded-identical'))).toHaveText('true');

	// …which is worth nothing unless the comparison can come out both ways.
	// The positive control reads two untouched snapshots and finds them
	// equal; the negative control runs the same comparison against the
	// compacted projection, which IS a rewrite of this transcript, and finds
	// them different.
	await expect(page.locator(field('seeded-control'))).toHaveText('true');
	await expect(page.locator(field('projection-differs'))).toHaveText('true');

	// Kept alongside the deep compare because they name WHAT survived, which
	// is what a reader of a failure needs before the serialized diff means
	// anything.
	await expect(page.locator(field('seeded-length-before'))).toHaveText('14');
	await expect(page.locator(field('seeded-length-after'))).toHaveText('14');
	await expect(page.locator(field('seeded-pin'))).toHaveText('true');
	await expect(page.locator(field('seeded-filler'))).toHaveText('true');
});
