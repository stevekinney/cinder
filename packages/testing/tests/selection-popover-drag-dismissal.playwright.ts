import type { Page } from '@playwright/test';
import { expect, test, type ComponentPage } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS } from '../src/helpers/manifest.ts';

const manifest = loadManifest();
const INJECTED_CONTENT_ID = 'selection-popover-drag-dismissal-injected-content';

function getDesktopViewport(): (typeof VIEWPORTS)[number] {
  const viewport = VIEWPORTS.find((candidate) => candidate.name === 'desktop');
  if (!viewport) {
    throw new Error('Desktop viewport is required for selection-popover drag tests.');
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

/**
 * Appends a very long paragraph as a child of the "basic" example's
 * surface `<article>` — the same element selection-popover.examples.json
 * binds via `bind:this={surfaceElement}` and checks with
 * `surface.contains(range.commonAncestorContainer)` before opening the
 * popover. The "basic" example's own text is short and fits entirely
 * within one viewport, so a drag that reaches the viewport's bottom edge
 * (needed to trigger the browser's native autoscroll-while-selecting)
 * would otherwise have to leave the article and land in unrelated page
 * content — a different, uninteresting failure mode from the one under
 * test (the popover simply never opens). Injecting long content INTO the
 * same article keeps the whole drag inside the surface's own subtree while
 * still requiring real scrolling to reach it.
 */
async function injectLongSelectableContent(page: Page): Promise<void> {
  await page.evaluate(
    ({ anchorText, contentId }) => {
      function findTextNode(root: Node): Text | null {
        if (root.nodeType === Node.TEXT_NODE && root.textContent?.includes(anchorText)) {
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
      const article = textNode?.parentElement?.closest('article');
      if (!article) {
        throw new Error(`Unable to find the surface <article> containing "${anchorText}".`);
      }

      const paragraph = document.createElement('p');
      paragraph.id = contentId;
      paragraph.style.margin = '0';
      paragraph.style.lineHeight = '1.6';
      paragraph.textContent = Array.from({ length: 6000 }, (_, index) => `word${index}`).join(' ');
      article.append(paragraph);
    },
    { anchorText: 'appears near highlighted text', contentId: INJECTED_CONTENT_ID },
  );
}

type StartEnd = {
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/**
 * Resolves the drag's start point (the first character of the "basic"
 * example's own short phrase, near the top of the unscrolled page) and end
 * point (a real caret position, inside the injected long paragraph, sitting
 * right at the bottom edge of the CURRENT viewport). Holding the pointer at
 * that end point is what triggers native autoscroll — the position must be
 * resolvable to real text inside the surface at the moment the drag reaches
 * it, before any scrolling has happened.
 */
async function resolveDragPoints(page: Page, viewportHeight: number): Promise<StartEnd> {
  return page.evaluate(
    ({ anchorText, contentId, targetViewportHeight }) => {
      function findTextNode(root: Node): Text | null {
        if (root.nodeType === Node.TEXT_NODE && root.textContent?.includes(anchorText)) {
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

      const anchorTextNode = findTextNode(document.body);
      if (!anchorTextNode) {
        throw new Error(`Unable to find text node containing "${anchorText}".`);
      }
      const sourceText = anchorTextNode.textContent ?? '';
      const startIndex = sourceText.indexOf(anchorText);
      const startRange = document.createRange();
      startRange.setStart(anchorTextNode, startIndex);
      startRange.setEnd(anchorTextNode, startIndex + 1);
      const startRect = startRange.getBoundingClientRect();

      const injectedParagraph = document.getElementById(contentId);
      if (!injectedParagraph) {
        throw new Error('Injected long-content paragraph is missing.');
      }
      const article = injectedParagraph.closest('article');
      if (!article) {
        throw new Error('Injected paragraph is not inside a surface <article>.');
      }

      const targetY = targetViewportHeight - 8;
      const targetX = injectedParagraph.getBoundingClientRect().left + 10;
      const caretRange = document.caretRangeFromPoint(targetX, targetY);
      if (!caretRange || !article.contains(caretRange.startContainer)) {
        throw new Error('No real caret position inside the surface at the viewport bottom edge.');
      }

      return {
        start: { x: startRect.left + 1, y: startRect.top + startRect.height / 2 },
        end: { x: targetX, y: targetY },
      };
    },
    {
      anchorText: 'appears near highlighted text',
      contentId: INJECTED_CONTENT_ID,
      targetViewportHeight: viewportHeight,
    },
  );
}

test('a real drag-select that autoscrolls the viewport does not dismiss the popover it is opening', async ({
  componentPage,
}) => {
  const page = await openPage(componentPage);
  await injectLongSelectableContent(page);
  const points = await resolveDragPoints(page, desktopViewport.height);

  const popover = page.locator('#basic-selection-popover');

  // Drive an actual drag-select gesture from the example's own short phrase
  // down into the injected long content, ending right at the viewport's
  // bottom edge, and hold there — the exact interaction reported as
  // dismissing the popover the instant it opens. `selectionchange` opens
  // the popover mid-drag (well before pointerup); the browser's native
  // autoscroll-while-selecting then fires real `scroll` events on `window`
  // while the pointer is still down.
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  for (let step = 1; step <= 20; step += 1) {
    const x = points.start.x + ((points.end.x - points.start.x) * step) / 20;
    const y = points.start.y + ((points.end.y - points.start.y) * step) / 20;
    await page.mouse.move(x, y);
  }

  const scrollYBeforeHold = await page.evaluate(() => window.scrollY);
  // Wait deterministically for native autoscroll to actually engage while
  // the pointer is held, instead of a fixed sleep — a fixed delay is a
  // common source of flake on slower CI runners (either not long enough for
  // autoscroll to kick in, or needlessly long once it has). Failing this
  // wait (rather than a silently-vacuous pass) means the test isn't
  // exercising the real mechanism at all.
  await page.waitForFunction((before) => window.scrollY > before, scrollYBeforeHold, {
    timeout: 5_000,
  });
  const scrollYAfterHold = await page.evaluate(() => window.scrollY);

  expect(
    scrollYAfterHold,
    'expected the browser to autoscroll while the drag held at the viewport edge',
  ).toBeGreaterThan(scrollYBeforeHold);

  // The popover must have opened DURING the still-in-progress drag...
  await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');

  await page.mouse.up();

  // ...and must still be open once the gesture completes — not dismissed by
  // the autoscroll `scroll` events the same gesture produced while held.
  await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');
  await expect(page.getByRole('button', { name: 'Add comment' }).first()).toBeVisible();

  // A later, genuinely external scroll (the user scrolling away after the
  // selection is done) must still dismiss the popover normally.
  await page.mouse.wheel(0, 300);
  await expect(popover).toHaveAttribute('data-cinder-position-ready', 'false');
});
