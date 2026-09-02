import { expect, test } from '@playwright/test';
import { appendUserMessage, createConversationHistory } from 'conversationalist';
import { gotoHydrated } from './exercises/hydration';
import {
	APPROVAL_FOLLOW_UP_TEXT,
	APPROVAL_NOTE_TEXT,
	FIXTURE_ORIGIN,
	GATED_FIRST_CHUNK,
	GATED_SECOND_CHUNK,
	HOLD_PARTIAL_TEXT,
	STEPPED_CHUNKS,
	TOOL_ARGUMENTS_FIRST_HALF,
	TOOL_CALL_NAME,
	TOOL_FOLLOW_UP_TEXT,
	fixtureMarker
} from './streaming-fixture';

test('sends a message and streams the assistant reply into the conversation log', async ({
	page
}) => {
	await page.route('**/api/chat', async (route) => {
		const events = [
			{ type: 'text', text: 'Hello ' },
			{ type: 'text', text: 'there!' }
		];
		const body = events.map((event) => JSON.stringify(event)).join('\n') + '\n';

		await route.fulfill({
			status: 200,
			contentType: 'application/x-ndjson; charset=utf-8',
			body
		});
	});

	await gotoHydrated(page, '/');

	const composer = page.getByRole('textbox', { name: 'Message' });
	await expect(composer).toBeVisible();

	await composer.fill('Hello from Playwright');
	await page.getByRole('button', { name: 'Send message' }).click();

	const log = page.getByRole('log', { name: 'Messages' });
	await expect(log.getByText('Hello from Playwright')).toBeVisible();
	await expect(log.getByText('Hello there!')).toBeVisible();
});

test('stop generating aborts the in-flight request without surfacing an error', async ({
	page
}) => {
	// A request that is never fulfilled keeps the turn in its streaming state
	// so Stop is clickable; the client-side abort is the only way it ends,
	// and Chromium reports that abort as a failed request.
	let requestAborted = false;
	page.on('requestfailed', (request) => {
		if (request.url().includes('/api/chat')) requestAborted = true;
	});
	await page.route('**/api/chat', () => {
		// Intentionally left pending — see above.
	});

	await gotoHydrated(page, '/');
	const composer = page.getByRole('textbox', { name: 'Message' });
	await composer.fill('Long question, interrupted');
	await page.getByRole('button', { name: 'Send message' }).click();

	await page.getByRole('button', { name: 'Stop generating' }).click();

	// Streaming state fully unwinds: the composer is sendable again and the error
	// region is EMPTY — a user-initiated stop is not a failure.
	//
	// Empty rather than absent, and that is the point of ROADMAP A11Y-3: the page
	// banner is now permanently mounted with no text, because a live region has to
	// exist before the content arrives or the announcement is not reliably made.
	// Counting alerts would now count that empty region and report a failure the
	// user never saw; asserting its TEXT is what the claim was always about.
	await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
	await expect(page.getByTestId('demo-error')).toBeEmpty();
	await expect.poll(() => requestAborted).toBe(true);
});

test('editing a user message rewinds the superseded branch and resends', async ({ page }) => {
	const replies = ['First reply.', 'Second reply.'];
	const requestBodies: string[] = [];
	await page.route('**/api/chat', async (route) => {
		requestBodies.push(route.request().postData() ?? '');
		const text = replies[requestBodies.length - 1] ?? 'Extra reply.';
		await route.fulfill({
			status: 200,
			contentType: 'application/x-ndjson; charset=utf-8',
			body: JSON.stringify({ type: 'text', text }) + '\n'
		});
	});

	await gotoHydrated(page, '/');
	const chat = page.locator('#chatroom-demo-chat');
	const composer = page.getByRole('textbox', { name: 'Message' });
	await composer.fill('Original question');
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(chat.getByText('First reply.')).toBeVisible();

	const editButton = chat.getByRole('button', { name: 'Edit message' });
	await editButton.focus();
	await editButton.click();
	const editBox = chat.getByRole('textbox', { name: 'Edit message content' });
	await editBox.fill('Edited question');
	await chat.getByRole('button', { name: 'Save & Resend' }).click();

	await expect(chat.getByText('Second reply.')).toBeVisible();
	// The superseded branch is gone from the transcript…
	await expect(chat.getByText('Original question')).toHaveCount(0);
	await expect(chat.getByText('First reply.')).toHaveCount(0);
	// …and from the payload the model sees: the resent conversation contains
	// the edited content and none of the superseded messages.
	expect(requestBodies).toHaveLength(2);
	expect(requestBodies[1]).toContain('Edited question');
	expect(requestBodies[1]).not.toContain('Original question');
	expect(requestBodies[1]).not.toContain('First reply.');
});

test('retry after a failed send re-runs the assistant turn', async ({ page }) => {
	let calls = 0;
	await page.route('**/api/chat', async (route) => {
		calls += 1;
		if (calls === 1) {
			await route.fulfill({ status: 500, body: 'Simulated upstream failure' });
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/x-ndjson; charset=utf-8',
			body: JSON.stringify({ type: 'text', text: 'Recovered reply.' }) + '\n'
		});
	});

	await gotoHydrated(page, '/');
	const chat = page.locator('#chatroom-demo-chat');
	const composer = page.getByRole('textbox', { name: 'Message' });
	await composer.fill('Please fail once');
	await page.getByRole('button', { name: 'Send message' }).click();

	// Two alerts appear: the page-level error banner and Chat's own
	// "Failed to send" label on the failed user message.
	await expect(
		page.getByRole('alert').filter({ hasText: 'Simulated upstream failure' })
	).toBeVisible();
	await expect(page.getByRole('alert').filter({ hasText: 'Failed to send' })).toBeVisible();

	const retryButton = chat.getByRole('button', { name: 'Retry' });
	await retryButton.focus();
	await retryButton.click();

	await expect(chat.getByText('Recovered reply.')).toBeVisible();
	// Both the error banner and the failed mark clear on success. The banner
	// clears by emptying, not by unmounting — see the note in the stop-generating
	// test above.
	await expect(page.getByTestId('demo-error')).toBeEmpty();
	await expect(page.getByRole('alert').filter({ hasText: 'Failed to send' })).toHaveCount(0);
	expect(calls).toBe(2);
});

// ROADMAP HS-2, first half: the signature check on `/api/chat/resume`.
//
// This one needs no fixture and no API key, because armorer's verification is
// stateless — an HMAC over the descriptor the client submits, with no
// server-side pending-approval store to prime. So `/api/chat` can be mocked in
// the usual way while `/api/chat/resume` runs for real, which is the narrowest
// arrangement that still puts the real route, the real zod schema, and the real
// `toolbox.resumeApproval` on the path.
//
// What it pins that `/exercises/tool-approval` cannot: that exercise performs no
// network I/O at all and seeds approvals with no `pendingApproval` and no token,
// so it proves Chat's affordances and nothing about the round trip.
//
// The `pendingApproval` below is a forgery, but a faithful one — field for field
// the shape armorer really mints for `remember_note` (`reason` and `metadata`
// included, and a well-formed 64-character hex token), so a rejection here is
// the signature failing rather than the schema or the token's format.
test('a forged approvalToken is rejected by the real resume route', async ({ page }) => {
	const callId = 'call-forged-token';
	const approvalMessage = 'Save this note?';

	await page.route('**/api/chat', async (route) => {
		// Both lines matter: Chat renders the approval prompt on the tool-CALL
		// row with the result folded in, so a result on its own would never
		// surface an Approve button.
		const events = [
			{ type: 'tool_call', id: callId, name: 'remember_note', arguments: { text: 'A note' } },
			{
				type: 'tool_result',
				callId,
				outcome: 'action_required',
				content: approvalMessage,
				action: { type: 'approval', message: approvalMessage },
				pendingApproval: {
					callId,
					toolName: 'remember_note',
					arguments: { text: 'A note' },
					action: { type: 'approval', message: approvalMessage },
					reason: approvalMessage,
					metadata: {},
					approvalToken: 'a'.repeat(64)
				}
			}
		];

		await route.fulfill({
			status: 200,
			contentType: 'application/x-ndjson; charset=utf-8',
			body: events.map((event) => JSON.stringify(event)).join('\n') + '\n'
		});
	});

	await gotoHydrated(page, '/');
	const chat = page.locator('#chatroom-demo-chat');
	await page.getByRole('textbox', { name: 'Message' }).fill('Remember something for me');
	await page.getByRole('button', { name: 'Send message' }).click();

	const approve = chat.getByRole('button', { name: 'Approve' });
	await expect(approve).toBeVisible();

	const resumed = page.waitForResponse('**/api/chat/resume');
	await approve.click();
	const response = await resumed;

	// The request shape is the client's, not the fixture's: `+page.svelte` builds
	// the `{ approval, decision }` envelope and decides what goes in it.
	const posted = JSON.parse(response.request().postData() ?? '{}');
	expect(posted.decision).toBe('approve');
	expect(posted.approval.callId).toBe(callId);
	expect(posted.approval.toolName).toBe('remember_note');
	expect(posted.approval.arguments).toEqual({ text: 'A note' });
	expect(posted.approval.action).toEqual({ type: 'approval', message: approvalMessage });
	expect(posted.approval.approvalToken).toBe('a'.repeat(64));

	// 500, not 400, is the load-bearing distinction. A 400 would mean the route's
	// zod schema rejected the envelope before verification ever ran, which is
	// what a client sending the wrong shape (a missing `approvalToken`, a bare
	// descriptor with no `decision`) produces. Reaching a 500 means the shape was
	// accepted and `toolbox.resumeApproval` threw on the signature.
	//
	// That the failure is a raw 500 rather than a 4xx is a gap in
	// `src/routes/api/chat/resume/+server.ts`, which does not catch armorer's
	// throw. Asserted as-is rather than papered over: tightening it is a change
	// to that route, and this assertion is what would catch the change.
	expect(response.status()).toBe(500);
	expect(await response.text()).not.toContain('Invalid request body');

	// The client surfaces the failure and leaves the transcript alone —
	// `replaceToolResult` never runs, so the result is still `action_required`.
	//
	// Chat's own prompt, by contrast, flips to "Approved": `approveToolCall`
	// resolves normally after setting `error`, so Chat's optimistic commit is
	// never rolled back. Consumer-side behavior, not a Chat defect — Chat rolls
	// back on a REJECTED adapter call, and this adapter does not reject.
	await expect(page.getByTestId('demo-error')).not.toBeEmpty();
	await expect(chat.locator('.tool-call-group')).toHaveAttribute('data-status', 'action-required');
});

// ROADMAP HS-1 and the second half of HS-2, against `streaming-fixture.ts`.
//
// Nothing below mocks the network. The app talks to the real `/api/chat`, which
// talks to the real Anthropic SDK, which talks to the fixture because the
// preview server's `ANTHROPIC_BASE_URL` points there. That is the whole reason
// this block exists: every other test on this page replaces the server, so none
// of them can observe a body arriving in pieces, and none of them can obtain an
// `approvalToken` the running server would actually accept (the signing secret
// is a per-process `crypto.randomUUID()` that never leaves it).
//
// REQUIRES TWO LINES IN `playwright.config.ts` — the `webServer` entry that
// starts the fixture, and `env: { ANTHROPIC_BASE_URL }` on the preview entry.
// Without them these tests fail; `expectFixtureHandled` is what turns that into
// a legible failure instead of a mystified timeout. Every `webServer` entry sets
// `reuseExistingServer: false` (CIN-509), so a preview started by hand without
// the env var is not adopted: Playwright refuses to start while its port is
// held (`http://localhost:4173 is already used …`), which is the signal to stop
// that server rather than a reason to doubt the config.
test.describe('production streaming path', () => {
	test.beforeAll(async () => {
		const health = await fetch(`${FIXTURE_ORIGIN}/__fixture/health`).catch(() => undefined);
		if (!health?.ok) {
			throw new Error(
				`No streaming fixture at ${FIXTURE_ORIGIN}. playwright.config.ts needs the ` +
					'`bun src/routes/streaming-fixture.ts` webServer entry (see the header of ' +
					'src/routes/streaming-fixture.ts).'
			);
		}
	});

	// Unique per test AND per browser project: three engines run this file
	// concurrently in separate workers against one fixture process, so gates and
	// counters that were keyed by scenario alone would cross wires.
	function newMarker(): string {
		return crypto.randomUUID();
	}

	async function fixtureRequestCount(marker: string): Promise<number> {
		const response = await fetch(`${FIXTURE_ORIGIN}/__fixture/requests?marker=${marker}`);
		const payload = (await response.json()) as { count: number };
		return payload.count;
	}

	async function fixtureGateHeld(marker: string): Promise<boolean> {
		const response = await fetch(`${FIXTURE_ORIGIN}/__fixture/held?marker=${marker}`);
		const payload = (await response.json()) as { held: boolean };
		return payload.held;
	}

	async function releaseFixtureGate(marker: string): Promise<boolean> {
		const response = await fetch(`${FIXTURE_ORIGIN}/__fixture/release?marker=${marker}`, {
			method: 'POST'
		});
		const payload = (await response.json()) as { released: boolean };
		return payload.released;
	}

	// Proves the turn reached the fixture rather than the real Anthropic API,
	// and says so in the failure message — the difference between "this ran
	// against a preview server that has no ANTHROPIC_BASE_URL" and "the stream
	// rendered wrong" is otherwise invisible from the assertion that follows.
	async function expectFixtureHandled(marker: string): Promise<void> {
		await expect
			.poll(() => fixtureRequestCount(marker), {
				message: `the preview server never reached the fixture for ${marker} — is ANTHROPIC_BASE_URL set on its webServer entry?`
			})
			.toBeGreaterThan(0);
	}

	test('renders a chunk while the response is still open', async ({ page }) => {
		const marker = newMarker();

		await gotoHydrated(page, '/');
		const log = page.getByRole('log', { name: 'Messages' });
		await page
			.getByRole('textbox', { name: 'Message' })
			.fill(`Tell me something ${fixtureMarker('gated', marker)}`);
		await page.getByRole('button', { name: 'Send message' }).click();

		await expectFixtureHandled(marker);

		// The fixture writes this chunk and then parks the response mid-stream.
		await expect(log).toContainText(GATED_FIRST_CHUNK);
		await expect(log).not.toContainText(GATED_SECOND_CHUNK);

		// This is the assertion that makes the absence above mean something. The
		// fixture reports `released: true` only if a response was still parked on
		// this marker's gate at the moment of the call — so the second chunk had
		// not been written when the first was already on screen. Rendering
		// happened DURING the response, not after it.
		//
		// A wait-for-partial-then-sleep version of this test would be pinning a
		// duration; this pins causality, and there is no threshold to tune.
		expect(await releaseFixtureGate(marker)).toBe(true);

		await expect(log).toContainText(`${GATED_FIRST_CHUNK} ${GATED_SECOND_CHUNK}`);
	});

	test('a real signed approvalToken round-trips and re-executes the tool', async ({ page }) => {
		const marker = newMarker();

		await gotoHydrated(page, '/');
		const chat = page.locator('#chatroom-demo-chat');
		await page
			.getByRole('textbox', { name: 'Message' })
			.fill(`Remember something ${fixtureMarker('approval', marker)}`);
		await page.getByRole('button', { name: 'Send message' }).click();

		await expectFixtureHandled(marker);

		// The tool call and its result arrive as separate ndjson lines from a real
		// stream, minted by the real toolbox — `remember_note` is the only tool
		// with an approval policy. That the prompt renders at all answers a
		// question the seeded exercise cannot: whether the affordance survives an
		// incrementally-delivered transcript.
		const approve = chat.getByRole('button', { name: 'Approve' });
		await expect(approve).toBeVisible();
		await expect(chat.locator('.tool-call-group')).toHaveAttribute(
			'data-status',
			'action-required'
		);

		const resumed = page.waitForResponse('**/api/chat/resume');
		await approve.click();
		const response = await resumed;

		const posted = JSON.parse(response.request().postData() ?? '{}');
		expect(posted.decision).toBe('approve');
		expect(posted.approval.toolName).toBe('remember_note');
		expect(posted.approval.arguments).toEqual({ text: APPROVAL_NOTE_TEXT });
		// A 64-character hex digest is what armorer's HMAC-SHA256 signing
		// produces. No fabricated descriptor reaches this test — the token was
		// minted inside the preview process, whose `approvalSecret` is a
		// per-process `crypto.randomUUID()` no test could reproduce.
		expect(posted.approval.approvalToken).toMatch(/^[0-9a-f]{64}$/);

		expect(response.status()).toBe(200);
		expect(await response.json()).toMatchObject({
			outcome: 'success',
			content: { saved: true, text: APPROVAL_NOTE_TEXT }
		});

		// Verification alone would leave the transcript pending: the tool has to
		// have actually run on resume, the client has to have swapped the result
		// in, and the follow-up turn has to have fired.
		await expect(chat.getByRole('region', { name: 'Called 1 tools, 1 complete' })).toBeVisible();
		await expect(page.getByRole('log', { name: 'Messages' })).toContainText(
			APPROVAL_FOLLOW_UP_TEXT
		);
		await expect(page.getByTestId('demo-error')).toBeEmpty();
	});

	// HEADS UP, and the most consequential thing this item turned up: this is the
	// first test in the repo that aborts a REAL `/api/chat` request, and doing so
	// used to kill the server process. The original (pre-Operative) hazard was
	// specific to the raw Anthropic SDK: the route's `cancel()` called
	// `anthropicStream.abort()`, the SDK routed that to its `'abort'` event (not
	// `'error'`), `+server.ts` listened only for `'error'`, and `MessageStream
	// ._emit` took its "no listener, no awaited promise" branch and called
	// `Promise.reject(error)` on nobody's behalf — an unhandled rejection that
	// took the process down under Node's default policy, with vite's own
	// `unhandledRejection` guard disabled when vite runs from `node_modules`
	// (how it runs here).
	//
	// `+server.ts` no longer talks to the Anthropic SDK directly (CIN-434
	// migrated it onto `@lostgradient/operative`'s `AgentRun`), so that specific
	// mechanism no longer applies — but the class of hazard is the same one
	// `pumpChatRun`'s try/catch and the route's one-shot `settled` guard now
	// guard against: an abort reaching `AgentRun.abort()` must never produce an
	// unawaited rejection anywhere in the pump. This test is what would still
	// catch a regression of that class, whatever the underlying mechanism. The
	// liveness check at the end of this test is what attributes the failure here
	// rather than to whichever test ran next.
	//
	// Hence its position: last in this block, so that a run without that fix
	// loses this test rather than this test plus everything declared after it.
	// Tests in a file run in declaration order within a worker, and the two above
	// share the preview server with it.
	test('renders three distinct states of one reply, each while the response is still open', async ({
		page
	}) => {
		const marker = newMarker();

		await gotoHydrated(page, '/');
		const log = page.getByRole('log', { name: 'Messages' });
		await page
			.getByRole('textbox', { name: 'Message' })
			.fill(`Walk me through it ${fixtureMarker('stepped', marker)}`);
		await page.getByRole('button', { name: 'Send message' }).click();

		await expectFixtureHandled(marker);

		// State one: the first chunk alone, with the fixture parked on gate one.
		await expect(log).toContainText(STEPPED_CHUNKS[0]);
		await expect(log).not.toContainText(STEPPED_CHUNKS[1]);
		expect(await releaseFixtureGate(marker)).toBe(true);

		// State two: two chunks, parked on gate two. `released: true` again is
		// what proves the third chunk did not exist yet when two were on screen —
		// three causally separated renders of one assistant message, not one
		// render of a buffered whole.
		await expect(log).toContainText(`${STEPPED_CHUNKS[0]} ${STEPPED_CHUNKS[1]}`);
		await expect(log).not.toContainText(STEPPED_CHUNKS[2]);
		expect(await releaseFixtureGate(marker)).toBe(true);

		// State three: the complete reply, and the turn has unwound.
		await expect(log).toContainText(STEPPED_CHUNKS.join(' '));
		await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(page.getByTestId('demo-error')).toBeEmpty();
	});

	test('typed stream:tool-call-start and -delta frames are on the wire before the tool block closes', async ({
		page
	}) => {
		const marker = newMarker();
		// The same shape `+page.svelte` POSTs — built with the same library —
		// but read raw here, because the rendered UI cannot show a frame that
		// `session-controller.ts` does not render yet (CIN-437/438 do that).
		// This proves the server half of CIN-436's contract on its own.
		const conversation = appendUserMessage(
			createConversationHistory({ id: `wire-${marker}` }),
			`Roll for me ${fixtureMarker('tool', marker)}`
		);

		await gotoHydrated(page, '/');

		// Reads `/api/chat` line by line inside the page and resolves the moment a
		// `stream:tool-call-delta` frame lands, leaving the reader open — the
		// fixture is still parked mid-`input_json_delta` at that point, so the
		// frames returned here were written while the tool-use block was open.
		const framesWhileOpen = await page.evaluate(
			async (body) => {
				const response = await fetch('/api/chat', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
				const reader = response.body!.getReader();
				const decoder = new TextDecoder();
				const frames: Array<Record<string, unknown>> = [];
				let buffered = '';
				let sawDelta = false;
				const finished = (async () => {
					for (;;) {
						const { value, done } = await reader.read();
						if (done) break;
						buffered += decoder.decode(value, { stream: true });
						let newline = buffered.indexOf('\n');
						while (newline !== -1) {
							frames.push(JSON.parse(buffered.slice(0, newline)) as Record<string, unknown>);
							buffered = buffered.slice(newline + 1);
							newline = buffered.indexOf('\n');
						}
						if (!sawDelta && frames.some((frame) => frame['type'] === 'stream:tool-call-delta')) {
							sawDelta = true;
							(window as unknown as { __wireSnapshot: unknown }).__wireSnapshot = [...frames];
						}
					}
					return frames;
				})();
				(window as unknown as { __wireFinished: Promise<unknown> }).__wireFinished = finished;
				// Poll the snapshot rather than racing `finished`: the response stays
				// open until the fixture gate is released, which is the whole point.
				for (;;) {
					const snapshot = (window as unknown as { __wireSnapshot?: unknown }).__wireSnapshot;
					if (snapshot) return snapshot as Array<Record<string, unknown>>;
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
			},
			{ conversation }
		);

		// `released: true` is the causal claim: the fixture was still parked
		// before `content_block_stop` when these frames had already been read.
		expect(await releaseFixtureGate(marker)).toBe(true);

		const types = framesWhileOpen.map((frame) => frame['type']);
		expect(types).toContain('stream:tool-call-start');
		expect(types).toContain('stream:tool-call-delta');
		expect(types).not.toContain('stream:tool-call-complete');
		expect(types).not.toContain('tool_call');
		const start = framesWhileOpen.find((frame) => frame['type'] === 'stream:tool-call-start');
		expect(start).toMatchObject({ toolName: TOOL_CALL_NAME, blockId: `toolu_${marker}` });
		const delta = framesWhileOpen.find((frame) => frame['type'] === 'stream:tool-call-delta');
		expect(delta).toMatchObject({
			toolName: TOOL_CALL_NAME,
			blockId: `toolu_${marker}`,
			partialArguments: TOOL_ARGUMENTS_FIRST_HALF
		});

		// After release: the block completes, the tool runs, and exactly one
		// terminal frame closes a strictly sequenced wire.
		const allFrames = await page.evaluate(
			() => (window as unknown as { __wireFinished: Promise<unknown> }).__wireFinished
		);
		const all = allFrames as Array<Record<string, unknown>>;
		all.forEach((frame, index) => {
			expect(frame['wireVersion']).toBe(1);
			expect(frame['sequence']).toBe(index);
		});
		const allTypes = all.map((frame) => frame['type']);
		expect(allTypes).toContain('stream:tool-call-complete');
		expect(allTypes).toContain('tool.started');
		expect(allTypes).toContain('tool.settled');
		expect(allTypes).toContain('tool_call');
		expect(allTypes).toContain('tool_result');
		expect(allTypes.filter((type) => String(type).startsWith('run.'))).toEqual(['run.completed']);
		expect(allTypes.at(-1)).toBe('run.completed');
	});

	test('a tool call streams through the UI to a follow-up reply', async ({ page }) => {
		const marker = newMarker();

		await gotoHydrated(page, '/');
		const log = page.getByRole('log', { name: 'Messages' });
		await page
			.getByRole('textbox', { name: 'Message' })
			.fill(`Roll for me ${fixtureMarker('tool', marker)}`);
		await page.getByRole('button', { name: 'Send message' }).click();

		await expectFixtureHandled(marker);

		// The response is parked mid-arguments; nothing about the widened wire
		// vocabulary may break the legacy-only client while it waits.
		await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible();
		await expect(page.getByTestId('demo-error')).toBeEmpty();
		expect(await releaseFixtureGate(marker)).toBe(true);

		// The client's continuation loop re-POSTs after a resolved tool result,
		// and the fixture answers the second turn with plain text.
		await expect(log).toContainText(TOOL_FOLLOW_UP_TEXT);
		await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(page.getByTestId('demo-error')).toBeEmpty();
		expect(await fixtureRequestCount(marker)).toBe(2);
	});

	test('stop generating keeps the partial reply that already streamed in', async ({ page }) => {
		const marker = newMarker();

		await gotoHydrated(page, '/');
		const log = page.getByRole('log', { name: 'Messages' });
		await page
			.getByRole('textbox', { name: 'Message' })
			.fill(`Long answer please ${fixtureMarker('hold', marker)}`);
		await page.getByRole('button', { name: 'Send message' }).click();

		await expectFixtureHandled(marker);

		// Ordering is the point of this test. The partial text has to be on screen
		// BEFORE Stop is clicked, because that is what puts content in
		// `+page.svelte`'s `buffer` — the sibling test above aborts a request that
		// never delivered a byte, so it can only ever reach the empty-buffer
		// branch. The fixture holds the response open here instead of never
		// answering at all.
		await expect(log).toContainText(HOLD_PARTIAL_TEXT);

		await page.getByRole('button', { name: 'Stop generating' }).click();

		// Send returning means the turn finished unwinding, so the
		// finalize-vs-cancel decision has already been made. Asserting the text
		// before this point would pass even if the abort later discarded it.
		await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);

		// `cancelStreamingMessage` REMOVES the placeholder from the conversation,
		// and Chat's `endStreaming` clears its own token buffer, so this text can
		// only be here because the abort branch finalized instead of cancelling.
		await expect(log).toContainText(HOLD_PARTIAL_TEXT);
		await expect(page.getByTestId('demo-error')).toBeEmpty();

		// The server-side half of the same stop. A dead preview server refuses the
		// connection and this throws rather than returning a failing response, so
		// read a rejection here as the crash described above and not as a routing
		// problem. It is a smoke check and not a proof of absence: it samples one
		// moment, and a crash that lands after it would surface in the next test
		// instead.
		const alive = await page.request.get('/');
		expect(alive.ok()).toBe(true);
	});

	test('stop generating mid tool call leaves no placeholder, no error, and a live server', async ({
		page
	}) => {
		const marker = newMarker();

		await gotoHydrated(page, '/');
		const log = page.getByRole('log', { name: 'Messages' });
		await page
			.getByRole('textbox', { name: 'Message' })
			.fill(`Roll for me ${fixtureMarker('tool', marker)}`);
		await page.getByRole('button', { name: 'Send message' }).click();

		await expectFixtureHandled(marker);
		await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible();

		// Abort while the fixture is parked inside the tool-use block: the
		// server has written `stream:tool-call-start`/`-delta` and nothing
		// renderable. The abort must land as a silent stop — no banner, no
		// dangling assistant placeholder — and the route's `run.aborted`
		// terminal must not be mistaken for a failure.
		await page.getByRole('button', { name: 'Stop generating' }).click();

		await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
		await expect(page.getByTestId('demo-error')).toBeEmpty();
		await expect(log.getByRole('article')).toHaveCount(1);

		// The abort SHOULD reach the fixture — SvelteKit cancels the ndjson
		// stream, the route aborts the run, Operative aborts the upstream
		// request, the fixture's `gate` sees the socket close — and CIN-513 adds
		// `await expect.poll(() => fixtureGateHeld(marker)).toBe(false)` here.
		// Today it does not: Operative 0.8.0's Anthropic provider puts the abort
		// signal in the request BODY instead of the SDK's `RequestOptions`
		// (AB-189), so the upstream request stays parked. Read the probe for the
		// trace, then release the gate so the leaked run can unwind instead of
		// outliving the test.
		const heldAfterAbort = await fixtureGateHeld(marker);
		expect(typeof heldAfterAbort).toBe('boolean');
		await releaseFixtureGate(marker);

		const alive = await page.request.get('/');
		expect(alive.ok()).toBe(true);
	});
});
