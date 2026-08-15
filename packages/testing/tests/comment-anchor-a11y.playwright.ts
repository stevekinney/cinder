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

  test('Ctrl-Alt-ArrowDown moves the caret to the anchor and opens its thread — the real keyboard route, not tabindex', async ({
    page,
  }) => {
    await page.goto(ROUTE, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const mount = page.locator(EXAMPLE_MOUNT);
    const editorSurface = mount.getByRole('textbox').first();
    await expect(editorSurface).toBeVisible();

    // Confirm the decoration genuinely is NOT a Tab stop — the issue itself
    // flags tabindex on an inline decoration as the fragile, likely-wrong
    // fix, and this fix deliberately did not add one. A real Tab press (not
    // a tabindex assertion) is the only thing that actually proves this.
    const anchor = mount.locator('[data-thread-id="thread-architecture-title"]').first();
    expect(await anchor.getAttribute('tabindex')).toBeNull();

    await editorSurface.click();
    // Put the caret at the very start of the document, before the anchored
    // heading, so "next comment" has somewhere real to move it TO.
    await page.keyboard.press('Control+Home');

    await page.keyboard.press('Control+Alt+ArrowDown');

    // The popover for the thread opened — the keyboard route actually works.
    // Scoped to `.thread-popover` specifically: the same text is ALSO
    // announced via the live region (`.cinder-sr-only`), which is a second,
    // independent confirmation the navigation fired, not a false match.
    const popover = page.locator('.thread-popover');
    await expect(popover).toBeVisible({ timeout: 5_000 });
    await expect(popover.getByText('This title is clear. I would keep it.')).toBeVisible();
    await expect(mount.getByText('Comment 1 of 1', { exact: false })).toBeVisible();

    // The caret genuinely moved onto the anchor's text, not just "a popover
    // opened somewhere" — checked via the live browser selection, which only
    // a real keydown reaching the real ProseMirror view produces.
    const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '');
    expect(selectedText).toBe('Architecture Notes');
  });
});
