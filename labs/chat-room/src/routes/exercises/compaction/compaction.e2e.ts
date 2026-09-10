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
