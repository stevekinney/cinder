import { expect, test } from '@playwright/test';
import { appendUserMessage, createConversationHistory } from 'conversationalist';
import { gotoHydrated } from './exercises/hydration';
import {
	fixtureGateHeld,
	fixtureRequestCount,
	newFixtureMarker,
	releaseFixtureGate
} from './fixture-probe';
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

/**
 * How long the in-page reader waits for the first `stream:tool-call-delta`
 * before failing with what it did see. Diagnostic only: the frame arrives in
 * milliseconds when the route works, and the fixture holds the response open
 * until the test releases it, so this deadline is never the thing under test.
 */
const WIRE_SNAPSHOT_DEADLINE_MS = 15_000;

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

// A real descriptor keeps this test coupled to the published approval contract.
// Alter only its signature, preserving the server-minted action and binding.
test('a forged approvalToken is rejected by the real resume route', async ({ page }) => {
	const marker = newFixtureMarker();
	let originalApproval: Record<string, unknown> | undefined;
	let forgedToken: string | undefined;

	await page.route('**/api/chat/resume', async (route) => {
		const posted = route.request().postDataJSON();
		originalApproval = posted.approval;
		const token = posted.approval.approvalToken as string;
		expect(token).toMatch(/^[0-9a-f]{64}$/);
		expect(posted.approval.approvalBinding).toBeDefined();
		forgedToken = (token[0] === 'a' ? 'b' : 'a') + token.slice(1);
		await route.continue({
			postData: JSON.stringify({
				...posted,
				approval: { ...posted.approval, approvalToken: forgedToken }
			})
		});
	});

	await gotoHydrated(page, '/');
	const chat = page.locator('#chatroom-demo-chat');
	await page
		.getByRole('textbox', { name: 'Message' })
		.fill(`Remember something ${fixtureMarker('approval', marker)}`);
	await page.getByRole('button', { name: 'Send message' }).click();

	const approve = chat.getByRole('button', { name: 'Approve' });
	await expect(approve).toBeVisible();
	expect(await fixtureRequestCount(marker)).toBeGreaterThan(0);

	const resumed = page.waitForResponse('**/api/chat/resume');
	await approve.click();
	const response = await resumed;
	const posted = response.request().postDataJSON();
	expect(posted.decision).toBe('approve');
	expect(originalApproval).toBeDefined();
	expect(posted.approval).toEqual({ ...originalApproval, approvalToken: forgedToken });
	expect(posted.approval.toolName).toBe('remember_note');
	expect(posted.approval.arguments).toEqual({ text: APPROVAL_NOTE_TEXT });
	expect(forgedToken).not.toBe(originalApproval?.approvalToken);

	// A schema rejection returns 400 before signature verification. The real
	// route currently lets Armorer's signature error become 500; preserve that
	// assertion so malformed input cannot masquerade as signature rejection.
	expect(response.status()).toBe(500);
	expect(await response.text()).not.toContain('Invalid request body');
	await expect(page.getByTestId('demo-error')).not.toBeEmpty();
	await expect(chat.locator('.tool-call-group')).toHaveAttribute('data-status', 'action-required');
});

// ROADMAP HS-1 and the second half of HS-2, against `streaming-fixture.ts`.
//
// Nothing below mocks the network. The app talks to the real `/api/chat`, which
// drives a real Operative run, whose Anthropic provider talks to the fixture
// because the preview server's `ANTHROPIC_BASE_URL` points there. That is the whole reason
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
	const newMarker = newFixtureMarker;

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
		await expect(chat.getByRole('region', { name: 'Called 1 tool, 1 complete' })).toBeVisible();
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
			async ({ body, deadlineMs }) => {
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
				// The deadline is diagnostic, not a tuning knob — without it a route
				// regression, a fixture failure, or a rejected fetch would hang until
				// Playwright's own timeout with nothing to read.
				const deadline = Date.now() + deadlineMs;
				for (;;) {
					const snapshot = (window as unknown as { __wireSnapshot?: unknown }).__wireSnapshot;
					if (snapshot) return snapshot as Array<Record<string, unknown>>;
					if (Date.now() > deadline)
						throw new Error(
							`No stream:tool-call-delta frame arrived within ${deadlineMs}ms. Frames seen: ${JSON.stringify(
								frames.map((frame) => frame['type'])
							)}`
						);
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
			},
			{ body: { conversation }, deadlineMs: WIRE_SNAPSHOT_DEADLINE_MS }
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

		// Keeping the partial text is only half a correct stop. The other half is
		// upstream: the fixture is still holding an open response for this marker
		// until the socket closes, so the gate clearing is the proof that the
		// abort travelled all the way to the provider request instead of stopping
		// at the browser. `gate` resolves `disconnected` on that close and drops
		// the marker, so the poll clears without anyone releasing it.
		await expect.poll(() => fixtureGateHeld(marker)).toBe(false);

		// And nothing is left to release — a `true` here would mean the gate
		// outlived the abort and this spec merely raced it.
		expect(await releaseFixtureGate(marker)).toBe(false);

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

		// The abort reaches the fixture: SvelteKit cancels the ndjson stream, the
		// route aborts the run, Operative aborts the upstream request, and the
		// fixture's `gate` sees the socket close and drops the marker. Under
		// Operative 0.8.0 this stayed held forever — its Anthropic provider put
		// the abort signal in the request BODY instead of the SDK's
		// `RequestOptions`, so the upstream request was never cancelled (AB-189).
		await expect.poll(() => fixtureGateHeld(marker)).toBe(false);

		// Nothing left to release. A `true` here would mean the gate was still
		// parked and the poll above had merely raced it.
		expect(await releaseFixtureGate(marker)).toBe(false);

		const alive = await page.request.get('/');
		expect(alive.ok()).toBe(true);
	});
});
