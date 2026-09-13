import { expect, test } from '@playwright/test';
import { gotoHydrated } from './hydration';

// ROADMAP A11Y-3: every error live region on these routes exists in the DOM
// BEFORE the error it will announce.
//
// The rule this enforces is not a style preference. Chat's own
// `chat-status-announcer.svelte` states it outright — "Always rendered so the
// browser has registered the live region before content is injected; mounting
// with pre-existing text is not reliably announced" — and seven banners in this
// repo did the thing that comment warns against. Six were gated on `{#if error}`
// directly; the seventh reached the same outcome by living inside a
// `{#snippet failed}` boundary, which does not exist until the boundary has
// already activated.
//
// Collected here rather than scattered across the specs that own these routes,
// because it is ONE invariant. A per-spec version would be one assertion per
// entry below, each looking incidental where it sat, and the next banner added
// would have no obvious place to be checked.
//
// The count is deliberately NOT restated in prose. It was written as "five",
// the list has grown twice since, and the list is directly below — a number in
// a comment beside the thing it counts is one more thing to keep in step, and
// this one did not stay in step.
//
// This is the "before" half only. That each region actually receives its text
// when the error happens is already covered by the specs that drive those
// errors — this pins the property those specs cannot see, since by the time they
// assert anything the error has occurred and the region would exist either way.
const ERROR_REGIONS = [
	{ route: '/', testId: 'demo-error' },
	{ route: '/exercises/message-lifecycle', testId: 'adapter-error' },
	{ route: '/exercises/message-lifecycle', testId: 'plain-error' },
	{ route: '/exercises/adapter-push', testId: 'adapter-push-error' },
	{ route: '/exercises/adapter-push', testId: 'hazard-fixture-announcement' },
	{ route: '/exercises/tool-approval', testId: 'fail-error' },
	{ route: '/exercises/interleaving', testId: 'interleaving-error' },
	{ route: '/exercises/multi-agent', testId: 'multi-agent-failure' },
	{ route: '/server-owned', testId: 'server-owned-failure' }
];

/**
 * The same invariant on a route that needs a conversation to exist first.
 *
 * Kept OUT of the table above rather than teaching it to resolve a route: every
 * entry there is a constant string, and the one thing this file is good at is
 * being obvious. A second loop is cheaper to read than a table whose route
 * column is sometimes a function.
 */
const DYNAMIC_ERROR_REGIONS = [
	{ path: (id: string) => `/server-owned/${id}`, testId: 'recovery-error' }
];

for (const { route, testId } of ERROR_REGIONS) {
	test(`${route} mounts ${testId} before anything can fail`, async ({ page }) => {
		await gotoHydrated(page, route);

		const region = page.getByTestId(testId);

		// Present and empty. Both halves matter: present, so the browser has
		// registered it; empty, so nothing is announced on load.
		await expect(region).toHaveCount(1);
		await expect(region).toBeEmpty();
		await expect(region).toHaveAttribute('role', 'alert');
	});
}

test('the hazard fixture announces through one region, not two', async ({ page }) => {
	// The boundary's visible message deliberately carries no `role="alert"`: the
	// permanently-mounted region beside it is what announces. Two live regions
	// describing one error would say it twice, which is worse than the silence
	// this item set out to fix.
	await gotoHydrated(page, '/exercises/adapter-push');

	await expect(page.getByTestId('hazard-fixture-announcement')).toHaveAttribute('role', 'alert');
	await expect(page.getByTestId('hazard-fixture-error')).toHaveCount(0);

	await page.getByTestId('toggle-hazard-fixture').click();

	// Once it fails, the visible text appears — and it is still not a live region.
	const visible = page.getByTestId('hazard-fixture-error');
	await expect(visible).toBeVisible();
	await expect(visible).not.toHaveAttribute('role', 'alert');
	await expect(page.getByTestId('hazard-fixture-announcement')).not.toBeEmpty();
});

for (const { path, testId } of DYNAMIC_ERROR_REGIONS) {
	test(`a server-owned conversation mounts ${testId} before anything can fail`, async ({
		page,
		request
	}) => {
		const created = await request.post('/api/server-owned/conversations', {
			data: { title: `Live region ${Date.now().toString(36)}` }
		});
		const { conversation } = (await created.json()) as { conversation: { id: string } };

		await gotoHydrated(page, path(conversation.id));

		const region = page.getByTestId(testId);

		await expect(region).toHaveCount(1);
		await expect(region).toBeEmpty();
		await expect(region).toHaveAttribute('role', 'alert');
	});
}
