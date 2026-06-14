import type { Page } from '@playwright/test';
import { expect, test, type ComponentPage } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS } from '../src/helpers/manifest.ts';

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SelectionGeometry = {
  anchorBox: Box;
  boundingBox: Box;
  clientRectCount: number;
};

const manifest = loadManifest();

function getDesktopViewport(): (typeof VIEWPORTS)[number] {
  const viewport = VIEWPORTS.find((candidate) => candidate.name === 'desktop');
  if (!viewport) {
    throw new Error('Desktop viewport is required for selection-popover positioning tests.');
  }
  return viewport;
}

const desktopViewport = getDesktopViewport();

function manifestEntry() {
  const entry = manifest.find((candidate) => candidate.slug === 'selection-popover');
  if (!entry) {
    throw new Error('Missing manifest entry for selection-popover.');
  }
  return entry;
}

async function openPage(componentPage: ComponentPage): Promise<Page> {
  return componentPage.open({
    entry: manifestEntry(),
    theme: 'light',
    viewport: desktopViewport,
  });
}

function requireBox(box: Box | null, label: string): Box {
  if (!box) {
    throw new Error(`${label} must have a layout box.`);
  }
  return box;
}

async function selectTextInExample(
  page: Page,
  text: string,
  options: { constrainClosestArticleWidth?: string } = {},
): Promise<SelectionGeometry> {
  return page.evaluate(
    ({ selectedText, constrainClosestArticleWidth }) => {
      function findTextNode(root: Node): Text | null {
        if (root.nodeType === Node.TEXT_NODE && root.textContent?.includes(selectedText)) {
          const parentElement = root.parentElement;
          if (parentElement && parentElement.getClientRects().length > 0) {
            return root as Text;
          }
        }

        for (const child of Array.from(root.childNodes)) {
          const found = findTextNode(child);
          if (found) return found;
        }

        return null;
      }

      const textNode = findTextNode(document.body);
      if (!textNode) {
        throw new Error(`Unable to find text node containing "${selectedText}".`);
      }

      if (constrainClosestArticleWidth) {
        const article = textNode.parentElement?.closest<HTMLElement>('article');
        if (article) {
          article.style.maxWidth = constrainClosestArticleWidth;
          article.style.width = constrainClosestArticleWidth;
        }
      }

      const sourceText = textNode.textContent ?? '';
      const start = sourceText.indexOf(selectedText);
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + selectedText.length);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));

      const clientRects = Array.from(range.getClientRects()).filter((clientRect) => {
        return clientRect.width > 0 && clientRect.height > 0;
      });
      const anchorRect = clientRects[0] ?? range.getBoundingClientRect();
      const boundingRect = range.getBoundingClientRect();

      return {
        anchorBox: {
          x: anchorRect.x,
          y: anchorRect.y,
          width: anchorRect.width,
          height: anchorRect.height,
        },
        boundingBox: {
          x: boundingRect.x,
          y: boundingRect.y,
          width: boundingRect.width,
          height: boundingRect.height,
        },
        clientRectCount: clientRects.length,
      };
    },
    { selectedText: text, constrainClosestArticleWidth: options.constrainClosestArticleWidth },
  );
}

function expectBoxInsideViewport(box: Box, viewport: { width: number; height: number }) {
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

function boxesOverlap(first: Box, second: Box): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

function isBoxInsideViewport(box: Box, viewport: { width: number; height: number }): boolean {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height
  );
}

function isSelectionPopoverPlacement(
  selectionBox: Box,
  popoverBox: Box,
  placement: string | null,
): boolean {
  if (popoverBox.width <= 0 || popoverBox.height <= 0) return false;
  if (!placement || !/^(top|bottom)/.test(placement)) return false;

  const verticalGap = placement.startsWith('top')
    ? selectionBox.y - (popoverBox.y + popoverBox.height)
    : popoverBox.y - (selectionBox.y + selectionBox.height);

  if (verticalGap < 4 || verticalGap > 32) return false;

  const selectionCenter = selectionBox.x + selectionBox.width / 2;
  return (
    selectionCenter >= popoverBox.x - 16 && selectionCenter <= popoverBox.x + popoverBox.width + 16
  );
}

function expectSelectionPopoverPlacement(
  selectionBox: Box,
  popoverBox: Box,
  placement: string | null,
) {
  expect(isSelectionPopoverPlacement(selectionBox, popoverBox, placement)).toBe(true);
}

async function waitForSelectionPopoverPlacement(page: Page, selector: string, selectionBox: Box) {
  await expect
    .poll(async () => {
      const popover = page.locator(selector);
      const popoverBox = await popover.boundingBox();
      if (!popoverBox) return false;
      return isSelectionPopoverPlacement(
        selectionBox,
        popoverBox,
        await popover.getAttribute('data-cinder-placement'),
      );
    })
    .toBe(true);
}

async function waitForSelectionPopoverClearOfSelection(
  page: Page,
  selector: string,
  selectionBox: Box,
) {
  await expect
    .poll(async () => {
      const popoverBox = await page.locator(selector).boundingBox();
      if (!popoverBox) return false;
      return (
        !boxesOverlap(selectionBox, popoverBox) && isBoxInsideViewport(popoverBox, desktopViewport)
      );
    })
    .toBe(true);
}

test('selected text popover and composer anchor without overlapping the selection', async ({
  componentPage,
}) => {
  const page = await openPage(componentPage);
  const selection = await selectTextInExample(page, 'appears near highlighted text');

  const popover = page.locator('#basic-selection-popover');
  await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');
  await expect
    .poll(() => popover.evaluate((element) => element.parentElement === document.body))
    .toBe(true);

  const collapsedBox = requireBox(await popover.boundingBox(), 'Collapsed selection popover');
  expectSelectionPopoverPlacement(
    selection.anchorBox,
    collapsedBox,
    await popover.getAttribute('data-cinder-placement'),
  );
  expectBoxInsideViewport(collapsedBox, desktopViewport);

  await page.getByRole('button', { name: 'Add comment' }).first().click();
  await expect(page.getByRole('textbox', { name: 'Comment text' })).toBeVisible();
  await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');
  await waitForSelectionPopoverClearOfSelection(
    page,
    '#basic-selection-popover',
    selection.anchorBox,
  );

  const expandedBox = requireBox(await popover.boundingBox(), 'Expanded selection popover');
  expect(boxesOverlap(selection.anchorBox, expandedBox)).toBe(false);
  expectBoxInsideViewport(expandedBox, desktopViewport);
});

test('multi-line selections anchor to the first visual client rect', async ({ componentPage }) => {
  const page = await openPage(componentPage);
  const selection = await selectTextInExample(
    page,
    'Clicking the comment icon expands the composer. Submit with the send button',
    { constrainClosestArticleWidth: '12rem' },
  );

  expect(selection.clientRectCount).toBeGreaterThan(1);
  expect(selection.boundingBox.height).toBeGreaterThan(selection.anchorBox.height * 1.5);

  const popover = page.locator('#basic-selection-popover');
  await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');
  await waitForSelectionPopoverPlacement(page, '#basic-selection-popover', selection.anchorBox);

  const popoverBox = requireBox(await popover.boundingBox(), 'Multi-line selection popover');
  expectSelectionPopoverPlacement(
    selection.anchorBox,
    popoverBox,
    await popover.getAttribute('data-cinder-placement'),
  );
  expectBoxInsideViewport(popoverBox, desktopViewport);
});

test('external trigger derives its anchor from the visible marked phrase', async ({
  componentPage,
}) => {
  const page = await openPage(componentPage);
  const trigger = page.getByRole('button', { name: 'Open popover' });
  await trigger.scrollIntoViewIfNeeded();

  const anchor = page.getByTestId('external-trigger-anchor');
  const anchorBox = await anchor.boundingBox();
  expect(anchorBox).not.toBeNull();

  await trigger.click();

  const popover = page.locator('#toggled-selection-popover');
  await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');
  const popoverBox = requireBox(await popover.boundingBox(), 'External trigger selection popover');

  expectSelectionPopoverPlacement(
    requireBox(anchorBox, 'External trigger anchor'),
    popoverBox,
    await popover.getAttribute('data-cinder-placement'),
  );
  expectBoxInsideViewport(popoverBox, desktopViewport);
});

test('viewport edge anchors shift or flip inside the viewport', async ({ componentPage }) => {
  const page = await openPage(componentPage);
  const trigger = page.getByRole('button', { name: 'Show clamping test popovers' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  for (const selector of [
    '#viewport-clamp-negative-x',
    '#viewport-clamp-overflow-x',
    '#viewport-clamp-negative-y',
  ]) {
    const popover = page.locator(selector);
    await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');
    const popoverBox = requireBox(await popover.boundingBox(), `${selector} popover`);
    expectBoxInsideViewport(popoverBox, desktopViewport);
  }
});

test('selection flush to viewport top places popover below the selection without overlapping', async ({
  componentPage,
}) => {
  // Regression test for issue #369: when a selection sits flush against the
  // viewport top and there is ample room below, the popover must anchor below
  // the selection's BOTTOM edge (y + height), not its top edge. Without the
  // fix, the virtual anchor had zero height so `bottom` equalled `top` — causing
  // floating-ui's flip middleware to place the popover's top at `anchor.bottom +
  // offset = selection.top + 8`, which overlapped the selection line.
  const page = await openPage(componentPage);

  // Step 1: scroll so the target text is at the very top of the viewport,
  // giving no room above for a `top` placement and forcing a bottom-placement
  // flip. Scroll and selection geometry are split into separate evaluate calls
  // so the browser frame settles after the scroll before we capture post-scroll
  // coordinates. The scroll returns its intended target so we can wait on a
  // condition that is satisfied even when no scroll was needed (the text is
  // already flush to the top, so `initialRect.top` is 0) — waiting on
  // `scrollY > 0` would hang in that case.
  const targetScrollY = await page.evaluate(() => {
    function findTextNode(root: Node, searchText: string): Text | null {
      if (root.nodeType === Node.TEXT_NODE && root.textContent?.includes(searchText)) {
        const parentElement = root.parentElement;
        if (parentElement && parentElement.getClientRects().length > 0) {
          return root as Text;
        }
      }
      for (const child of Array.from(root.childNodes)) {
        const found = findTextNode(child, searchText);
        if (found) return found;
      }
      return null;
    }

    const textNode = findTextNode(document.body, 'appears near highlighted text');
    if (!textNode) throw new Error('Text "appears near highlighted text" not found.');

    const initialRect = textNode.parentElement?.getBoundingClientRect();
    if (initialRect) {
      window.scrollBy(0, initialRect.top);
    }
    // The page may already be scrolled past the document's max, so clamp the
    // expected value to whatever the browser actually allows.
    const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
    return Math.max(0, Math.min(window.scrollY, maxScrollY));
  });

  // Wait for the scroll to settle so viewport-relative coordinates are stable.
  // `scrollY` has already reached its target inside the evaluate above; this
  // waits for the rendered frame to reflect it (and resolves immediately when
  // the target is 0 — no scroll was needed).
  await page.waitForFunction((expected) => Math.abs(window.scrollY - expected) <= 1, targetScrollY);

  // Step 2: now that the frame has settled, create the selection and capture
  // post-scroll geometry. The anchorBox.y must be near 0 because the text is
  // flush with the viewport top.
  const selectionGeometry = await page.evaluate(() => {
    function findTextNode(root: Node, searchText: string): Text | null {
      if (root.nodeType === Node.TEXT_NODE && root.textContent?.includes(searchText)) {
        const parentElement = root.parentElement;
        if (parentElement && parentElement.getClientRects().length > 0) {
          return root as Text;
        }
      }
      for (const child of Array.from(root.childNodes)) {
        const found = findTextNode(child, searchText);
        if (found) return found;
      }
      return null;
    }

    const selectedText = 'appears near highlighted text';
    const textNode = findTextNode(document.body, selectedText);
    if (!textNode) throw new Error(`Text "${selectedText}" not found.`);

    const sourceText = textNode.textContent ?? '';
    const start = sourceText.indexOf(selectedText);
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, start + selectedText.length);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));

    const clientRects = Array.from(range.getClientRects()).filter(
      (clientRect) => clientRect.width > 0 && clientRect.height > 0,
    );
    const anchorRect = clientRects[0] ?? range.getBoundingClientRect();

    return {
      anchorBox: {
        x: anchorRect.x,
        y: anchorRect.y,
        width: anchorRect.width,
        height: anchorRect.height,
      },
    };
  });

  // The selection must be near the viewport top (within one line height).
  expect(selectionGeometry.anchorBox.y).toBeLessThanOrEqual(30);

  const popover = page.locator('#basic-selection-popover');
  await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');

  // Poll until the popover is positioned and does not overlap the selection.
  await waitForSelectionPopoverClearOfSelection(
    page,
    '#basic-selection-popover',
    selectionGeometry.anchorBox,
  );

  const popoverBox = requireBox(await popover.boundingBox(), 'Flush-top selection popover');

  // Primary assertion: no overlap — the bug caused ~8.5px overlap.
  expect(boxesOverlap(selectionGeometry.anchorBox, popoverBox)).toBe(false);
  // Popover must stay fully inside the viewport.
  expectBoxInsideViewport(popoverBox, desktopViewport);
  // With ample room below, the popover should use bottom placement.
  const placement = await popover.getAttribute('data-cinder-placement');
  expect(placement).toMatch(/^bottom/);

  // Also verify the expanded composer does not overlap (the workaround sized
  // the padding to 8rem specifically because the composer is ~114px tall).
  await page.getByRole('button', { name: 'Add comment' }).first().click();
  await expect(page.getByRole('textbox', { name: 'Comment text' })).toBeVisible();
  await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');
  await waitForSelectionPopoverClearOfSelection(
    page,
    '#basic-selection-popover',
    selectionGeometry.anchorBox,
  );

  const expandedBox = requireBox(await popover.boundingBox(), 'Flush-top expanded composer');
  expect(boxesOverlap(selectionGeometry.anchorBox, expandedBox)).toBe(false);
  expectBoxInsideViewport(expandedBox, desktopViewport);
});

test('existing commented selection story renders and switches persisted anchors', async ({
  componentPage,
}) => {
  const page = await openPage(componentPage);
  const anchors = page.getByTestId('existing-comment-anchor');

  await anchors.first().scrollIntoViewIfNeeded();
  await expect(anchors).toHaveCount(2);
  await expect(anchors.first()).toHaveAttribute('data-active', 'true');
  await expect(anchors.first()).toHaveAttribute('aria-current', 'true');
  await expect(anchors.first()).toHaveAttribute('aria-controls', 'existing-comment-panel');
  await expect(page.getByText('This phrase already has a persisted comment.')).toBeVisible();

  await anchors.nth(1).click();

  await expect(anchors.first()).toHaveAttribute('data-active', 'false');
  await expect(anchors.first()).not.toHaveAttribute('aria-current', 'true');
  await expect(anchors.nth(1)).toHaveAttribute('data-active', 'true');
  await expect(anchors.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('ReviewEditor uses commentary anchor decorations')).toBeVisible();
});
