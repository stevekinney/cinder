/**
 * Browser coverage for four ReviewEditor bugs clustered in thread selection /
 * scroll / popover lifecycle, all filed against
 * `review-editor-impl.svelte` (the live implementation —
 * `review-editor-threads.svelte.ts` is an unwired experimental module kept in
 * parity by its own docblock, but nothing renders it):
 *
 *  - cinder#1316: `scrollToThread` called `view.dom.scrollTo(...)`. `view.dom`
 *    (the `.ProseMirror` contenteditable) has no `overflow` in any shipped
 *    stylesheet, so the call was clamped to 0 and nothing ever moved.
 *  - cinder#1317: `scrollToThread` given an unknown thread id returned
 *    silently — no throw, no signal, indistinguishable from a known id that
 *    happened to already be in view.
 *  - cinder#1319: the sidebar's thread-select handler scheduled a ~350ms
 *    popover-open timer it never stored in the component's own cancelable
 *    `selectTimeoutId`, so a thread selected afterward by anchor click did
 *    not actually cancel it — it fired anyway and silently reverted the
 *    popover to the stale sidebar selection.
 *  - cinder#1320: re-clicking the already-active sidebar row destroyed and
 *    recreated the open popover, because ThreadPopover's click-outside
 *    listener (capture phase, before the row's own bubble-phase `onclick`)
 *    treated every sidebar click as "outside" — discarding any unsent reply
 *    text sitting in CommentComposer's draft state.
 *
 * All four exercise `packages/playground/src/examples/review-editor/
 * scroll-and-sidebar.example.svelte`, mounted at
 * `#example-mount-scroll-and-sidebar` on the `?snapshot=1` page (bare
 * mounts, no documentation chrome — see component-page.svelte's snapshot
 * branch). `componentPage` (reused from the toolbar suite) owns navigation,
 * theme/reduced-motion context, and the `#app` mount wait.
 */
import type { Locator, Page } from '@playwright/test';
import type { ComponentPage } from '../src/fixtures/component-page.ts';
import { expect, test } from '../src/fixtures/component-page.ts';
import { VIEWPORTS } from '../src/helpers/manifest.ts';

const reviewEditorEntry = {
  name: 'ReviewEditor',
  slug: 'review-editor',
  route: '/page/review-editor',
} as const;

const desktop = VIEWPORTS.find((viewport) => viewport.name === 'desktop')!;

// The example derives its id from `mountIdPrefix ?? $props.id()`, matching
// every other playground example (see `featured-examples.ts`'s
// `usesMountIdPrefix`/`usesUidFallback` checks). `mountIdPrefix` is the
// mount container's own DOM id, `example-mount-<scenario>` — see
// `component-page-example-mounts.ts` — so this is deterministic, not a
// runtime `$props.id()` value this test would have no way to predict.
const EDITOR_ID = 'example-mount-scroll-and-sidebar-review-editor';
const MOUNT_SELECTOR = '#example-mount-scroll-and-sidebar';

async function openExample(componentPage: ComponentPage): Promise<{ page: Page; mount: Locator }> {
  const page = await componentPage.open({
    entry: reviewEditorEntry,
    theme: 'light',
    viewport: desktop,
  });
  const mount = page.locator(MOUNT_SELECTOR);
  // Default expect() timeout (5s): componentPage.open() already awaited
  // `#app > *` visible, and every review-editor example mounts in the same
  // top-level `{#each examples as {scenario}}` block, so this specific
  // example-mount div is already in the DOM by the time open() returns —
  // there's nothing slow left to wait out here.
  await expect(mount).toBeVisible();
  // This one IS a real, evidence-backed exception, not padding: Milkdown's
  // async editor-view construction is what `data-ready` reports, and
  // `packages/testing/src/fixtures/component-page.ts` already documents the
  // same 20s ceiling for exactly this class of component — "Post-#39
  // (chunk-[hash].js naming), all components — including the Milkdown-backed
  // editors (Chat, MarkdownEditor, ReviewEditor) — mount in single-digit
  // seconds on the CI runner. 20s leaves generous headroom." `toBeVisible()`
  // is Playwright's own auto-retrying poll against this attribute — it
  // resolves the moment `data-ready` flips true, not after a fixed delay;
  // `timeout` here is only the upper bound for a genuinely slow/cold mount,
  // not a sleep duration.
  await expect(mount.locator('.markdown-editor-wrapper[data-ready="true"]')).toBeVisible({
    timeout: 20_000,
  });
  return { page, mount };
}

function anchor(mount: Locator, threadId: string): Locator {
  return mount.locator(`.comment-anchor[data-thread-id="${threadId}"]`);
}

/**
 * Installs Playwright's fake clock AND pauses it. `install()` alone does not
 * freeze time — per its own docs, "Date.now will progress as the timers
 * fire" until `pauseAt()`/`resume()`/`runFor()`/`fastForward()` is called —
 * so `setTimeout` callbacks scheduled after a bare `install()` still fire on
 * ordinary wall-clock delay. Without the explicit pause here, the 350ms
 * timers under test in this file fire during Playwright's own auto-retrying
 * `expect()` polling (which spans real wall-clock time) regardless of
 * `runFor`, making a `runFor(400)` step meaningless for actually gating when
 * a timer fires. Confirmed empirically: the cinder#1319 test below passed
 * against the reverted (buggy) fix without this pause, because a second,
 * correctly-implemented `$effect` self-healed the popover back to the right
 * thread on its own ~350ms after the bug fired — just late enough that
 * `expect().toContainText()`'s retry window caught the corrected state
 * instead of the bug.
 */
async function installPausedClock(page: Page): Promise<void> {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
}

test.describe('ReviewEditor.scrollToThread (cinder#1316, cinder#1317)', () => {
  test('scrolls the off-screen anchor into view', async ({ componentPage }) => {
    const { page, mount } = await openExample(componentPage);
    const foxAnchor = anchor(mount, 'thread-fox');
    await expect(foxAnchor).toBeAttached();

    const viewportHeight = page.viewportSize()?.height ?? 0;
    const before = await foxAnchor.boundingBox();
    expect(before).not.toBeNull();
    // The document is long enough that the thread-fox anchor starts below
    // the fold when the page loads scrolled to the top.
    expect(before!.y).toBeGreaterThan(viewportHeight);

    await mount.locator('[data-testid="scroll-to-fox"]').click();
    await expect(mount.locator('[data-testid="scroll-result"]')).toHaveText('scrolled: thread-fox');

    await expect
      .poll(async () => {
        const box = await foxAnchor.boundingBox();
        return box?.y ?? Number.POSITIVE_INFINITY;
      })
      .toBeLessThan(viewportHeight);
  });

  test('throws for an unknown thread id instead of failing silently', async ({ componentPage }) => {
    const { page, mount } = await openExample(componentPage);
    const scrollY = () => page.evaluate(() => window.scrollY);

    expect(await scrollY()).toBe(0);

    await mount.locator('[data-testid="scroll-to-unknown"]').click();

    await expect(mount.locator('[data-testid="scroll-result"]')).toHaveText(
      'error: ReviewEditor.scrollToThread: no thread with id "does-not-exist"',
    );
    // The throw happens before anything scrolls.
    expect(await scrollY()).toBe(0);
  });
});

test.describe('sidebar thread selection races (cinder#1319, cinder#1320)', () => {
  async function openSidebar(page: Page, mount: Locator): Promise<Locator> {
    const toggle = page.locator(`#${EDITOR_ID}-sidebar-toggle`);
    await toggle.click();
    const sidebar = mount.locator(`#${EDITOR_ID}-sidebar`);
    await expect(sidebar).toBeVisible();
    return sidebar;
  }

  function sidebarRow(sidebar: Locator, quote: string): Locator {
    return sidebar.locator('.thread-item', { hasText: quote });
  }

  function popoverTitle(page: Page): Locator {
    return page.locator(`#${EDITOR_ID}-thread-popover .thread-popover-title`);
  }

  test('a thread selected by anchor click survives the stale sidebar timer', async ({
    componentPage,
  }) => {
    const { page, mount } = await openExample(componentPage);
    const sidebar = await openSidebar(page, mount);

    await installPausedClock(page);

    // Select thread-fox from the sidebar — schedules the ~350ms
    // popover-position timer under test.
    await sidebarRow(sidebar, 'The quick fox anchor').click();

    // Before that timer fires, select a DIFFERENT thread by clicking its
    // document anchor decoration directly. This opens synchronously and
    // must cancel the pending sidebar timer.
    await anchor(mount, 'thread-dog').click();
    await expect(popoverTitle(page)).toContainText('The lazy dog anchor');

    // Advance past the sidebar selection's original 350ms delay, in a
    // SINGLE step and no further. Without the fix, the stale timer fires
    // here (~350ms after the fox click) and silently reverts the popover to
    // thread-fox — that is the bug this test pins. Left running past that
    // point, review-editor-impl.svelte's separate (and correctly written)
    // deep-linking `$effect` notices `activeThreadId` ('thread-dog') no
    // longer matches the just-reverted `popoverThreadId` ('thread-fox') and
    // self-heals back to thread-dog roughly 350ms later — which would make
    // this assertion pass even against the buggy code if it ran after that
    // second correction. Checking immediately after the one 400ms advance,
    // before any second `runFor` call, is what keeps this test honest: it
    // was verified to fail against the reverted fix (title flips to
    // "The quick fox anchor" at this exact point) before that self-heal has
    // a chance to run.
    await page.clock.runFor(400);

    await expect(popoverTitle(page)).toContainText('The lazy dog anchor');
    await expect(popoverTitle(page)).not.toContainText('The quick fox anchor');
  });

  test('re-clicking the active row preserves an unsent reply draft', async ({ componentPage }) => {
    const { page, mount } = await openExample(componentPage);
    const sidebar = await openSidebar(page, mount);

    await installPausedClock(page);

    const row = sidebarRow(sidebar, 'The quick fox anchor');
    await row.click();
    await page.clock.runFor(500);
    await expect(popoverTitle(page)).toContainText('The quick fox anchor');

    const composer = page.locator(`#${EDITOR_ID}-thread-popover-composer`);
    await expect(composer).toBeVisible();
    const draft = 'This reply should survive a re-click of the same row.';
    await composer.fill(draft);
    await expect(composer).toHaveValue(draft);

    // Re-click the SAME (already active) row. Without the fix this destroys
    // and recreates the popover — including a fresh, empty CommentComposer —
    // discarding the draft above.
    await row.click();
    await page.clock.runFor(500);

    await expect(popoverTitle(page)).toContainText('The quick fox anchor');
    await expect(page.locator(`#${EDITOR_ID}-thread-popover-composer`)).toHaveValue(draft);
  });

  test('selecting a DIFFERENT row still closes and reopens the popover', async ({
    componentPage,
  }) => {
    // Guards against an ignoreRefs fix that is scoped too broadly — clicking
    // a different thread must not be swallowed the same way a re-click is.
    const { page, mount } = await openExample(componentPage);
    const sidebar = await openSidebar(page, mount);

    await installPausedClock(page);

    await sidebarRow(sidebar, 'The quick fox anchor').click();
    await page.clock.runFor(500);
    await expect(popoverTitle(page)).toContainText('The quick fox anchor');

    await sidebarRow(sidebar, 'The lazy dog anchor').click();
    await page.clock.runFor(500);
    await expect(popoverTitle(page)).toContainText('The lazy dog anchor');
  });

  test('choosing a second sidebar thread before the first opens cancels the first timer', async ({
    componentPage,
  }) => {
    const { page, mount } = await openExample(componentPage);
    const sidebar = await openSidebar(page, mount);

    await installPausedClock(page);

    // Select thread-fox, then advance the clock partway through its ~350ms
    // delay before selecting thread-dog. That gives the two scheduled
    // timers DIFFERENT virtual deadlines (350ms apart, not simultaneous),
    // which is what makes an orphaned fox timer separately observable below
    // instead of being masked by firing in the same tick as dog's.
    await sidebarRow(sidebar, 'The quick fox anchor').click();
    await page.clock.runFor(100);
    await sidebarRow(sidebar, 'The lazy dog anchor').click();

    // Advance past thread-fox's original ~350ms deadline (now ~250ms away)
    // but stop short of thread-dog's later one. Without clearing the prior
    // timer before scheduling a new one, the orphaned fox timer fires here
    // and opens a popover for the thread the user already moved away from —
    // no popover should exist yet.
    await page.clock.runFor(300);
    await expect(page.locator(`#${EDITOR_ID}-thread-popover`)).toHaveCount(0);

    // Advance past thread-dog's own deadline: its popover opens correctly in
    // both the fixed and reverted runs — the count(0) assertion above is
    // what actually distinguishes them.
    await page.clock.runFor(100);
    await expect(popoverTitle(page)).toContainText('The lazy dog anchor');
  });

  // NOTE on a case NOT covered by a test here: a guard keyed only on
  // activeThreadId (rather than activeThreadId AND popoverThreadId) could in
  // principle block a legitimate retry — if the deferred timer fires while
  // editorRef.getView() is unavailable, popoverThreadId never gets set, and
  // a later re-click of the same row would look identical to "already open"
  // under a narrower guard. handleSidebarThreadSelect's guard checks both
  // for exactly this reason. It is deliberately NOT pinned by a Playwright
  // test: the only way found to make the view unavailable mid-delay
  // (switching to the Diff/Summary tab, which unmounts MarkdownEditor) also
  // remounts the editor and re-syncs `threads` through the anchor plugin —
  // and that re-sync alone reopens the popover via the separate deep-linking
  // `$effect` above, independent of this guard, even with the narrower
  // (activeThreadId-only) guard in place. Verified empirically: reverting
  // this guard to activeThreadId-only and switching Editor → Diff → Editor
  // with NO re-click at all still reopens the popover on its own. A test
  // built on that trigger would pass identically whether or not this guard
  // is narrowed, which is not a test worth keeping (see this repo's
  // "a test that passes either way is worse than no test").
  test('two sidebar selections with no delay between them still land on the second', async ({
    componentPage,
  }) => {
    // The zero-virtual-time-gap edge of the same class of bug the "cancels
    // the first timer" test above pins with a staggered gap: both clicks
    // schedule a timer at (as far as the paused clock is concerned) the
    // identical deadline. Confirms the second selection's timer clearing the
    // first still resolves correctly even when there was never a window to
    // observe an intermediate state in.
    const { page, mount } = await openExample(componentPage);
    const sidebar = await openSidebar(page, mount);

    await installPausedClock(page);

    await sidebarRow(sidebar, 'The quick fox anchor').click();
    await sidebarRow(sidebar, 'The lazy dog anchor').click();
    await page.clock.runFor(500);

    await expect(popoverTitle(page)).toContainText('The lazy dog anchor');
  });
});
