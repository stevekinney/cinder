/**
 * The approval flow under Operative's own loop.
 *
 * The machinery these specs exercise — the signed `SignedPendingToolApproval`,
 * the host-owned toolbox, `/api/chat/resume`, the client's reconciliation —
 * already existed. What did not exist was proof that the run *parks* rather
 * than loops: that after a step produces an approval-gated tool call, the
 * response ends there with no further generate call, and control genuinely
 * returns to the client.
 *
 * The fixture's request counter is what makes that assertable. Rendering
 * cannot distinguish "parked" from "took another turn and happened to say
 * nothing"; a provider-call count can.
 *
 * Every count here is read only after the response has closed. An extra
 * generate call from a regressed stop condition would happen INSIDE that same
 * response, so sampling while the stream is still open could see a transient
 * 1 and pass on a run that was still going.
 */

import { expect, test, type Page } from '@playwright/test';

import { gotoHydrated } from '../../exercises/hydration';
import { fixtureRequestCount, newFixtureMarker } from '../../fixture-probe';
import {
	APPROVAL_FOLLOW_UP_TEXT,
	APPROVAL_NOTE_TEXT,
	fixtureMarker
} from '../../streaming-fixture';

/**
 * Drives a turn to a settled park: the approval prompt on screen AND the
 * response closed.
 *
 * Both halves matter. The prompt alone says the descriptor rendered; the
 * closed response is what makes a provider count meaningful.
 */
async function parkOnApproval(page: Page): Promise<string> {
	const marker = newFixtureMarker();

	await gotoHydrated(page, '/');
	await page
		.getByRole('textbox', { name: 'Message' })
		.fill(`Remember something ${fixtureMarker('approval', marker)}`);
	await page.getByRole('button', { name: 'Send message' }).click();

	await expect(
		page.locator('#chatroom-demo-chat').getByRole('button', { name: 'Approve' })
	).toBeVisible();
	// The cancel affordance only disappears once the response has closed, so
	// this is the settle signal — not a duration.
	await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);

	return marker;
}

test('parks after the approval-gated step, taking no further generate call', async ({ page }) => {
	const marker = await parkOnApproval(page);

	// One provider call for the whole turn, read after the response closed.
	// Without a stop condition covering a step that produced a tool call,
	// Operative would resolve the tool and take a second generate call to
	// narrate the result inside this same response — a billed turn the client
	// never asked for, and the shape that collides with the session
	// controller's own continuation loop.
	//
	// Which predicate fires is deliberately not claimed here. `chat-agent.ts`
	// documents that `stopAfterAnyToolCall` already covers every approval-gated
	// call, making `stopWhen.pendingApproval()` redundant on this path; a spec
	// cannot distinguish them without removing one. What is asserted is the
	// contract they exist to produce.
	expect(await fixtureRequestCount(marker)).toBe(1);
	await expect(page.getByTestId('demo-error')).toBeEmpty();
});

test('surfaces the pending approval descriptor as tool activity', async ({ page }) => {
	const marker = await parkOnApproval(page);
	const chat = page.locator('#chatroom-demo-chat');

	// `action-required` is the descriptor reaching the client, not a spinner
	// that happens to look similar: the group carries the status because a
	// `pendingApproval` rode the tool result over the wire.
	await expect(chat.locator('.tool-call-group')).toHaveAttribute('data-status', 'action-required');

	// The tool's own name rides that descriptor into the disclosure label, so
	// this fails if the prompt renders from a generic placeholder rather than
	// from what the run actually parked on.
	await expect(
		chat.getByRole('button', { name: 'Expand remember_note, Action required' })
	).toBeVisible();
	await expect(chat.getByRole('button', { name: 'Approve' })).toBeVisible();
	await expect(chat.getByRole('button', { name: 'Reject' })).toBeVisible();

	expect(await fixtureRequestCount(marker)).toBe(1);
});

test('approving resumes through the host-owned toolbox and the result rejoins the run', async ({
	page
}) => {
	const marker = await parkOnApproval(page);
	const chat = page.locator('#chatroom-demo-chat');

	const resumed = page.waitForResponse('**/api/chat/resume');
	await chat.getByRole('button', { name: 'Approve' }).click();
	const response = await resumed;

	expect(response.status()).toBe(200);
	expect(await response.json()).toMatchObject({
		outcome: 'success',
		content: { saved: true, text: APPROVAL_NOTE_TEXT }
	});

	// The token was minted by the streaming route and verified by the resume
	// route. `approvalSecret` is a per-process `crypto.randomUUID()` held by the
	// module in `$lib/toolbox`, so a resume route that built its own toolbox
	// would hold a different secret and reject this signature outright. A 200
	// with the tool's real output is that shared instance, observed at runtime;
	// `toolbox-ownership.test.ts` pins the structural half.
	const posted = JSON.parse(response.request().postData() ?? '{}') as {
		approval: { approvalToken: string; toolName: string };
	};
	expect(posted.approval.toolName).toBe('remember_note');
	expect(posted.approval.approvalToken).toMatch(/^[0-9a-f]{64}$/);

	// The resolved result is visible to the model on the next turn: the
	// follow-up text only exists on the fixture's second attempt.
	await expect(page.getByRole('log', { name: 'Messages' })).toContainText(APPROVAL_FOLLOW_UP_TEXT);
	await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
	await expect(page.getByTestId('demo-error')).toBeEmpty();

	// Exactly one further generate call — the continuation, and nothing else.
	// That call happens because the client resumed, not because the run kept
	// going on its own.
	expect(await fixtureRequestCount(marker)).toBe(2);
});

test('approves from the keyboard alone', async ({ page }) => {
	const marker = await parkOnApproval(page);
	const approve = page.locator('#chatroom-demo-chat').getByRole('button', { name: 'Approve' });

	const resumed = page.waitForResponse('**/api/chat/resume');

	// A real key event on the control, not a synthetic click. `.click()` alone
	// would keep passing if the handler were bound to a pointer event and the
	// prompt were unusable for anyone driving the page from a keyboard.
	//
	// Tab-order reachability is a separate claim and is deliberately not made
	// here: a Tab walk reached the control on Chromium but not on Firefox or
	// WebKit, where the tool-call group presents collapsed behind its
	// disclosure, and I would rather ship no assertion than one whose failure
	// mode I cannot explain. Worth its own issue.
	await approve.press('Enter');
	expect((await resumed).status()).toBe(200);

	await expect(page.getByRole('log', { name: 'Messages' })).toContainText(APPROVAL_FOLLOW_UP_TEXT);
	await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
	expect(await fixtureRequestCount(marker)).toBe(2);
});

test('denying reaches a terminal state without resuming', async ({ page }) => {
	const marker = await parkOnApproval(page);
	const chat = page.locator('#chatroom-demo-chat');

	// A resume request would mean the denial travelled to the server, which is
	// the thing this path must not do — the decision is the client's and the
	// signed approval is discarded locally.
	let resumeRequests = 0;
	await page.route('**/api/chat/resume', async (route) => {
		resumeRequests += 1;
		await route.continue();
	});

	// Labelled "Reject" in the UI; `denyToolCall` is the hook behind it.
	// Keyboard-activated for the same reason the approve path is.
	await chat.getByRole('button', { name: 'Reject' }).press('Enter');

	// The call settles as failed rather than lingering as a prompt nobody can
	// answer. The action-required group is gone entirely — its controls with
	// it — and what remains reads as a resolved, unsuccessful call.
	await expect(chat.locator('.tool-call-group')).toHaveCount(0);
	await expect(chat.getByRole('button', { name: 'Approve' })).toHaveCount(0);
	await expect(chat.getByRole('button', { name: 'Reject' })).toHaveCount(0);
	const settled = chat.getByRole('region', { name: 'Called 1 tools' });
	await expect(settled).toContainText('remember_note');
	await expect(settled).toContainText('Failed');
	await expect(page.getByTestId('demo-error')).toBeEmpty();

	expect(resumeRequests).toBe(0);

	// It is not silent, though, and that is deliberate rather than an oversight
	// worth asserting around: the denial is a RESOLVED tool result, so the
	// session controller's continuation loop takes one more turn carrying it,
	// exactly as it would for any settled call. Two provider calls, both of
	// them the client's doing — never the run continuing past its park.
	await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
	expect(await fixtureRequestCount(marker)).toBe(2);
});
