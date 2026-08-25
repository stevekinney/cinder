import type { Page } from '@playwright/test';

/**
 * Navigate and wait for the root layout's hydration beacon
 * (`body[data-hydrated]`) before returning. SSR renders every control's
 * markup ahead of hydration, so a click issued straight after `goto` can
 * land on an element whose handler isn't wired yet — a race that only
 * shows up under parallel-worker CPU contention. Use this instead of
 * `page.goto` in every e2e test.
 *
 * Deliberately does NOT assert that hydration was clean. Svelte strips
 * `hydration_mismatch` from production builds, and this suite runs against
 * `build && preview`, so such an assertion would be permanently vacuous here —
 * it would pass even with a mismatch on every route. `hydration.e2e.ts` covers
 * that against a dev server, which is the only build that reports it.
 */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.locator('body[data-hydrated="true"]').waitFor();
}
