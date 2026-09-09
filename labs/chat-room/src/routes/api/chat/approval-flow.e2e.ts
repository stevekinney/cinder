/**
 * The approval flow under Operative's own loop.
 *
 * The machinery these specs exercise — the signed `SignedPendingToolApproval`,
 * the host-owned toolbox, `/api/chat/resume`, the client's reconciliation —
 * already existed. What did not exist was proof that the run *parks* rather
 * than loops: that after a step produces an approval-gated tool call, the
 * response ends with no further generate call, and control genuinely returns
 * to the client.
 *
 * The fixture's request counter is what makes that assertable. Rendering
 * cannot distinguish "parked" from "took another turn and happened to say
 * nothing"; a provider-call count can, and it is the same counter for every
 * spec here, so N versus N+1 is a claim about the loop rather than about the
 * transcript.
 */

import { expect, test } from '@playwright/test';

import { fixtureRequestCount, newFixtureMarker } from '../../fixture-probe';
import { gotoHydrated } from '../../exercises/hydration';
import {
	APPROVAL_FOLLOW_UP_TEXT,
	APPROVAL_NOTE_TEXT,
	fixtureMarker
} from '../../streaming-fixture';

/**
 * Drives a turn to the point where the approval prompt is on screen, and
 * returns the marker so the caller can keep asking the fixture about it.
 *
 * Every spec below starts here: the interesting behavior is what happens
 * after the park, and re-deriving the park in each one would put the shared
 * setup out of reach of a single fix.
 */
async function parkOnApproval(page: import('@playwright/test').Page): Promise<string> {
	const marker = newFixtureMarker();

	await gotoHydrated(page, '/');
	await page
		.getByRole('textbox', { name: 'Message' })
		.fill(`Remember something ${fixtureMarker('approval', marker)}`);
	await page.getByRole('button', { name: 'Send message' }).click();

	// The prompt being visible is the signal that the stream closed and the
	// client owns the turn again — not a duration.
	await expect(
		page.locator('#chatroom-demo-chat').getByRole('button', { name: 'Approve' })
	).toBeVisible();

	return marker;
}

test('parks after the approval-gated step, taking no further generate call', async ({ page }) => {
	const marker = await parkOnApproval(page);

	// One request, not two. `stopWhen.pendingApproval()` combined with
	// `stopWhen.noToolCalls()` is what ends the run here; without a stop
	// condition covering this step, Operative would resolve the tool and take
	// another generate call to narrate the result inside the same response —
	// a second billed turn the client never asked for, and the exact shape
	// that collides with the session controller's own continuation loop.
	expect(await fixtureRequestCount(marker)).toBe(1);

	// And it is genuinely parked rather than merely slow: the cancel affordance
	// is gone, which the composer only does once the response has closed.
	await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
	await expect(page.getByTestId('demo-error')).toBeEmpty();
});

test('surfaces the pending approval descriptor as tool activity', async ({ page }) => {
	const marker = await parkOnApproval(page);
	const chat = page.locator('#chatroom-demo-chat');

	// `action-required` is the descriptor reaching the client, not a spinner
	// that happens to look similar: the group carries the status because a
	// `pendingApproval` rode the tool result over the wire.
	await expect(chat.locator('.tool-call-group')).toHaveAttribute('data-status', 'action-required');

	// The tool's own name rides the descriptor through to the disclosure label,
	// so this fails if the prompt renders from a generic placeholder rather
	// than from what the run actually parked on.
	await expect(
		chat.getByRole('button', { name: 'Expand remember_note, Action required' })
	).toBeVisible();
	await expect(chat.getByRole('button', { name: 'Approve' })).toBeVisible();
	await expect(chat.getByRole('button', { name: 'Reject' })).toBeVisible();

	// The turn is still one request at this point — nothing about rendering the
	// prompt costs a generate call.
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
	await expect(page.getByTestId('demo-error')).toBeEmpty();

	// Exactly one further generate call — the continuation, and nothing else.
	// This is the N+1 the park bought: it happens because the client resumed,
	// not because the run kept going on its own.
	await expect.poll(() => fixtureRequestCount(marker)).toBe(2);
});

test('denying reaches a terminal state without resuming', async ({ page }) => {
	const marker = await parkOnApproval(page);
	const chat = page.locator('#chatroom-demo-chat');

	// A resume request would mean the denial travelled to the server, which is
	// the thing this path must not do — the decision is the client's and the
	// approval is discarded locally.
	let resumeRequests = 0;
	await page.route('**/api/chat/resume', async (route) => {
		resumeRequests += 1;
		await route.continue();
	});

	// Labelled "Reject" in the UI; `denyToolCall` is the hook behind it.
	await chat.getByRole('button', { name: 'Reject' }).click();

	// The call settles as failed rather than lingering as a prompt nobody can
	// answer. The action-required group is gone entirely — its controls with
	// it — and what remains reads as a resolved, unsuccessful call.
	await expect(chat.locator('.tool-call-group')).toHaveCount(0);
	await expect(chat.getByRole('button', { name: 'Approve' })).toHaveCount(0);
	await expect(chat.getByRole('button', { name: 'Reject' })).toHaveCount(0);
	await expect(chat.getByRole('region', { name: 'Called 1 tools' })).toContainText('remember_note');
	await expect(chat.getByRole('region', { name: 'Called 1 tools' })).toContainText('Failed');
	await expect(page.getByTestId('demo-error')).toBeEmpty();

	// The point of the path: nothing about a denial reaches the server. The
	// decision is the client's, `denyToolCall` discards the signed approval
	// locally, and the host-owned toolbox never re-executes the tool.
	expect(resumeRequests).toBe(0);

	// It is not silent, though, and that is deliberate rather than an
	// oversight worth asserting around: the denial is a RESOLVED tool result,
	// so the session controller's continuation loop takes one more turn
	// carrying it, exactly as it would for any settled call. Two provider
	// calls, both of them the client's doing — never the run continuing on its
	// own past the park.
	await expect.poll(() => fixtureRequestCount(marker)).toBe(2);
});
