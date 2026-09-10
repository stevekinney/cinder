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
	await expect(page.locator(field('carried-unchanged'))).toHaveText('4');
	await expect(page.locator(field('bucket-overlap'))).toHaveText('0 / 0');
	await expect(page.locator(field('partition'))).toHaveText('true');

	// Membership says nothing about ORDER, and order is what the model reads.
	// Swapping the pinned message with a retained recent one leaves every
	// count, shape, and role assertion above untouched while putting recent
	// context ahead of the older pinned fact. Mapped back to seed positions,
	// the whole projection is pinned in one string: the summary first, then
	// the system message and the pinned fact, then the two retained recent
	// messages, in the order they were seeded.
	await expect(page.locator(field('projection-order'))).toHaveText('summary, 0, 1, 12, 13');

	// Exactly one generation, and the projection above is the one IT received.
	// The page captures on the first call and never overwrites, so a second
	// provider call would otherwise leave no trace.
	await expect(page.locator(field('generate-calls'))).toHaveText('1');

	// Every chunk's summary reached the model. Compaction summarizes in
	// chunks, and with each returning the same text a discarded result would
	// be invisible — a summary-shaped message would still be there and every
	// assertion above would hold. Asserted as a boolean, not a count: how many
	// chunks compaction chose is an internal, whether it dropped one is not.
	await expect(page.locator(field('summaries-survived'))).toHaveText('true');

	// …and in the order they were produced. Presence alone would hold if the
	// chunks were concatenated backwards, and the model would then read the
	// summarized history in reverse while every other assertion passed.
	//
	// The BOOLEAN, not the order string: `'1, 2, 3, 4'` would require exactly
	// four callbacks, which is the chunk count this whole section is careful
	// not to pin. A compactor that summarized the same ten messages in two
	// chunks and preserved both results changes nothing this route advertises.
	await expect(page.locator(field('summaries-in-order'))).toHaveText('true');

	// And the chunks were FED chronologically, which the marker positions
	// cannot tell you: newest-first chunks whose results are concatenated in
	// callback order also produce ascending markers, and the model then reads
	// the summarized history backwards.
	await expect(page.locator(field('chunks-chronological'))).toHaveText('true');

	// No message summarized twice. Distinct-id counting hides a repeat: the
	// totals and the partition stay correct while the summary double-counts
	// context and a real summarizer bills for the redundant call.
	await expect(page.locator(field('duplicate-inputs'))).toHaveText('0');

	// "Unchanged" above means role, content, and metadata — the whole of what
	// survives. Message IDS are reassigned by compaction, which is why the
	// comparison is by shape rather than by id, and why anything keyed to a
	// message id does not survive a compaction boundary.
	//
	// Metadata is in that shape deliberately, and this is the field that says
	// why. A carried-through message whose `pinned` flag was stripped would
	// look identical by content and then be summarized away on the next
	// compaction — the exact failure the preserve policy exists to prevent,
	// arriving one round later than anyone would look for it.
	await expect(page.locator(field('pinned-metadata'))).toHaveText('true');

	// And the other half of that sentence, made load-bearing: ids really are
	// reassigned. If compaction started preserving them, every assertion above
	// would stay green while this route's prose taught a contract that had
	// changed underneath it.
	await expect(page.locator(field('id-overlap'))).toHaveText('0');

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
