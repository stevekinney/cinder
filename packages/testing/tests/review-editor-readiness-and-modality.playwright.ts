/**
 * Browser coverage for three `ReviewEditor` a11y/state-liveness bugs, all
 * filed against the same route (`/page/review-editor?snapshot=1`):
 *
 *   - cinder#1301: `data-ready` is a latch that is set once and never
 *     cleared, so it keeps reporting "ready" after the editor view unmounts.
 *   - cinder#1303: two of the three view tabs always point `aria-controls`
 *     at an element id that is not in the document, because the inactive
 *     views are removed via `{#if}` rather than hidden.
 *   - cinder#1305: the thread popover declares `aria-modal="true"` while
 *     nothing outside it is made inert, and F6 deliberately navigates focus
 *     out of it.
 *
 * Every scenario below pairs a plain DOM assertion with a check against the
 * REAL Chromium accessibility tree (via the CDP Accessibility domain, since
 * Playwright's own `page.accessibility` API was removed in this Playwright
 * version and `locator.ariaSnapshot()` only reports role/name, not computed
 * properties like `modal`). A DOM attribute can say one thing while the
 * browser's actual accessibility computation says another — that gap is
 * exactly what made cinder#1292's first fix attempt wrong until it was
 * checked against the computed tree instead of just attribute presence.
 */
import { expect, test, type Page } from '@playwright/test';

import { runAxe } from '../src/helpers/axe.ts';

const ROUTE = '/page/review-editor?snapshot=1';
const BASIC = '#example-mount-basic';
const WITH_COMMENTS = '#example-mount-with-comments';

/**
 * Resolve the REAL Chromium-computed accessible role for `selector` (scoped
 * under `containerSelector`), via the CDP Accessibility domain rather than a
 * DOM attribute read. Returns `null` when the element does not exist, is
 * accessibility-ignored, or the browser reports no role.
 */
async function computedAxRole(
  page: Page,
  containerSelector: string,
  selector: string,
): Promise<string | null> {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('DOM.enable');
    await client.send('Accessibility.enable');
    const { root } = await client.send('DOM.getDocument', { depth: -1, pierce: true });
    const container = await client.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: containerSelector,
    });
    if (!container.nodeId) return null;
    const target = await client.send('DOM.querySelector', {
      nodeId: container.nodeId,
      selector,
    });
    if (!target.nodeId) return null;
    const { nodes } = await client.send('Accessibility.getPartialAXTree', {
      nodeId: target.nodeId,
      fetchRelatives: false,
    });
    const node = nodes[0];
    if (!node || node.ignored) return null;
    const role = node.role?.value;
    return typeof role === 'string' ? role : null;
  } finally {
    await client.detach();
  }
}

/**
 * Read a single computed AX property (e.g. `'modal'`) off the REAL Chromium
 * accessibility tree for `selector`. Returns `undefined` when the element
 * does not exist or the browser reports no such property.
 */
async function computedAxProperty(
  page: Page,
  selector: string,
  propertyName: string,
): Promise<unknown> {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('DOM.enable');
    await client.send('Accessibility.enable');
    const { root } = await client.send('DOM.getDocument', { depth: -1, pierce: true });
    const target = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!target.nodeId) return undefined;
    const { nodes } = await client.send('Accessibility.getPartialAXTree', {
      nodeId: target.nodeId,
      fetchRelatives: false,
    });
    const node = nodes[0];
    const property = node?.properties?.find((candidate) => candidate.name === propertyName);
    return property?.value?.value;
  } finally {
    await client.detach();
  }
}

async function openBasicReviewEditor(page: Page) {
  await page.goto(ROUTE, { waitUntil: 'load' });
  const container = page.locator(`${BASIC} [data-testid="review-editor"]`);
  await expect(container).toHaveAttribute('data-ready', 'true');
  return container;
}

test.describe('ReviewEditor data-ready liveness (cinder#1301)', () => {
  test('data-ready clears when the editor view unmounts and returns when it remounts', async ({
    page,
  }) => {
    const container = await openBasicReviewEditor(page);

    // Sanity: while mounted, the REAL accessibility tree (not just a DOM
    // attribute) exposes the editor's contenteditable surface as a textbox.
    // ProseMirror's contenteditable div gets this role IMPLICITLY from
    // `contenteditable` per the HTML-AAM — there is no `role="textbox"`
    // attribute in the DOM to assert on directly, which is exactly why this
    // needs the computed tree rather than a `toHaveAttribute` check.
    await expect.poll(() => computedAxRole(page, BASIC, '.ProseMirror')).toBe('textbox');

    const diffTab = page.locator(BASIC).getByRole('tab', { name: 'Diff', exact: true });
    await diffTab.click();

    // Plain DOM assertion: the editor panel and its ProseMirror content are
    // gone from the document entirely (removed by the `{#if}` chain), not
    // merely hidden.
    await expect(page.locator(`${BASIC} [id$="-editor-panel"]`)).toHaveCount(0);
    await expect(page.locator(`${BASIC} .ProseMirror`)).toHaveCount(0);

    // The bug: `data-ready` used to stay "true" here because the latch that
    // sets it was never cleared on unmount.
    await expect(container).not.toHaveAttribute('data-ready');

    // Accessibility-tree assertion: no textbox role survives the unmount —
    // there is nothing left for the browser to expose.
    expect(await computedAxRole(page, BASIC, '.ProseMirror')).toBeNull();

    // Switch back: the readiness signal must also come BACK when the editor
    // view remounts and finishes initializing, not just clear once and stay
    // cleared. This is the half of the contract an "always false" over-fix
    // would still fail.
    const editorTab = page.locator(BASIC).getByRole('tab', { name: 'Editor', exact: true });
    await editorTab.click();
    await expect(container).toHaveAttribute('data-ready', 'true');
    await expect.poll(() => computedAxRole(page, BASIC, '.ProseMirror')).toBe('textbox');
  });
});

test.describe('ReviewEditor view-tab aria-controls (cinder#1303)', () => {
  test('every tab aria-controls resolves to a real panel, and follows the active view', async ({
    page,
  }) => {
    await openBasicReviewEditor(page);

    const tabs = page.locator(`${BASIC} [role="tab"]`);
    await expect(tabs).toHaveCount(3);

    async function readTabState() {
      return page.locator(`${BASIC} [role="tab"]`).evaluateAll((elements) =>
        elements.map((element) => ({
          name: element.textContent?.trim() ?? '',
          selected: element.getAttribute('aria-selected'),
          controls: element.getAttribute('aria-controls'),
          resolves: element.getAttribute('aria-controls')
            ? document.getElementById(element.getAttribute('aria-controls')!) !== null
            : null,
        })),
      );
    }

    const initial = await readTabState();
    for (const tab of initial) {
      if (tab.controls !== null) {
        expect(tab.resolves, `${tab.name} tab's aria-controls should resolve`).toBe(true);
      }
    }
    // Exactly the active (Editor) tab claims a panel; the inactive two make
    // no claim at all rather than a dangling one.
    const editorTab = initial.find((tab) => tab.name === 'Editor');
    const diffTab = initial.find((tab) => tab.name === 'Diff');
    const summaryTab = initial.find((tab) => tab.name === 'Summary');
    expect(editorTab?.selected).toBe('true');
    expect(editorTab?.controls).not.toBeNull();
    expect(diffTab?.controls).toBeNull();
    expect(summaryTab?.controls).toBeNull();

    await page.locator(BASIC).getByRole('tab', { name: 'Diff', exact: true }).click();

    const afterDiff = await readTabState();
    for (const tab of afterDiff) {
      if (tab.controls !== null) {
        expect(tab.resolves, `${tab.name} tab's aria-controls should resolve`).toBe(true);
      }
    }
    const diffTabAfter = afterDiff.find((tab) => tab.name === 'Diff');
    const editorTabAfter = afterDiff.find((tab) => tab.name === 'Editor');
    expect(diffTabAfter?.selected).toBe('true');
    expect(diffTabAfter?.controls).not.toBeNull();
    expect(editorTabAfter?.controls).toBeNull();

    // Accessibility-engine assertion: axe's aria-valid-attr-value rule checks
    // that every IDREF-valued ARIA attribute (aria-controls included)
    // resolves to a real element. A dangling id is exactly what this rule
    // exists to catch.
    const buckets = await runAxe(
      page,
      { slug: 'review-editor', theme: 'light', viewport: 'desktop', fixture: 'basic-tabs' },
      { include: `${BASIC} .review-editor-controls` },
    );
    const idrefViolations = [
      ...buckets.critical,
      ...buckets.serious,
      ...buckets.moderate,
      ...buckets.minor,
    ].filter((violation) => violation.id === 'aria-valid-attr-value');
    expect(idrefViolations, JSON.stringify(idrefViolations, null, 2)).toHaveLength(0);
  });

  test('keyboard roving-tabindex navigation settles on a resolving aria-controls, not a stale one', async ({
    page,
  }) => {
    // Review round finding: SegmentedControlController.handleKeydown calls
    // toggle() (updates `activeView`) and then focuses the destination tab
    // SYNCHRONOUSLY, before Svelte's own reactive DOM patch for that state
    // change has necessarily been applied. This drives that exact path (a
    // real ArrowRight keypress, not a click) and asserts the SETTLED state
    // once Playwright reads it back — which is also the earliest point a
    // real screen reader could ever observe it, since AT reads the
    // accessibility tree only after the current script task yields back to
    // the browser's render/AX pipeline, by which point Svelte's synchronous
    // post-handler flush has already run.
    await openBasicReviewEditor(page);

    const editorTab = page.locator(BASIC).getByRole('tab', { name: 'Editor', exact: true });
    await editorTab.focus();
    await expect(editorTab).toBeFocused();

    await page.keyboard.press('ArrowRight');

    const diffTab = page.locator(BASIC).getByRole('tab', { name: 'Diff', exact: true });
    await expect(diffTab).toBeFocused();
    await expect(diffTab).toHaveAttribute('aria-selected', 'true');

    const controlsId = await diffTab.getAttribute('aria-controls');
    expect(controlsId).not.toBeNull();
    const resolves = await page.evaluate((id) => document.getElementById(id) !== null, controlsId!);
    expect(resolves).toBe(true);

    // The tab that lost selection makes no aria-controls claim at all.
    await expect(editorTab).not.toHaveAttribute('aria-controls');
  });
});

test.describe('ReviewEditor thread popover modality (cinder#1305)', () => {
  async function openThreadPopover(page: Page) {
    await page.goto(ROUTE, { waitUntil: 'load' });
    const container = page.locator(`${WITH_COMMENTS} [data-testid="review-editor"]`);
    await expect(container).toHaveAttribute('data-ready', 'true');

    const anchor = page.locator(`${WITH_COMMENTS} [data-thread-id="thread-architecture-title"]`);
    await anchor.first().click();

    const popover = page.locator(`${WITH_COMMENTS} .thread-popover`);
    await expect(popover).toBeVisible();
    return popover;
  }

  test('the popover does not claim aria-modal, and the browser agrees', async ({ page }) => {
    const popover = await openThreadPopover(page);

    await expect(popover).toHaveAttribute('role', 'dialog');
    await expect(popover).not.toHaveAttribute('aria-modal');

    // The DOM attribute is gone; confirm the browser's own computed
    // accessibility property agrees rather than assuming attribute absence
    // is sufficient. `modal` is a real CDP AXPropertyName Chromium computes
    // for the node, independent of what the DOM markup says.
    const modalProperty = await computedAxProperty(
      page,
      `${WITH_COMMENTS} .thread-popover`,
      'modal',
    );
    expect(modalProperty).not.toBe(true);
  });

  test('F6 still reaches the editor without closing the popover, and the popover is still closable', async ({
    page,
  }) => {
    const popover = await openThreadPopover(page);

    await popover.locator('.thread-popover-close').focus();
    await expect(popover.locator('.thread-popover-close')).toBeFocused();

    // F6 is the component's OWN documented escape hatch from this popover —
    // preserving it (rather than trapping focus entirely, which a
    // "make it actually modal" fix would have required) is part of why
    // removing `aria-modal` rather than adding `inert` was the chosen fix.
    await page.keyboard.press('F6');
    const focusInMain = await page.evaluate((mainSelector) => {
      const main = document.querySelector(mainSelector);
      return !!(main && document.activeElement && main.contains(document.activeElement));
    }, `${WITH_COMMENTS} .review-editor-main`);
    expect(focusInMain).toBe(true);

    // Non-modal means the popover survives focus leaving it — a real modal
    // dialog's focus trap would never have let focus leave in the first
    // place.
    await expect(popover).toBeVisible();

    // Cycle back with Shift+F6 and confirm Escape still closes it — the
    // existing Tab-trap / Escape-restore behavior the issue explicitly says
    // is fine and should not regress.
    await page.keyboard.press('Shift+F6');
    const focusInPopover = await page.evaluate(() => {
      const popoverElement = document.querySelector('.thread-popover');
      return !!(
        popoverElement &&
        document.activeElement &&
        popoverElement.contains(document.activeElement)
      );
    });
    expect(focusInPopover).toBe(true);

    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
  });

  test('switching away from the editor view closes the popover instead of stranding focus in it', async ({
    page,
  }) => {
    // Review round finding: the popover's anchor only exists in the editor
    // view. Leaving it unmounts editorRef (the same unbind #1301's fix
    // relies on), which turns F6's `customFocusHandler` for the 'editor'
    // region into a no-op (`editorRef?.getView()?.focus()` on a null ref)
    // that still returns `true` — suppressing the navigator's fallback and
    // stranding focus inside a popover pointing at content no longer
    // rendered. `onViewChange` already clears the (unrelated) selection
    // popover for the same "left the editor view" reason; the thread popover
    // needed the same treatment.
    //
    // The view change here is driven via the tablist's ArrowRight
    // roving-tabindex handler, not a click: `SegmentedControlController`'s
    // keyboard path calls `toggle()` and `.focus()` directly with no
    // synthetic `click` event, so it does NOT pass through
    // `createClickOutside`'s click listener — which would otherwise close
    // the popover on its own (any click landing outside it, including a
    // real OR keyboard-synthesized one on the Diff tab, triggers that
    // listener) and mask whether THIS fix is what actually closed it.
    const popover = await openThreadPopover(page);

    const editorTab = page.locator(WITH_COMMENTS).getByRole('tab', { name: 'Editor', exact: true });
    await editorTab.focus();
    await expect(editorTab).toBeFocused();
    // Moving focus via .focus() (not a click) must not have already closed
    // the popover — otherwise the assertions below would not be exercising
    // the view-change path at all.
    await expect(popover).toBeVisible();

    await page.keyboard.press('ArrowRight');

    const diffTab = page.locator(WITH_COMMENTS).getByRole('tab', { name: 'Diff', exact: true });
    await expect(diffTab).toHaveAttribute('aria-selected', 'true');
    await expect(popover).toHaveCount(0);

    // Third-round review finding: closing the popover here unmounts it, and
    // its OWN focus trap unconditionally restores focus on deactivate —
    // stealing focus BACK from the tab that ArrowRight just moved it to,
    // landing it on the trap's restoreFallback (the sidebar toggle) instead.
    // A weaker "just not <body>" assertion would not have caught this: the
    // sidebar toggle is a real, valid element, just the WRONG one — the
    // roving-tabindex/ARIA-tabs contract requires focus to stay on the tab
    // that was just activated.
    await expect(diffTab).toBeFocused();
  });
});
