/**
 * cinder#1304 — `.comment-anchor` decorations carried only `class` and
 * `data-thread-id`, both invisible to assistive tech. Verified here against a
 * REAL Chromium accessibility tree and REAL keyboard input, per this
 * package's harness-skeptic guidance: happy-dom can confirm the DOM
 * attributes are present (packages/editor's own
 * anchor-decorations-a11y.test.ts and comment-navigation.test.ts do that) but
 * cannot compute what a screen reader actually hears or prove a real Tab
 * traversal's behavior — this repo has a documented precedent (cinder#1292)
 * for a filed a11y fix being wrong until measured against the accessibility
 * tree rather than DOM attribute presence.
 */
import { expect, test } from '@playwright/test';
import { runAxe } from '../src/helpers/axe.ts';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';

const ROUTE = `${PLAYGROUND_URL}/page/review-editor?snapshot=1`;
// The `with-comments` example seeds a text-anchored thread on "Architecture
// Notes" (a top-level heading, so a unique quote in the document) and a
// document-level thread — see
// packages/playground/src/examples/review-editor/with-comments.example.svelte.
const EXAMPLE_MOUNT = '#example-mount-with-comments';

/**
 * The comment-navigation chord is platform-aware (Cmd+Option on mac,
 * Ctrl+Alt elsewhere) specifically to avoid colliding with macOS
 * VoiceOver's own Control+Option modifier prefix — a PR review finding on
 * this fix (a literal Ctrl-Alt-Arrow chord is consumed by VoiceOver before
 * it ever reaches the page on a Mac, defeating the one keyboard route this
 * fix gives AT users). CI's Chromium runs on Linux; a local run may be on
 * darwin — computing the chord from the PAGE's own `navigator.platform`
 * (not the test runner's OS) is what actually matches what the component
 * itself checks.
 */
async function commentNavigationChord(page: import('@playwright/test').Page): Promise<string> {
  const isMacPlatform = await page.evaluate(() => /Mac|iPod|iPhone|iPad/.test(navigator.platform));
  return isMacPlatform ? 'Meta+Alt+ArrowDown' : 'Control+Alt+ArrowDown';
}

/**
 * `getByRole('textbox')` matches a plain `<input>` too (its implicit ARIA
 * role), and this fixture's front-matter panel renders `owner`/`status`
 * text inputs ahead of the ProseMirror editor in DOM order — `.first()`
 * silently grabbed one of those instead of the editor during this fix's own
 * review round, making every assertion after `.click()` operate on the
 * wrong element while still reporting "focused" successfully. The editor's
 * accessible name (`label` prop, defaulted in markdown-editor.svelte) is
 * distinct from any front-matter field's own label, so naming it is what
 * actually disambiguates — `.first()` never did.
 */
function getEditorSurface(mount: import('@playwright/test').Locator) {
  return mount.getByRole('textbox', { name: 'Markdown editor' });
}

async function waitForReviewEditorReady(mount: import('@playwright/test').Locator) {
  // Default assertion budget (this package's playwright.config.ts sets no
  // `expect.timeout`, so 5s) — a review finding correctly flagged the
  // earlier 20s override as exactly the kind of timeout increase this
  // repo's policy blocks. Local runs settle this well under 5s; if CI ever
  // needs longer, that's a real startup-race fact to investigate, not a
  // threshold to pre-pad.
  await expect(mount.locator('[data-testid="review-editor"]')).toHaveAttribute(
    'data-ready',
    'true',
  );
}

test.describe('ReviewEditor comment-anchor accessibility (cinder#1304)', () => {
  test('the anchor is announced as a mark in the real accessibility tree, not just via a DOM attribute', async ({
    page,
  }) => {
    await page.goto(ROUTE, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const mount = page.locator(EXAMPLE_MOUNT);
    const anchor = mount.locator('[data-thread-id="thread-architecture-title"]').first();
    await expect(anchor).toBeVisible();

    // DOM attributes: the mechanism.
    expect(await anchor.getAttribute('role')).toBe('mark');
    expect(await anchor.getAttribute('aria-description')).toBeTruthy();

    // The actual computed accessibility tree: the claim. `ariaSnapshot`
    // reflects Chromium's real AX mapping, not the DOM attributes we wrote —
    // if role="mark" did not survive to the AX tree (e.g. because a
    // contenteditable ancestor stripped it, or Chromium doesn't expose
    // role=mark the way it's requested), this is where that would show up.
    const snapshot = await anchor.ariaSnapshot();
    expect(snapshot.toLowerCase()).toContain('mark');
    // The highlighted text itself must still be part of the accessible
    // content — role="mark" must not have replaced or hidden it.
    expect(snapshot).toContain('Architecture Notes');

    // No new axe violation from adding role/aria-description to an inline
    // decoration inside a contenteditable region.
    const buckets = await runAxe(
      page,
      { slug: 'review-editor', theme: 'light', viewport: 'desktop', fixture: 'with-comments-a11y' },
      { include: EXAMPLE_MOUNT },
    );
    const violations = Object.values(buckets).flat();
    expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
  });

  test('the comment-navigation chord moves the caret to the anchor and opens its thread — the real keyboard route, not tabindex', async ({
    page,
  }) => {
    await page.goto(ROUTE, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const mount = page.locator(EXAMPLE_MOUNT);
    await waitForReviewEditorReady(mount);
    const editorSurface = getEditorSurface(mount);
    await expect(editorSurface).toBeVisible();

    // Confirm the decoration genuinely is NOT a Tab stop — the issue itself
    // flags tabindex on an inline decoration as the fragile, likely-wrong
    // fix, and this fix deliberately did not add one. A real Tab press (not
    // a tabindex assertion) is the only thing that actually proves this.
    const anchor = mount.locator('[data-thread-id="thread-architecture-title"]').first();
    expect(await anchor.getAttribute('tabindex')).toBeNull();

    await editorSurface.click();
    await expect(editorSurface).toBeFocused();
    // Put the caret at the very start of the document, before the anchored
    // heading, so "next comment" has somewhere real to move it TO.
    await page.keyboard.press('Control+Home');

    await page.keyboard.press(await commentNavigationChord(page));

    // The live-region announcement (`LiveRegion.announce`,
    // review-editor-impl.svelte) self-clears via a hard-coded 1000ms
    // `setTimeout` — it is not "the popover's own text mirrored a second
    // place," it is a genuinely TRANSIENT piece of DOM state with a fixed
    // lifetime. Checked FIRST, before the (structurally slower) popover
    // wait below: `handleSidebarThreadSelect`'s own 350ms `POSITION_DELAY_MS`
    // plus Playwright's per-`expect` polling overhead measured ~620ms
    // end-to-end locally in development — comfortably under 1000ms on a
    // fast machine, but this exact test failed in CI with only this
    // assertion red (the popover checks right before it passed), which is
    // consistent with a slower CI runner's cumulative wait for the popover
    // alone consuming enough of that 1000ms budget to lose the race, not
    // with a locator-scope bug (a scope bug would fail deterministically,
    // including locally, not intermittently on one runner). Checking this
    // FIRST — nothing before it can consume any of the 1000ms window —
    // removes the race instead of budgeting around it with a longer timeout,
    // which this repo's policy blocks regardless of justification.
    await expect(mount.getByText('Comment 1 of 1', { exact: false })).toBeVisible();

    // The popover for the thread opened — the keyboard route actually
    // works. This has no comparable lifetime limit (it stays open until
    // dismissed), so checking it after the transient announcement above is
    // safe.
    const popover = page.locator('.thread-popover');
    await expect(popover).toBeVisible({ timeout: 5_000 });
    await expect(popover.getByText('This title is clear. I would keep it.')).toBeVisible();

    // The caret genuinely moved onto the anchor's text, not just "a popover
    // opened somewhere" — checked via the live browser selection, which only
    // a real keydown reaching the real ProseMirror view produces.
    const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '');
    expect(selectedText).toBe('Architecture Notes');

    // A PR review finding raised the concern that the anchor's own
    // non-collapsed text selection (this example is editable, with
    // currentUserId set) could also arm the "add new comment" selection
    // popover. Investigated directly (see navigateToAdjacentComment's own
    // doc comment in review-editor-impl.svelte for the full real-Chromium
    // probe): it does not reproduce — the element never enters the DOM.
    // This assertion is a plain regression guard for that, not proof of a
    // fix for a bug that was never confirmed to exist.
    const selectionPopover = page.locator('[id$="-selection-popover"]');
    await expect(selectionPopover).toBeHidden();
  });

  test('the comment-navigation chord is scoped to the editor surface — it does nothing when focus is elsewhere in the component', async ({
    page,
  }) => {
    await page.goto(ROUTE, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const mount = page.locator(EXAMPLE_MOUNT);
    await waitForReviewEditorReady(mount);

    // A PR review finding on this fix: the chord was originally bound to
    // the WHOLE container's keydown, so it also fired from inside the
    // sidebar, a comment composer, or front-matter fields — e.g. hijacking
    // focus into the editor mid-reply. The sidebar starts collapsed; open it
    // first, then focus "Add document comment" — a stable, always-present
    // control clearly outside the ProseMirror surface.
    const sidebarToggle = mount.getByRole('button', { name: /open comments sidebar/i });
    await expect(sidebarToggle).toBeVisible();
    await sidebarToggle.click();

    const sidebarButton = mount.getByLabel('Add document comment');
    await expect(sidebarButton).toBeVisible();
    await sidebarButton.focus();
    await expect(sidebarButton).toBeFocused();

    await page.keyboard.press(await commentNavigationChord(page));

    // Nothing should have happened: focus stays put, and the text-anchored
    // thread's popover — which the chord would have opened if the guard
    // were missing — never appears.
    await expect(sidebarButton).toBeFocused();
    const popover = page.locator('.thread-popover');
    await expect(popover).toBeHidden();
  });
});

/**
 * cinder#1304's stale-vs-live anchor position finding
 * (`navigateToAdjacentComment` used to read `target.anchor` — cached in
 * `threads`, synced only during deferred re-anchoring — instead of the
 * anchor plugin's own live, per-transaction-mapped state, so an edit before
 * an anchor could select stale, unrelated text) is proven in
 * `packages/editor/src/lib/resolve-anchor-selection-range.test.ts`, not
 * here. That file drives a real editor with the real anchor plugin and a
 * precisely controlled `view.dispatch()` insertion strictly inside an
 * existing paragraph's text.
 *
 * A real-browser mouse/keyboard version of this scenario was attempted
 * here first and removed: the only text-anchored thread in this route's
 * `with-comments` fixture starts at the very beginning of the document
 * body (`with-comments.example.svelte`'s `# Architecture Notes`), so
 * "insert something before it" necessarily means inserting a new block at
 * position 0 — which hits a SEPARATE, pre-existing position-mapping
 * ambiguity in the anchor plugin's own boundary handling for that specific
 * edge case (confirmed independent of this fix: it reproduced identically
 * with `resolveAnchorSelectionRange` fully reverted). That ambiguity is out
 * of scope for cinder#1302/#1304/#1306; conflating it with the stale-vs-live
 * claim in one flaky real-browser test would have proven neither cleanly.
 */
