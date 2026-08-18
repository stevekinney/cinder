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

async function pressCommentNavigationChordAndExpectAnnouncement(
  page: import('@playwright/test').Page,
  mount: import('@playwright/test').Locator,
): Promise<void> {
  const chord = await commentNavigationChord(page);
  const liveRegion = mount.locator(
    '[role="status"][aria-live="polite"]:not(.comments-count-announcer)',
  );

  // The message clears after 1000ms. Capture mutations from the always-present
  // live region before dispatching the chord so the assertion does not depend
  // on Playwright observing the node during that transient lifetime.
  await liveRegion.evaluate((region) => {
    const observedRegion = region as HTMLElement & {
      cinderAnnouncementObserver?: MutationObserver;
    };
    observedRegion.cinderAnnouncementObserver?.disconnect();
    const captureAnnouncement = () => {
      const announcement = observedRegion.textContent?.trim();
      if (announcement) {
        observedRegion.dataset['observedAnnouncement'] = announcement;
      }
    };
    observedRegion.cinderAnnouncementObserver = new MutationObserver(captureAnnouncement);
    observedRegion.cinderAnnouncementObserver.observe(observedRegion, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    captureAnnouncement();
  });

  try {
    await page.keyboard.press(chord);
    await expect(liveRegion).toHaveAttribute(
      'data-observed-announcement',
      /^Comment 1 of 1(?:$|:)/,
    );
  } finally {
    await liveRegion.evaluate((region) => {
      const observedRegion = region as HTMLElement & {
        cinderAnnouncementObserver?: MutationObserver;
      };
      observedRegion.cinderAnnouncementObserver?.disconnect();
      delete observedRegion.cinderAnnouncementObserver;
      delete observedRegion.dataset['observedAnnouncement'];
    });
  }
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

    await pressCommentNavigationChordAndExpectAnnouncement(page, mount);

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

const READONLY_ROUTE = `${PLAYGROUND_URL}/page/review-editor?snapshot=1`;
// with-comments-readonly.example.svelte — same "Architecture Notes" text
// anchor as with-comments, but mode="readonly". No front matter, so no
// front-matter text inputs ahead of the editor in DOM order.
const READONLY_EXAMPLE_MOUNT = '#example-mount-with-comments-readonly';

test.describe('ReviewEditor comment-anchor accessibility, readonly mode (cinder#1304 review finding)', () => {
  test('the comment-navigation chord still works when Tab lands on the readonly host, not inside the editor', async ({
    page,
  }) => {
    await page.goto(READONLY_ROUTE, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const mount = page.locator(READONLY_EXAMPLE_MOUNT);
    await waitForReviewEditorReady(mount);

    // The behavioral premise this test depends on, checked directly rather
    // than assumed: `setEditorReadonly` (editor.ts) sets
    // `contenteditable="false"` on the ProseMirror DOM node and nothing
    // else — ProseMirror itself never sets an explicit `tabindex` on that
    // node (its focusability normally comes entirely from
    // `contenteditable="true"`'s implicit tab-stop). So in readonly mode a
    // real Tab press cannot land inside the editor at all; it has to land
    // on the outer `.markdown-editor.surface` host instead, which carries
    // `tabindex="0"` unconditionally (markdown-editor.svelte). Confirmed
    // here via the real accessibility/focus machinery, not inferred from
    // source reading alone.
    const editorSurface = getEditorSurface(mount);
    await expect(editorSurface).toBeVisible();
    expect(await editorSurface.getAttribute('contenteditable')).toBe('false');

    // Tab from a known point before the editor (the sidebar toggle, always
    // present and first-focusable in this fixture) until focus reaches
    // either the editor dom or its outer host, whichever the browser's
    // real tab order hits first. There's a "Copy to clipboard" button
    // between the two in DOM order, so a single Tab press does not land
    // here directly — a bounded loop (deterministic step count, not a
    // timeout) advances past it without hard-coding how many stops away
    // the editor is, which would silently drift if the toolbar between
    // them ever changes.
    const hostLocator = mount.locator('.markdown-editor.surface');
    const sidebarToggle = mount.getByRole('button', { name: /open comments sidebar/i });
    await sidebarToggle.focus();
    await expect(sidebarToggle).toBeFocused();

    let landedOnHost = false;
    let landedOnEditorDom = false;
    for (let step = 0; step < 10 && !landedOnHost && !landedOnEditorDom; step++) {
      await page.keyboard.press('Tab');
      landedOnEditorDom = await editorSurface.evaluate((node) => node === document.activeElement);
      landedOnHost = await hostLocator.evaluate((node) => node === document.activeElement);
    }

    // The behavioral claim: a real Tab traversal never lands focus inside
    // the (now non-editable) editor dom in readonly mode — it lands on the
    // host instead.
    expect(landedOnEditorDom).toBe(false);
    expect(landedOnHost).toBe(true);

    // The actual finding: fire the chord from here (host-focused, not
    // editor-dom-focused) and confirm it still navigates — i.e. the
    // scoping guard accepts an ancestor of the editor dom, not just the
    // editor dom or its descendants.
    await pressCommentNavigationChordAndExpectAnnouncement(page, mount);
    const popover = page.locator('.thread-popover');
    await expect(popover).toBeVisible({ timeout: 5_000 });
    await expect(popover.getByText('This title is clear. I would keep it.')).toBeVisible();
  });

  test('the chord still ignores focus genuinely outside the editor in readonly mode too', async ({
    page,
  }) => {
    await page.goto(READONLY_ROUTE, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const mount = page.locator(READONLY_EXAMPLE_MOUNT);
    await waitForReviewEditorReady(mount);

    const sidebarToggle = mount.getByRole('button', { name: /open comments sidebar/i });
    await expect(sidebarToggle).toBeVisible();
    await sidebarToggle.focus();
    await expect(sidebarToggle).toBeFocused();

    await page.keyboard.press(await commentNavigationChord(page));

    await expect(sidebarToggle).toBeFocused();
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
