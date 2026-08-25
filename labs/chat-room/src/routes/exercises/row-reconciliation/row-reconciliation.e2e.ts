import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from '../hydration';

/**
 * ROADMAP I-1. Row insertion and removal, in a real browser, because there is
 * nowhere else they can be observed.
 *
 * Under happy-dom a keyed `{#each}` whose body starts with a conditional renders
 * its initial items and then never inserts or removes another one — which is the
 * exact shape of Chat's non-virtualized row list. That is a harness artifact
 * rather than a component defect (upstream verified it against a standalone
 * repro and recorded it in a test-only helper that never ships), but it means a
 * unit test of "message appears / message leaves" passes there without the DOM
 * ever changing. It cost a filed issue, a shipped workaround, and a revert
 * before anyone chased it down.
 *
 * What the assertions below therefore go out of their way to do is distinguish
 * RECONCILED from REBUILT. Row count and row text cannot tell those apart: a
 * `{#key}` block torn down and reconstructed produces the same rows, in the same
 * order, carrying the same ids. So each test that cares stamps a `data-probe`
 * attribute onto the live row articles first — an attribute Svelte does not
 * manage and therefore never rewrites — and reads it back afterwards. A
 * surviving probe means that literal DOM node survived; a wiped one means the
 * block was rebuilt. That is the difference this item exists to hold onto.
 *
 * What a pass here does NOT prove: nothing in this file exercises the
 * virtualized path, which renders through a separate `{#each virtualRows ...}`
 * and recycles rows rather than keying them by message. `/exercises/virtualization`
 * covers that one.
 */

const TIMELINE_ID = 'row-reconciliation-chat-timeline';

// Mirrors the seed in `+page.svelte`. Kept as literals rather than imported so a
// change to the fixture shows up here as a failing assertion instead of being
// silently absorbed by a shared constant.
const SEEDED_ROW_COUNT = 5;
const TARGET_BODY = 'Charlie row';

function timeline(page: Page) {
	return page.getByRole('log', { name: 'Messages' });
}

function rows(page: Page) {
	return timeline(page).locator('.chat-message');
}

/**
 * Stamp every currently-rendered row article with its index.
 *
 * `data-probe` is written from the test, not by the component, so Svelte has no
 * reason to touch it on a re-render. It therefore lives and dies with the DOM
 * node itself, which is what makes it a reconciliation probe rather than a
 * decoration.
 *
 * Stamped on the `.chat-message` ARTICLE rather than its `.chat-message-wrapper`
 * parent on purpose: the wrapper renders `{...rest}`, and the spread path is the
 * one place Svelte diffs and deletes attributes rather than only writing them.
 * The article takes each of its attributes individually, so there is no
 * reconciliation pass that could reach this one.
 */
async function stampRowProbes(page: Page): Promise<void> {
	await rows(page).evaluateAll((articles) => {
		articles.forEach((article, index) => article.setAttribute('data-probe', String(index)));
	});
}

/** The probe each rendered row is carrying, in DOM order. `null` means a node that was not stamped — i.e. one created since. */
function rowProbes(page: Page): Promise<(string | null)[]> {
	return rows(page).evaluateAll((articles) =>
		articles.map((article) => article.getAttribute('data-probe'))
	);
}

function activeElementSummary(page: Page): Promise<{ id: string; onBody: boolean }> {
	return page.evaluate(() => ({
		id: document.activeElement?.id ?? '',
		onBody: document.activeElement === document.body
	}));
}

test('a message appended after first render is inserted, leaving the existing rows in place', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/row-reconciliation');

	await expect(rows(page)).toHaveCount(SEEDED_ROW_COUNT);
	await stampRowProbes(page);

	await page.getByTestId('append-message').click();

	await expect(rows(page)).toHaveCount(SEEDED_ROW_COUNT + 1);
	await expect(timeline(page).getByText('Foxtrot row 1')).toBeVisible();
	await expect(page.getByTestId('stored-id-count')).toHaveText('6');

	// The five seeded articles are the SAME NODES they were before the append,
	// and the sixth is new. Under a rebuild every entry here would read `null`.
	expect(await rowProbes(page)).toEqual(['0', '1', '2', '3', '4', null]);
});

test('removing a non-first message drops exactly that row and keeps the survivors', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/row-reconciliation');

	await expect(rows(page)).toHaveCount(SEEDED_ROW_COUNT);
	await expect(timeline(page).getByText(TARGET_BODY)).toBeVisible();
	await stampRowProbes(page);

	// The button removes index 2, never index 0. Chat keys its static row list
	// with `{#key staticRowsResetIdentity}` where that identity is
	// `messages[0]?.id`, so removing the first message changes the key and
	// rebuilds the entire block — the row would vanish and the count would drop
	// without a single reconciliation step having run. The probe assertion below
	// is what would catch that substitution.
	await page.getByTestId('remove-target').click();

	await expect(rows(page)).toHaveCount(SEEDED_ROW_COUNT - 1);
	await expect(timeline(page).getByText(TARGET_BODY)).toHaveCount(0);
	await expect(page.getByTestId('stored-id-count')).toHaveText('4');
	await expect(page.getByTestId('target-still-stored')).toHaveText('no');

	// Exactly one node left, the four around it are the originals, and they are
	// still in their original order.
	expect(await rowProbes(page)).toEqual(['0', '1', '3', '4']);
});

test('hidden: true removes the row while the message stays in the conversation', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/row-reconciliation');

	await expect(rows(page)).toHaveCount(SEEDED_ROW_COUNT);
	await stampRowProbes(page);

	await page.getByTestId('hide-target').click();

	await expect(rows(page)).toHaveCount(SEEDED_ROW_COUNT - 1);
	await expect(timeline(page).getByText(TARGET_BODY)).toHaveCount(0);

	// The half that separates hiding from deleting, and the reason this test is
	// not a duplicate of the one above. Chat reads its transcript with
	// `getMessages(conversation)` and no options, which excludes hidden messages
	// — so the row is gone from the DOM while the message is still in `ids` and
	// still in `messages`. Assert both sides together: `stored-id-count` proves
	// the id survived, `rendered-id-count` proves the transcript Chat renders
	// shrank, and `target-hidden` names the mechanism. Drop any one of the three
	// and a `hidden` that had been reimplemented as a delete would still pass.
	await expect(page.getByTestId('stored-id-count')).toHaveText('5');
	await expect(page.getByTestId('rendered-id-count')).toHaveText('4');
	await expect(page.getByTestId('target-still-stored')).toHaveText('yes');
	await expect(page.getByTestId('target-hidden')).toHaveText('yes');
	expect(await rowProbes(page)).toEqual(['0', '1', '3', '4']);

	// Unhiding is an insertion into the middle of a keyed list with no append
	// anywhere — the other direction of the same reconciliation, and the case a
	// frozen list gets wrong in the same silent way. The returning row is a new
	// node (`null`); its four neighbours are not.
	await page.getByTestId('unhide-target').click();

	await expect(rows(page)).toHaveCount(SEEDED_ROW_COUNT);
	await expect(timeline(page).getByText(TARGET_BODY)).toBeVisible();
	await expect(page.getByTestId('rendered-id-count')).toHaveText('5');
	await expect(page.getByTestId('target-hidden')).toHaveText('no');
	expect(await rowProbes(page)).toEqual(['0', '1', null, '3', '4']);
});

test('focus backstop: removing the focused row with no scroll reclaims focus to the timeline', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/row-reconciliation');

	const log = timeline(page);
	await expect(rows(page)).toHaveCount(SEEDED_ROW_COUNT);

	// PRECONDITION, and the thing that makes this test about the RENDERED-SET
	// path specifically rather than "some backstop trigger fired".
	//
	// The backstop has two triggers. One is a scroll-state recompute, which is
	// how a virtualizer recycling a row reaches it; the other is an `$effect`
	// that reads both rendered sets and therefore reruns on any add or remove.
	// ROADMAP I-1 asks for the second one, and every route into the first runs
	// through a `scroll` or `scrollend` listener on this element. A transcript
	// that does not overflow emits neither, so proving the timeline is not
	// scrollable is what excludes trigger one. If the fixture ever grows past
	// its box, this fails here — naming its own cause — instead of quietly
	// pinning the other trigger.
	const geometry = await log.evaluate((element) => ({
		scrollHeight: element.scrollHeight,
		clientHeight: element.clientHeight
	}));
	expect(
		geometry.scrollHeight,
		`the timeline must not be scrollable, or the backstop's scroll trigger is in play too: ${JSON.stringify(geometry)}`
	).toBeLessThanOrEqual(geometry.clientHeight);

	// PRECONDITION. The reclaim is guarded on `document.hasFocus()` — deliberately,
	// so it never steals focus back from another window. If the page does not hold
	// focus the backstop silently declines to run and the assertion below would
	// read as a component failure. Assert it up front so the failure is attributed.
	expect(
		await page.evaluate(() => document.hasFocus()),
		'the page must hold focus; the backstop refuses to reclaim otherwise'
	).toBe(true);

	// Park focus on the third row using nothing but the component's own keyboard
	// navigation. This is not stylistic fussiness — EVERY intervening pointer or
	// tab-stop disarms the mechanism under test:
	//
	// - `focusout` on the timeline clears the tracked row for any non-null
	//   `relatedTarget`, so tabbing (or clicking) to a control forgets it.
	// - a capture-phase `pointerdown` listener on `document` clears it for any
	//   pointer landing outside Chat's container, so even clicking a control that
	//   never takes focus is enough.
	//
	// Anyone "simplifying" the walk below into a click on `remove-target` will get
	// a green test that proves nothing at all: focus would already be untracked,
	// no reclaim would be attempted, and focus would sit wherever the click left it.
	//
	// `log.focus()` moves focus onto the timeline itself, which the component
	// treats as "no row tracked" — so entry cannot pre-arm anything. The row focus
	// that follows comes entirely from real ArrowDown keystrokes routed through
	// Chat's own nav helper: the first lands on row one (nothing focused yet means
	// "start at the first"), and each subsequent one steps down.
	await log.focus();
	await expect.poll(() => activeElementSummary(page)).toEqual({ id: TIMELINE_ID, onBody: false });

	for (let step = 0; step < 3; step += 1) {
		await page.keyboard.press('ArrowDown');
	}

	const targetMessageId = (await page.getByTestId('target-message-id').textContent())?.trim() ?? '';
	expect(targetMessageId).not.toBe('');
	await expect
		.poll(() => activeElementSummary(page))
		.toEqual({ id: `message-${targetMessageId}`, onBody: false });

	// The removal, delivered by a key the component does not consume, while focus
	// is still on the row it is about to unmount. Chat's keydown handler claims
	// only Home/End/PageUp/PageDown/ArrowUp/ArrowDown and Ctrl/Cmd+F, so Delete
	// reaches the page's own window listener untouched.
	await page.keyboard.press('Delete');

	await expect(rows(page)).toHaveCount(SEEDED_ROW_COUNT - 1);
	// Names the path that fired. Without it, a Delete that never reached the page
	// and a backstop that never ran produce the same red, and the failure below
	// would be ambiguous between them.
	await expect(page.getByTestId('last-mutation')).toHaveText('remove:delete-key');

	// The assertion. Browsers drop focus to `<body>` when the focused element is
	// removed, and Chat's keydown handler is bound on the container — so without
	// the backstop every keyboard affordance in the component dies with the row.
	// `onBody: false` is the counterfactual stated explicitly, because "focus is
	// on the timeline" and "focus is nowhere" are the two outcomes this is
	// distinguishing and only one of them is a working chat.
	//
	// What this does NOT establish, engine by engine: the outcome is "focus is on
	// the timeline", not "the backstop put it there". An engine whose own
	// focus-fixup walks to the nearest focusable ancestor would land on the same
	// element — the timeline is that ancestor, `tabindex="0"` and all — and would
	// satisfy this without the component doing anything. Chromium moves focus to
	// `<body>`, which is why the reclaim exists at all; if this ever passes on an
	// engine where neutering the reclaim does not turn it red, that engine is
	// answering for itself and is worth recording rather than assuming.
	await expect.poll(() => activeElementSummary(page)).toEqual({ id: TIMELINE_ID, onBody: false });
});
