/**
 * Focus behaviour on the server-owned approval, in every engine.
 *
 * ITS OWN FILE so it can join a cross-engine shard without dragging
 * `server-owned.e2e.ts` — nineteen tests — along with it. `playwright.config.ts`
 * names focus as the most engine-divergent behaviour in this lab and WebKit's
 * focus-on-removal semantics differ from Chromium's, so a regression here
 * passing only in Chromium would be the silent reduction those shards exist to
 * prevent.
 */

import { expect, test, type Route } from '@playwright/test';

import { gotoHydrated } from '../exercises/hydration';
import { newFixtureMarker } from '../fixture-probe';
import { fixtureMarker } from '../streaming-fixture';

/** A title no other test will collide with, in this run or a previous one. */
const uniqueTitle = (label: string): string =>
	`${label} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type PostOutcome =
	| 'success'
	| 'conflict'
	| 'error'
	| 'network'
	| 'completed-success'
	| 'completed-error';

function assertApprovedPost(route: Route, expectedCallId?: string): void {
	const payload = route.request().postDataJSON() as {
		approved?: unknown;
		callId?: unknown;
	};
	expect(payload.approved).toBe(true);
	if (expectedCallId === undefined) {
		expect(payload.callId).toEqual(expect.any(String));
		expect(payload.callId).not.toBe('');
	} else {
		expect(payload.callId).toBe(expectedCallId);
	}
}

test('answering keeps focus inside the chat', async ({ page }) => {
	// Every path that clears the question removes the focused subtree, and a
	// browser then drops focus to `<body>` — outside the chat's tab context, at
	// the moment the turn resumes. Asserted on the RESULT rather than on the
	// handler, because three separate paths clear `pending` and only one of
	// them used to hand focus off.
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Approval focus');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');

	const marker = newFixtureMarker();
	const composer = page.getByRole('textbox');
	await composer.fill(fixtureMarker('approval', marker));
	await composer.press('Enter');

	const approve = page.locator('[data-testid="approval-approve"]');
	await expect(approve).toBeVisible();

	// FOCUSED BY KEYBOARD, not clicked — a click leaves focus wherever the
	// browser decides, which would let this pass without the handoff.
	await approve.focus();
	await expect(approve).toBeFocused();
	await approve.press('Enter');

	await expect(page.locator('[data-testid="server-owned-chat"]')).toHaveAttribute(
		'data-streaming',
		'false'
	);

	// NOT `<body>`. The visible transcript is where the consequence of the
	// decision is announced, so it is where focus belongs. It must remain a
	// real, visible focus target after the approval subtree is removed.
	const landed = page.getByRole('log', { name: 'Messages' });
	await expect(landed).toBeFocused();
	await expect(landed).toBeVisible();
	const landedGeometry = await landed.evaluate((element) => {
		const rectangle = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return {
			width: rectangle.width,
			height: rectangle.height,
			focusIndicator:
				(style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) ||
				style.boxShadow !== 'none'
		};
	});
	expect(landedGeometry.width).toBeGreaterThan(1);
	expect(landedGeometry.height).toBeGreaterThan(1);
	expect(landedGeometry.focusIndicator).toBe(true);
});

test('a remote answer hands focus back when polling removes the controls', async ({
	page,
	request
}) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Remote approval focus');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');

	const composer = page.getByRole('textbox');
	await composer.fill(fixtureMarker('approval', newFixtureMarker()));
	await composer.press('Enter');
	const approve = page.locator('[data-testid="approval-approve"]');
	await expect(approve).toBeVisible();
	await approve.focus();

	// The detail page does not expose its id as an attribute; derive it from the
	// current URL so the second client answers the exact question being polled.
	const conversationId = new URL(page.url()).pathname.split('/').at(-1);
	if (conversationId === undefined) throw new Error('conversation id missing from detail URL');
	const pending = await request.get(
		`/api/server-owned/conversations/${conversationId}/elicitation`
	);
	const body = (await pending.json()) as { pending: { callId: string } };
	await request.post(`/api/server-owned/conversations/${conversationId}/elicitation`, {
		data: { approved: false, callId: body.pending.callId }
	});

	await expect(approve).toHaveCount(0);
	const landed = page.getByRole('log', { name: 'Messages' });
	await expect(landed).toBeFocused();
	await expect(landed).toBeVisible();
	const landedGeometry = await landed.evaluate((element) => {
		const rectangle = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return {
			width: rectangle.width,
			height: rectangle.height,
			focusIndicator:
				(style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) ||
				style.boxShadow !== 'none'
		};
	});
	expect(landedGeometry.width).toBeGreaterThan(1);
	expect(landedGeometry.height).toBeGreaterThan(1);
	expect(landedGeometry.focusIndicator).toBe(true);
});

test('a remote replacement hands focus back when the pending call changes', async ({ page }) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Replacement approval focus');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');
	await page.getByRole('textbox').fill(fixtureMarker('approval', newFixtureMarker()));
	await page.getByRole('textbox').press('Enter');

	const approve = page.locator('[data-testid="approval-approve"]');
	await expect(approve).toBeVisible();
	await approve.focus();
	await page.route('**/api/server-owned/conversations/*/elicitation', async (route) => {
		if (route.request().method() !== 'GET') return route.continue();
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				pending: {
					toolName: 'remember_note',
					callId: 'remote-call-b',
					message: 'Save the replacement note?',
					arguments: { text: 'replacement' }
				}
			})
		});
	});

	await expect(page.locator('[data-testid="approval-question"]')).toContainText(
		'Save the replacement note?'
	);
	await expect(page.locator('[data-testid="approval-question"]')).toBeFocused();
});

test('stale approval POST outcomes cannot mutate a removed or replaced question', async ({
	page
}) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Stale approval outcome');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');
	await page.getByRole('textbox').fill(fixtureMarker('approval', newFixtureMarker()));
	await page.getByRole('textbox').press('Enter');

	const question = page.locator('[data-testid="approval-question"]');
	const approve = page.locator('[data-testid="approval-approve"]');
	const failure = page.locator('[data-testid="server-owned-turn-failure"]');
	await expect(approve).toBeVisible();

	let remoteState: 'server' | 'removed' | 'replaced' = 'server';
	let releasePost!: () => void;
	let postReady = false;
	let postOutcome: PostOutcome = 'success';
	await page.evaluate(() => {
		const nativeFetch = window.fetch.bind(window);
		type PostGate = { mode: 'fetch' | 'body' | null; ready: boolean; release?: () => void };
		const gate: PostGate = { mode: null, ready: false };
		Object.assign(window, { __approvalPostGate: gate });
		const hold = async (): Promise<void> => {
			gate.ready = true;
			await new Promise<void>((resolve) => {
				gate.release = resolve;
			});
		};
		Object.defineProperty(window, 'fetch', {
			configurable: true,
			writable: true,
			value: async (input: RequestInfo | URL, init?: RequestInit) => {
				const response = await nativeFetch(input, init);
				const url = input instanceof Request ? input.url : String(input);
				const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
				if (
					gate.mode === null ||
					method !== 'POST' ||
					!url.includes('/api/server-owned/conversations/') ||
					!url.endsWith('/elicitation')
				)
					return response;
				// Consume the network body before the question changes: aborting the
				// request can no longer cancel this already-completed response.
				const body = await response.text();
				const completed = new Response(body, {
					status: response.status,
					headers: response.headers
				});
				if (gate.mode === 'body') {
					// Return headers now, so decide passes its first freshness check.
					// Pause the body only when failureMessage actually reads it.
					Object.defineProperty(completed, 'text', {
						value: async () => {
							await hold();
							return body;
						}
					});
				} else {
					await hold();
				}
				return completed;
			}
		});
	});
	await page.route('**/api/server-owned/conversations/*/elicitation', async (route) => {
		if (route.request().method() === 'GET') {
			if (remoteState === 'removed') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: '{"pending":null}'
				});
				return;
			}
			if (remoteState === 'replaced') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						pending: {
							toolName: 'remember_note',
							callId: 'remote-replacement',
							message: 'Save the replacement note?',
							arguments: { text: 'replacement' }
						}
					})
				});
				return;
			}
			await route.continue();
			return;
		}

		assertApprovedPost(route);
		if (postOutcome.startsWith('completed-')) {
			await route.fulfill({
				status: postOutcome === 'completed-error' ? 500 : 200,
				contentType: 'application/json',
				body:
					postOutcome === 'completed-error'
						? JSON.stringify({ error: 'stale approval failed' })
						: '{}'
			});
			postReady = true;
			return;
		}
		await new Promise<void>((resolve) => {
			releasePost = resolve;
			postReady = true;
		});
		if (postOutcome === 'network') {
			await route.abort('failed');
		} else {
			await route.fulfill({
				status: postOutcome === 'conflict' ? 409 : postOutcome === 'error' ? 500 : 200,
				contentType: 'application/json',
				body: postOutcome === 'error' ? JSON.stringify({ error: 'stale approval failed' }) : '{}'
			});
		}
	});

	for (const [index, outcome] of [
		'success',
		'conflict',
		'error',
		'network',
		'completed-success',
		'completed-error'
	].entries()) {
		const currentOutcome = outcome as PostOutcome;
		postOutcome = currentOutcome;
		postReady = false;
		await page.evaluate(
			(mode) => {
				const gate = (
					window as typeof window & {
						__approvalPostGate: { mode: string | null; ready: boolean; release?: () => void };
					}
				).__approvalPostGate;
				gate.mode = mode;
				gate.ready = false;
				gate.release = undefined;
			},
			currentOutcome === 'completed-error'
				? 'body'
				: currentOutcome === 'completed-success'
					? 'fetch'
					: null
		);
		const postSettled = new Promise<'finished' | 'failed'>((resolve) => {
			const finish = (kind: 'finished' | 'failed') => {
				const matches = (request: { method(): string; url(): string }): boolean =>
					request.method() === 'POST' && request.url().includes('/elicitation');
				return (request: { method(): string; url(): string }) => {
					if (!matches(request)) return;
					page.off('requestfinished', onFinished);
					page.off('requestfailed', onFailed);
					resolve(kind);
				};
			};
			const onFinished = finish('finished');
			const onFailed = finish('failed');
			page.on('requestfinished', onFinished);
			page.on('requestfailed', onFailed);
		});
		await approve.focus();
		await approve.press('Enter');
		if (currentOutcome.startsWith('completed-')) {
			await expect
				.poll(() =>
					page.evaluate(
						() =>
							(window as typeof window & { __approvalPostGate: { ready: boolean } })
								.__approvalPostGate.ready
					)
				)
				.toBe(true);
		} else {
			await expect.poll(() => postReady).toBe(true);
		}
		remoteState =
			currentOutcome.startsWith('completed-') || index % 2 !== 0 ? 'replaced' : 'removed';
		if (remoteState === 'removed') {
			await expect(approve).toHaveCount(0);
		} else {
			await expect(question).toContainText('replacement note');
		}
		postReady = false;
		// Abort cases and completed continuations exercise different boundaries.
		if (currentOutcome.startsWith('completed-')) {
			const afterContinuation = await page.evaluate(async () => {
				(
					window as typeof window & { __approvalPostGate: { release: () => void } }
				).__approvalPostGate.release();
				// Let the released promise, decide continuation, and Svelte update
				// drain before asserting the absence of a stale mutation.
				await new Promise<void>((resolve) => setTimeout(resolve, 0));
				return {
					question: document.querySelector('[data-testid="approval-question"]')?.textContent,
					failure: document
						.querySelector('[data-testid="server-owned-turn-failure"]')
						?.textContent?.trim(),
					approveCount: document.querySelectorAll('[data-testid="approval-approve"]').length
				};
			});
			expect(afterContinuation.question).toContain('replacement note');
			expect(afterContinuation.failure).toBe('');
			expect(afterContinuation.approveCount).toBe(1);

			expect(await postSettled).toBe('finished');
		} else {
			releasePost();
			expect(await postSettled).toBe('failed');
		}
		await expect(failure).toBeEmpty();
		if (remoteState === 'removed') {
			await expect(approve).toHaveCount(0);
			await expect(question).toBeEmpty();
		} else {
			await expect(question).toContainText('replacement note');
			await expect(approve).toBeEnabled();
		}
		remoteState = 'server';
		await expect(question).toContainText('Save this note?');
		await expect(approve).toBeVisible();
	}
});

test('allows the replacement approval to submit while the first POST is stalled', async ({
	page
}) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Approval replacement while pending');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');
	await page.getByRole('textbox').fill(fixtureMarker('approval', newFixtureMarker()));
	await page.getByRole('textbox').press('Enter');

	const question = page.locator('[data-testid="approval-question"]');
	const approve = page.locator('[data-testid="approval-approve"]');
	await expect(approve).toBeVisible();
	let remoteState: 'server' | 'replaced' | 'removed' = 'server';
	let postNumber = 0;
	let releaseA!: () => void;
	let releaseB!: () => void;
	await page.route('**/api/server-owned/conversations/*/elicitation', async (route) => {
		if (route.request().method() === 'GET') {
			if (remoteState === 'removed') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: '{"pending":null}'
				});
				return;
			}
			if (remoteState === 'replaced') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						pending: {
							toolName: 'remember_note',
							callId: 'replacement-call',
							message: 'Save the replacement note?',
							arguments: { text: 'replacement' }
						}
					})
				});
				return;
			}
			await route.continue();
			return;
		}
		postNumber += 1;
		assertApprovedPost(route, postNumber === 2 ? 'replacement-call' : undefined);
		await new Promise<void>((resolve) => {
			if (postNumber === 1) releaseA = resolve;
			else releaseB = resolve;
		});
		await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});

	await approve.focus();
	await approve.press('Enter');
	await expect.poll(() => postNumber).toBe(1);
	remoteState = 'replaced';
	await expect(question).toContainText('replacement note');
	await expect(approve).toBeEnabled();
	await approve.press('Enter');
	await expect.poll(() => postNumber).toBe(2);
	releaseA();
	await expect(approve).toHaveAttribute('aria-disabled', 'true');
	remoteState = 'removed';
	releaseB();
	await expect(approve).toHaveCount(0);
});

test('clears a decision error when a remote answer removes its question', async ({ page }) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Approval remote error cleanup');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');
	await page.getByRole('textbox').fill(fixtureMarker('approval', newFixtureMarker()));
	await page.getByRole('textbox').press('Enter');

	const approve = page.locator('[data-testid="approval-approve"]');
	const failure = page.locator('[data-testid="server-owned-turn-failure"]');
	await expect(approve).toBeVisible();
	let remoteAnswered = false;
	let releasePost!: () => void;
	await page.route('**/api/server-owned/conversations/*/elicitation', async (route) => {
		if (route.request().method() === 'GET') {
			if (remoteAnswered) {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: '{"pending":null}'
				});
				return;
			}
			await route.continue();
			return;
		}
		assertApprovedPost(route);
		await new Promise<void>((resolve) => {
			releasePost = resolve;
		});
		await route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'approval service unavailable' })
		});
	});

	await approve.click();
	await expect.poll(() => releasePost !== undefined).toBe(true);
	releasePost();
	await expect(failure).toContainText('approval service unavailable');
	remoteAnswered = true;
	await expect(approve).toHaveCount(0);
	await expect(failure).toBeEmpty();
});

test('poll recovery preserves a decision failure until the answer succeeds', async ({ page }) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Approval poll error ownership');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');
	await page.getByRole('textbox').fill(fixtureMarker('approval', newFixtureMarker()));
	await page.getByRole('textbox').press('Enter');

	const approve = page.locator('[data-testid="approval-approve"]');
	const failure = page.locator('[data-testid="server-owned-turn-failure"]');
	await expect(approve).toBeVisible();

	let postAttempts = 0;
	let pollFailures = 0;
	let pollSuccesses = 0;
	let exercisePollFailure = false;
	await page.route('**/api/server-owned/conversations/*/elicitation', async (route) => {
		if (route.request().method() === 'GET') {
			if (!exercisePollFailure) {
				await route.continue();
				return;
			}
			if (pollFailures === 0) {
				await route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'poll service unavailable' })
				});
				pollFailures += 1;
				return;
			}
			const response = await route.fetch();
			await route.fulfill({ response });
			pollSuccesses += 1;
			return;
		}

		assertApprovedPost(route);
		postAttempts += 1;
		if (postAttempts === 1) {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'approval service unavailable' })
			});
			return;
		}
		await route.continue();
	});

	await approve.click();
	await expect(failure).toContainText('approval service unavailable');
	// A failed poll must not replace the actionable POST failure, and the
	// subsequent successful poll must not clear it by accident.
	exercisePollFailure = true;
	await expect.poll(() => pollFailures).toBe(1);
	await expect.poll(() => pollSuccesses).toBeGreaterThanOrEqual(1);
	await expect(failure).toContainText('approval service unavailable');
	await expect(approve).toBeVisible();

	await approve.click();
	await expect(page.locator('[data-testid="server-owned-chat"]')).toHaveAttribute(
		'data-streaming',
		'false'
	);
	await expect(failure).toBeEmpty();
});
