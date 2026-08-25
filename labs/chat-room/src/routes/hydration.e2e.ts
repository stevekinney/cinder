import { expect, test } from '@playwright/test';

// Hydration cleanliness can only be observed in a DEV build: Svelte strips the
// `hydration_mismatch` warning from production output, and the rest of this
// suite runs against `build && preview`. That is exactly how cinder#756 went
// unnoticed here through 91 passing tests — including SSR-sensitive ones —
// while every Chat route emitted a mismatch on load.
//
// These tests drive the second `webServer` in playwright.config.ts (a dev
// server on DEV_PORT) with absolute URLs, so they are unaffected by `baseURL`.
const DEV_ORIGIN = 'http://localhost:5175';

// ROADMAP A11Y-1. This list is EXHAUSTIVE, not a sample, and that is the point:
// every route under `src/routes/exercises/` renders `<Chat>` or `<ReviewEditor>`
// unconditionally in markup — there is no `{#if browser}` guard anywhere — so
// every one of them is server-rendered and hydrated exactly like the handful
// that used to be checked here. It used to list five exercises out of 25, which
// meant `review-front-matter`'s nine ReviewEditor instances seeded with
// edge-case YAML front matter went unchecked, and so did `review-ssr-and-a11y`,
// the route built specifically to audit SSR and hydration.
//
// The invariant, so a new exercise gets added as a matter of course rather than
// by a later sweep: **every directory under `src/routes/exercises/` appears
// here, plus `/`.** Ordered to match the directory listing so `ls` against this
// array is a trivial diff.
//
// Deliberately NOT globbed at test time: Playwright needs test names at
// collection time, and an explicit list makes a missing route a reviewable diff
// line instead of a silent change in what runs.
//
// `/exercises` stays as the control — it renders neither component, so if every
// route goes red at once it points at the shared layout, the base styles, or the
// hydration beacon rather than at a component.
//
// This used to assert that each Chat route emitted EXACTLY ONE mismatch — a
// pinned bug, not a passing test. Fixed upstream by cinder#1261 and verified
// here against `@lostgradient/cinder@0.24.1` / `@lostgradient/chat@0.9.1`: all
// three Chat routes now report zero, as does a page containing nothing but a
// Cinder icon, which is where that one was localized.
// The ReviewEditor routes joined this list once cinder#1277 shipped. That one
// was NOT the LiveRegion or the empty `{#if name}` block it looked like: the
// editor package listed `node` before `svelte` in its conditional exports, so
// SvelteKit SSR loaded the precompiled `dist/server` bundle while the browser
// compiled the same components from source — two independent compilations of
// one page, disagreeing on hydration anchor comments. Exactly what cinder#1261
// fixed for chat and cinder; editor was missed by that sweep.
const HYDRATING_ROUTES = [
	'/',
	'/exercises',
	'/exercises/adapter-push',
	'/exercises/artifacts',
	'/exercises/assistant-metadata',
	'/exercises/attachments',
	'/exercises/composer-popover',
	'/exercises/contracts',
	'/exercises/conversation-list',
	'/exercises/diff-viewer',
	'/exercises/history-scroll',
	'/exercises/interleaving',
	'/exercises/markdown-editor',
	'/exercises/message-lifecycle',
	'/exercises/presentation',
	'/exercises/review-anchoring',
	'/exercises/review-basics',
	'/exercises/review-comment-creation',
	'/exercises/review-comment-lifecycle',
	'/exercises/review-diff-performance',
	'/exercises/review-form-and-exports',
	'/exercises/review-front-matter',
	'/exercises/review-imperative',
	'/exercises/review-modes',
	'/exercises/review-ssr-and-a11y',
	'/exercises/review-state-and-session',
	'/exercises/review-views',
	'/exercises/row-reconciliation',
	'/exercises/tool-approval',
	'/exercises/utilities',
	'/exercises/virtualization'
];

/**
 * Matches every warning Svelte emits about hydration going wrong.
 *
 * `Failed to hydrate` is a separate emission from `hydration_mismatch` — a bare
 * `console.warn('Failed to hydrate: ', error)` on the catch path, with no
 * `hydration_mismatch` token in it — and the previous predicate missed it
 * entirely, so a hydration that threw outright would have read as clean.
 */
const HYDRATION_WARNING = /hydration_mismatch|hydration failed|failed to hydrate/i;

declare global {
	interface Window {
		__hydrationWarnings?: string[];
	}
}

/**
 * ROADMAP TI-1. This used to sleep 1000ms after the hydration beacon "because
 * hydration warnings can trail the beacon by a frame or two". They cannot, and
 * the mechanism settles it rather than a longer wait:
 *
 * Svelte emits `hydration_mismatch` only while its module-level `hydrating` flag
 * is true. That flag is set and cleared SYNCHRONOUSLY around the mount —
 * `set_hydrating(true)`, `_mount(...)`, `set_hydrating(false)` with no `await`
 * between them (`svelte/src/internal/client/render.js`). The beacon is set from
 * an `$effect`, which flushes on a microtask queued after that synchronous block
 * (`reactivity/batch.js`). So by the time `body[data-hydrated="true"]` is
 * observable, every hydration warning that will ever fire already has.
 *
 * (The one way back into hydration mode afterwards is Svelte's async-mode
 * `flatten` callback, which needs `experimental.async` — not enabled here — and
 * an `await` inside a component; there are no `{#await}` blocks in `src/` or in
 * the installed component packages' browser builds.)
 *
 * What remained was a TEST-side risk — whether a `console` event had been
 * delivered to Playwright yet — and that is removed structurally rather than
 * waited out: an init script wraps `console.warn` in the page itself before any
 * page script runs, so nothing can be missed, and reading it back is ordered
 * after the beacon in page time. The CDP `console` listener is kept as an
 * independent second collector, and both are asserted empty. If they ever
 * disagree, that disagreement is itself the finding.
 */
async function collectHydrationMismatches(
	page: import('@playwright/test').Page,
	path: string
): Promise<{ viaConsoleEvent: string[]; viaInitScript: string[] }> {
	const viaConsoleEvent: string[] = [];
	// Attached BEFORE navigation: the warning is emitted during hydration and is
	// gone by the time any post-load hook could subscribe.
	page.on('console', (message) => {
		if (HYDRATION_WARNING.test(message.text())) viaConsoleEvent.push(message.text());
	});

	await page.addInitScript((source: string) => {
		const pattern = new RegExp(source, 'i');
		window.__hydrationWarnings = [];
		const original = console.warn.bind(console);
		console.warn = (...args: unknown[]) => {
			const text = args.map((arg) => String(arg)).join(' ');
			if (pattern.test(text)) window.__hydrationWarnings?.push(text);
			original(...args);
		};
	}, HYDRATION_WARNING.source);

	await page.goto(`${DEV_ORIGIN}${path}`);
	await page.locator('body[data-hydrated="true"]').waitFor();

	const viaInitScript = await page.evaluate(() => window.__hydrationWarnings ?? []);
	return { viaConsoleEvent, viaInitScript };
}

for (const route of HYDRATING_ROUTES) {
	test(`${route} hydrates without a mismatch`, async ({ page }) => {
		const { viaConsoleEvent, viaInitScript } = await collectHydrationMismatches(page, route);

		expect(viaInitScript).toEqual([]);
		expect(viaConsoleEvent).toEqual([]);
		// The two collectors must agree. They observe the same emissions by
		// different routes — one in-page, one over CDP — so a divergence means one
		// of them is not seeing what it claims to, which would quietly undermine
		// every assertion in this file.
		expect(viaInitScript.length).toBe(viaConsoleEvent.length);
	});
}
