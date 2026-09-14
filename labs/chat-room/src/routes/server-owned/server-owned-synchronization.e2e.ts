import { expect, test } from '@playwright/test';
import type { ServerOwnedConversationSnapshot } from '$lib/server-owned-snapshot';

import { gotoHydrated } from '../exercises/hydration';
import { fixtureMarker } from '../streaming-fixture';

const title = `Synchronization ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

test('converges a second idle tab from the full server snapshot after a send', async ({
	browser,
	request,
	page
}) => {
	const created = await request.post('/api/server-owned/conversations', { data: { title } });
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };
	const secondContext = await browser.newContext();
	const secondPage = await secondContext.newPage();
	await page.clock.install();
	await secondPage.clock.install();
	await gotoHydrated(page, `/server-owned/${conversation.id}`);
	await gotoHydrated(secondPage, `/server-owned/${conversation.id}`);

	await page.getByRole('textbox', { name: 'Message' }).fill('Synchronize this turn');
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(page.getByRole('article', { name: 'Assistant' })).toContainText(
		'Fixture default reply.'
	);
	// B stays idle and sends nothing. Advancing its own clock proves the
	// passive visible-tab path rather than a refresh caused by focus or send.
	await secondPage.clock.runFor(5000);
	await expect(
		secondPage.getByRole('article', { name: 'You' }).filter({ hasText: 'Synchronize this turn' })
	).toContainText('Synchronize this turn');
	await expect(
		secondPage
			.getByRole('article', { name: 'Assistant' })
			.filter({ hasText: 'Fixture default reply.' })
	).toContainText('Fixture default reply.');
	await secondContext.close();
});

test('stale sender converges to the complete transcript without duplicates', async ({
	browser,
	request,
	page
}) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: `${title}-stale` }
	});
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };
	const secondContext = await browser.newContext();
	const secondPage = await secondContext.newPage();
	await page.clock.install();
	await secondPage.clock.install();
	await gotoHydrated(page, `/server-owned/${conversation.id}`);
	await gotoHydrated(secondPage, `/server-owned/${conversation.id}`);

	await page.getByRole('textbox', { name: 'Message' }).fill('First tab turn');
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(page.getByRole('article', { name: 'Assistant' })).toContainText(
		'Fixture default reply.'
	);
	// B sends before learning A's turn. Its subsequent full snapshot must retain
	// both user turns and both replies exactly once.
	await secondPage.getByRole('textbox', { name: 'Message' }).fill('Second tab turn');
	await secondPage.getByRole('button', { name: 'Send message' }).click();
	await expect(secondPage.getByRole('article', { name: 'Assistant' })).toHaveCount(2);
	await secondPage.clock.runFor(5000);
	await expect(secondPage.getByRole('article', { name: 'You' })).toHaveCount(2);
	await expect(secondPage.getByRole('article', { name: 'Assistant' })).toHaveCount(2);
	await expect(
		secondPage.getByRole('article', { name: 'You' }).filter({ hasText: 'First tab turn' })
	).toHaveCount(1);
	await expect(
		secondPage.getByRole('article', { name: 'You' }).filter({ hasText: 'Second tab turn' })
	).toHaveCount(1);
	await secondContext.close();
});

test('keeps a durable provider failure row through reload and a later success', async ({
	page,
	request
}) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: `${title}-failure` }
	});
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };
	await gotoHydrated(page, `/server-owned/${conversation.id}`);
	const marker = `failure-${Date.now().toString(36)}`;
	const rejected = `Rejected ${fixtureMarker('fail-once401', marker)}`;
	await page.getByRole('textbox', { name: 'Message' }).fill(rejected);
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(page.getByTestId('server-owned-turn-failure')).toContainText(
		'The assistant could not complete this turn.'
	);
	await expect(page.getByRole('article', { name: 'You' })).toContainText(rejected);
	await page.reload();
	await page.locator('body[data-hydrated="true"]').waitFor();
	await expect(page.getByRole('article', { name: 'You' })).toContainText(rejected);
	await expect(
		page.getByRole('article', { name: 'You' }).filter({ hasText: rejected }).locator('xpath=..')
	).toHaveAttribute('data-failed', 'true');
	await expect(page.getByTestId('server-owned-turn-reason')).toContainText(
		'The assistant could not complete this turn.'
	);
	const canonicalFailureReason = await page.getByTestId('server-owned-turn-reason').textContent();
	// The marker fails only on its first provider request. The same conversation
	// therefore proves that a durable failure survives reload and a later turn.
	await page.getByRole('textbox', { name: 'Message' }).fill('A later successful turn');
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(page.getByRole('article', { name: 'Assistant' })).toContainText(
		'Fixture default reply.'
	);
	const failedRow = page.getByRole('article', { name: 'You' }).filter({ hasText: rejected });
	await expect(failedRow).toHaveCount(1);
	await expect(failedRow.locator('xpath=..')).toHaveAttribute('data-failed', 'true');
	await expect(failedRow.getByTestId('server-owned-turn-reason')).toHaveText(
		canonicalFailureReason!
	);
});

test('announces durable failure batches, stays silent for SSR history, and preserves row reasons', async ({
	page,
	request
}) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: `${title}-announcements` }
	});
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };
	await gotoHydrated(page, `/server-owned/${conversation.id}`);
	const first = `First ${fixtureMarker('unauthorized', `first-${Date.now().toString(36)}`)}`;
	const second = `Second ${fixtureMarker('unauthorized', `second-${Date.now().toString(36)}`)}`;
	const status = page.getByTestId('server-owned-sync-status');
	await expect(status).toHaveCSS('position', 'absolute');
	await page.evaluate(() => {
		const node = document.querySelector<HTMLElement>('[data-testid="server-owned-sync-status"]');
		if (!node) throw new Error('sync status is missing');
		let mutations = 0;
		new MutationObserver(() => {
			mutations += 1;
			node.dataset.mutationCount = String(mutations);
		}).observe(node, { childList: true, characterData: true, subtree: true });
		node.dataset.mutationCount = '0';
	});
	await page.getByRole('textbox', { name: 'Message' }).fill(first);
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(status).toHaveText('1 failed turn is recorded in this conversation.');
	await expect(status).toHaveAttribute('data-mutation-count', '1');
	await page.getByRole('textbox', { name: 'Message' }).fill(second);
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(status).toHaveText('1 failed turn is recorded in this conversation.');
	await expect(status).toHaveAttribute('data-mutation-count', '2');
	const firstRow = page.getByRole('article', { name: 'You' }).filter({ hasText: first });
	const secondRow = page.getByRole('article', { name: 'You' }).filter({ hasText: second });
	await expect(firstRow.getByTestId('server-owned-turn-reason')).toContainText(
		'The assistant could not complete this turn.'
	);
	await expect(secondRow.getByTestId('server-owned-turn-reason')).toContainText(
		'The assistant could not complete this turn.'
	);

	await page.reload();
	await page.locator('body[data-hydrated="true"]').waitFor();
	await expect(status).toHaveText('');
	const refresh = page.waitForResponse(
		(response) =>
			response.url().includes(`/api/server-owned/conversations/${conversation.id}`) &&
			response.request().method() === 'GET'
	);
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await refresh;
	await expect(status).toHaveText('');
});

test('announces two durable failures together and leaves unchanged refreshes silent', async ({
	page,
	request
}) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: `${title}-batch` }
	});
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };
	await gotoHydrated(page, `/server-owned/${conversation.id}`);
	let releaseSnapshot = (): void => undefined;
	const snapshotPaused = new Promise<void>((resolve) => {
		releaseSnapshot = resolve;
	});
	await page.route(`**/api/server-owned/conversations/${conversation.id}`, async (route) => {
		await snapshotPaused;
		await route.continue();
	});
	const first = `Batch first ${fixtureMarker('unauthorized', `batch-first-${Date.now().toString(36)}`)}`;
	const second = `Batch second ${fixtureMarker('unauthorized', `batch-second-${Date.now().toString(36)}`)}`;
	for (const text of [first, second]) {
		await page.getByRole('textbox', { name: 'Message' }).fill(text);
		await page.getByRole('button', { name: 'Send message' }).click();
		await expect(
			page.getByRole('article', { name: 'You' }).filter({ hasText: text }).locator('xpath=..')
		).toHaveAttribute('data-failed', 'true');
	}
	releaseSnapshot();
	const status = page.getByTestId('server-owned-sync-status');
	await expect(status).toHaveText('2 additional failed turns are recorded in this conversation.');
	await expect(
		page.getByRole('article', { name: 'You' }).filter({ hasText: first }).locator('xpath=..')
	).toHaveAttribute('data-failed', 'true');
	await expect(
		page.getByRole('article', { name: 'You' }).filter({ hasText: second }).locator('xpath=..')
	).toHaveAttribute('data-failed', 'true');
	await page.evaluate(() => {
		const node = document.querySelector<HTMLElement>('[data-testid="server-owned-sync-status"]');
		if (!node) throw new Error('sync status is missing');
		let mutations = 0;
		new MutationObserver(() => {
			mutations += 1;
			node.dataset.mutationCount = String(mutations);
		}).observe(node, { childList: true, characterData: true, subtree: true });
		node.dataset.mutationCount = '0';
	});
	const refresh = page.waitForResponse(
		(response) =>
			response.url().includes(`/api/server-owned/conversations/${conversation.id}`) &&
			response.request().method() === 'GET'
	);
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await refresh;
	await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(resolve)));
	await expect(status).toHaveAttribute('data-mutation-count', '0');
	await page.unroute(`**/api/server-owned/conversations/${conversation.id}`);
});

test('keeps an own-endpoint rejection overlay through refresh until the next submission', async ({
	page,
	request
}) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: `${title}-rejected-overlay` }
	});
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };
	await gotoHydrated(page, `/server-owned/${conversation.id}`);
	const rejected = 'Rejected endpoint turn';
	await page.route(`**/api/server-owned/conversations/${conversation.id}/stream`, (route) =>
		route.fulfill({
			status: 409,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'The endpoint rejected this turn.' })
		})
	);
	await page.getByRole('textbox', { name: 'Message' }).fill(rejected);
	await page.getByRole('button', { name: 'Send message' }).click();
	const rejectedRow = page.getByRole('article', { name: 'You' }).filter({ hasText: rejected });
	await expect(rejectedRow).toHaveCount(1);
	await expect(page.getByTestId('server-owned-turn-failure')).toHaveText(
		'The endpoint rejected this turn.'
	);
	const refresh = page.waitForResponse(
		(response) =>
			response.url().includes(`/api/server-owned/conversations/${conversation.id}`) &&
			response.request().method() === 'GET'
	);
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await refresh;
	await expect(rejectedRow).toHaveCount(1);
	await page.unroute(`**/api/server-owned/conversations/${conversation.id}/stream`);
	await page.getByRole('textbox', { name: 'Message' }).fill('Accepted replacement turn');
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(page.getByRole('article', { name: 'You' })).toContainText(
		'Accepted replacement turn'
	);
	await expect(rejectedRow).toHaveCount(0);
});

test('keeps an unsaved failure through canonical adoption and later turns until durable confirmation', async ({
	page,
	request
}) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: `${title}-persistence-overlay` }
	});
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };
	const endpoint = `/api/server-owned/conversations/${conversation.id}`;
	await page.clock.install();
	await gotoHydrated(page, `/server-owned/${conversation.id}`);
	const emptySnapshot = (await (
		await request.get(endpoint)
	).json()) as ServerOwnedConversationSnapshot;
	const text = 'Unsaved persistence failure';
	const failure = {
		kind: 'generate',
		code: 'UNKNOWN',
		message: 'The turn outcome could not be saved.',
		retryable: false
	};
	let authoritativeId = '';
	await page.route(`**${endpoint}/stream`, async (route) => {
		// Run the real endpoint so subsequent GETs have its native, authoritative
		// user ID. Replace only the outcome frames to exercise the browser seam;
		// pump unit tests independently force the actual persistence rejection.
		const accepted = await route.fetch();
		expect(accepted.ok()).toBe(true);
		await accepted.body();
		const snapshot = (await (
			await request.get(endpoint)
		).json()) as ServerOwnedConversationSnapshot;
		authoritativeId = snapshot.conversation.ids.find(
			(id) => snapshot.conversation.messages[id]?.role === 'user'
		)!;
		expect(authoritativeId).toBeTruthy();
		expect(snapshot.turnFailures).toEqual({});
		await route.fulfill({
			status: 200,
			contentType: 'application/x-ndjson',
			body:
				[
					{
						type: 'stream:error',
						error: { source: 'server-owned-persistence', userMessageId: authoritativeId, failure },
						wireVersion: 1,
						sequence: 1
					},
					{ type: 'run.error', error: { name: 'Error', ...failure }, wireVersion: 1, sequence: 2 }
				]
					.map((frame) => JSON.stringify(frame))
					.join('\n') + '\n'
		});
	});
	await page.getByRole('textbox', { name: 'Message' }).fill(text);
	await page.getByRole('button', { name: 'Send message' }).click();
	const row = page.getByRole('article', { name: 'You' }).filter({ hasText: text });
	const status = page.getByTestId('server-owned-sync-status');
	await expect(row).toHaveCount(1);
	await expect(row.locator('xpath=..')).toHaveAttribute('data-failed', 'true');
	await expect(row.getByTestId('server-owned-turn-reason')).toHaveText(failure.message);
	const refresh = async (): Promise<void> => {
		const response = page.waitForResponse(
			(candidate) => candidate.url().endsWith(endpoint) && candidate.request().method() === 'GET'
		);
		await page.evaluate(() => window.dispatchEvent(new Event('focus')));
		await response;
	};
	await refresh();
	await expect(row).toHaveCount(1);
	await expect(row.locator('xpath=..')).toHaveAttribute('data-failed', 'true');
	await expect(status).toHaveText('');
	await page.unroute(`**${endpoint}/stream`);
	await page.getByRole('textbox', { name: 'Message' }).fill('A later accepted turn');
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(page.getByRole('article', { name: 'Assistant' })).toHaveCount(2);
	await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
	await expect(row).toHaveCount(1);
	await expect(row.locator('xpath=..')).toHaveAttribute('data-failed', 'true');
	await expect(row.getByTestId('server-owned-turn-reason')).toHaveText(failure.message);
	await expect(status).toHaveText('');

	// The captured row remains recoverable even after canonical adoption.
	await page.route(`**${endpoint}`, (route) => route.fulfill({ json: emptySnapshot }));
	await refresh();
	await expect(page.getByRole('article', { name: 'You' })).toHaveCount(1);
	await expect(row.locator('xpath=..')).toHaveAttribute('data-failed', 'true');
	await page.unroute(`**${endpoint}`);
	await refresh();
	await expect(page.getByRole('article', { name: 'You' })).toHaveCount(2);
	await expect(row).toHaveCount(1);

	const canonical = (await (await request.get(endpoint)).json()) as ServerOwnedConversationSnapshot;
	await page.route(`**${endpoint}`, (route) =>
		route.fulfill({
			json: {
				...canonical,
				turnFailures: {
					[authoritativeId]: { ...failure, message: 'The assistant could not complete this turn.' }
				}
			}
		})
	);
	await refresh();
	await expect(row.getByTestId('server-owned-turn-reason')).toHaveText(
		'The assistant could not complete this turn.'
	);
	await expect(status).toHaveText('1 failed turn is recorded in this conversation.');
	// Removing the synthetic durable record proves the local overlay was
	// retired, rather than merely hidden underneath that record.
	await page.unroute(`**${endpoint}`);
	await refresh();
	await expect(row.locator('xpath=..')).not.toHaveAttribute('data-failed', 'true');
	await expect(row.getByTestId('server-owned-turn-reason')).toHaveCount(0);
});
