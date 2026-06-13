/// <reference lib="dom" />
/**
 * Regression coverage for playground-owned page chrome on `/c/:name`.
 *
 * The broad focus sweep should be able to separate component-under-test focus
 * rings from reusable playground chrome. These assertions therefore target the
 * component documentation page's own example `Show code` accordion trigger and
 * props-table scroll region on a stable component page. The page is a single
 * scrolling reference (no tabs), so both targets live on one page and are
 * scrolled into view rather than reached through a tab switch.
 */

import { expect, test, type Frame, type Locator, type Page } from '@playwright/test';

const PIXEL_TOLERANCE = 0.5;

type ActiveElementSummary = {
  ariaLabel: string | null;
  className: string;
  id: string;
  role: string | null;
  tagName: string;
  text: string;
};

type FocusPaint = {
  boxShadow: string;
  matchesFocusVisible: boolean;
  outlineColor: string;
  outlineOffset: number;
  outlineStyle: string;
  outlineWidth: number;
  ringColor: string;
  ringWidth: number;
};

async function activeElementSummary(frame: Frame): Promise<ActiveElementSummary | null> {
  return frame.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    return {
      ariaLabel: active.getAttribute('aria-label'),
      className: active.className,
      id: active.id,
      role: active.getAttribute('role'),
      tagName: active.tagName.toLowerCase(),
      text: (active.textContent ?? '').trim().replaceAll(/\s+/g, ' ').slice(0, 120),
    };
  });
}

/**
 * Move keyboard focus onto `target` by focusing the focusable element that
 * immediately precedes it in the document tab order, then pressing `Tab` once.
 *
 * A bare `target.focus()` does NOT engage `:focus-visible` in Chromium, and a
 * blind Tab walk from `document.body` does not traverse into the preview
 * `iframe` (Playwright's `page.keyboard` drives the top page's focus, which
 * starts on the top `body`, not inside the frame). Seeding focus on the
 * in-frame neighbor and pressing `Tab` once is genuine keyboard navigation, so
 * the heuristic that gates `:focus-visible` fires on `target`. The single,
 * element-anchored step also removes the fragile unbounded press budget.
 */
async function tabOntoFromNeighbor(
  page: Page,
  frame: Frame,
  precedingNeighbor: Locator,
  target: Locator,
  label: string,
): Promise<void> {
  await precedingNeighbor.evaluate((element) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    (element as HTMLElement).focus();
  });
  await expect(
    precedingNeighbor,
    `${label}: preceding neighbor should accept keyboard focus before the Tab step`,
  ).toBeFocused();

  await page.keyboard.press('Tab');

  const landed = await target.evaluate((element) => element === document.activeElement);
  if (!landed) {
    throw new Error(
      `Tab from the preceding neighbor did not land on ${label}. Active element: ${JSON.stringify(
        await activeElementSummary(frame),
      )}`,
    );
  }
}

async function focusPaint(locator: Locator): Promise<FocusPaint> {
  return locator.evaluate((element) => {
    const styles = getComputedStyle(element as HTMLElement);
    const ringColorToken = styles.getPropertyValue('--cinder-ring-color').trim();
    const probe = document.createElement('span');
    probe.style.color = ringColorToken;
    document.body.append(probe);
    const ringColor = getComputedStyle(probe).color;
    probe.remove();

    return {
      boxShadow: styles.boxShadow,
      matchesFocusVisible: element.matches(':focus-visible'),
      outlineColor: styles.outlineColor,
      outlineOffset: Number.parseFloat(styles.outlineOffset),
      outlineStyle: styles.outlineStyle,
      outlineWidth: Number.parseFloat(styles.outlineWidth),
      ringColor,
      ringWidth: Number.parseFloat(styles.getPropertyValue('--cinder-ring-width')),
    };
  });
}

function isTransparentColor(color: string): boolean {
  const normalizedColor = color.toLowerCase().replaceAll(/\s+/g, '');
  return (
    normalizedColor === 'transparent' ||
    normalizedColor === 'rgba(0,0,0,0)' ||
    /\/\s*0(?:[)\s]|$)/.test(color)
  );
}

function splitBoxShadowLayers(boxShadow: string): string[] {
  return boxShadow.split(/,(?![^(]*\))/).map((layer) => layer.trim());
}

function insetSpreadForRing(boxShadow: string, ringColor: string): number | null {
  const layer = splitBoxShadowLayers(boxShadow).find(
    (candidate) => candidate.includes('inset') && candidate.includes(ringColor),
  );
  if (layer === undefined) return null;
  const lengths = [...layer.matchAll(/-?\d*\.?\d+px/g)].map(([value]) => Number.parseFloat(value));
  return lengths[3] ?? null;
}

function expectInsetFocusPaint(paint: FocusPaint, label: string): void {
  expect(paint.matchesFocusVisible, `${label} should match :focus-visible`).toBe(true);
  expect(paint.outlineStyle, `${label} should keep the outline channel`).toBe('solid');
  expect(isTransparentColor(paint.outlineColor), `${label} outline should be transparent`).toBe(
    true,
  );
  expect(paint.boxShadow, `${label} should paint a focus shadow`).not.toBe('none');
  expect(paint.boxShadow, `${label} should use an inset focus shadow`).toContain('inset');
  expect(paint.boxShadow, `${label} should include the resolved ring color`).toContain(
    paint.ringColor,
  );

  const spread = insetSpreadForRing(paint.boxShadow, paint.ringColor);
  expect(spread, `${label} should expose an inset spread for the ring layer`).not.toBeNull();
  expect(
    Math.abs(spread! - paint.ringWidth),
    `${label} spread should match ring width`,
  ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
}

async function openButtonDocumentationPage(page: Page): Promise<Frame> {
  await page.goto('/c/button', { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');

  const previewFrameElement = page.locator('iframe[data-cinder-preview]');
  await expect(previewFrameElement).toBeVisible();
  const previewFrameHandle = await previewFrameElement.elementHandle();
  const previewFrame = await previewFrameHandle?.contentFrame();
  if (previewFrame === null || previewFrame === undefined) {
    throw new Error('/c/button did not expose the component documentation preview frame.');
  }

  // The single-scroll page renders every section at once; the hero heading is a
  // stable readiness signal that the documentation payload has hydrated.
  await expect(previewFrame.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
  return previewFrame;
}

/**
 * The first example's `Show code` accordion trigger, plus the focusable element
 * that immediately precedes it in the tab order (the example's "Internal link"
 * anchor), so the keyboard ring can be engaged with a single anchored Tab.
 */
async function locateFirstExampleShowCodeTrigger(
  frame: Frame,
): Promise<{ precedingNeighbor: Locator; target: Locator }> {
  const firstExample = frame.locator('.dx-example').first();
  await expect(firstExample).toBeVisible();
  const showCodeTrigger = firstExample.getByRole('button', {
    exact: true,
    name: 'Show code',
  });
  await expect(showCodeTrigger).toHaveCount(1);

  // The example body renders its component before the disclosure trigger; its
  // last focusable element (the demo's link button) sits immediately before the
  // trigger in the tab order, so a single Tab from it lands on `Show code`.
  const precedingNeighbor = firstExample.locator('a.cinder-button').last();
  await expect(precedingNeighbor).toBeVisible();
  await showCodeTrigger.scrollIntoViewIfNeeded();

  return { precedingNeighbor, target: showCodeTrigger };
}

/**
 * The Props table scroll region, plus the focusable element that immediately
 * precedes it in the tab order (the last example's `Show code` trigger), so the
 * keyboard ring can be engaged with a single anchored Tab.
 */
async function locatePropsTableScrollRegion(
  frame: Frame,
): Promise<{ precedingNeighbor: Locator; target: Locator }> {
  const propsTableScroll = frame.locator('.props-table-scroll').first();
  const propsTableCount = await frame.locator('.props-table-scroll').count();
  expect(
    propsTableCount,
    '/c/button Props section no longer exposes `.props-table-scroll`; update the stable page-chrome fixture.',
  ).toBe(1);

  // The last example's `Show code` disclosure trigger is the final focusable
  // element before the Props scroll region, so one Tab from it lands on the
  // region.
  const precedingNeighbor = frame
    .locator('.dx-example .cinder-accordion-item__trigger', { hasText: 'Show code' })
    .last();
  await expect(precedingNeighbor).toBeVisible();
  await propsTableScroll.scrollIntoViewIfNeeded();

  return { precedingNeighbor, target: propsTableScroll };
}

test.describe('playground page chrome focus rings', () => {
  test('source accordion and props-table chrome use intentional inset keyboard rings', async ({
    page,
  }) => {
    const frame = await openButtonDocumentationPage(page);
    const showCode = await locateFirstExampleShowCodeTrigger(frame);

    await tabOntoFromNeighbor(
      page,
      frame,
      showCode.precedingNeighbor,
      showCode.target,
      'first Show code trigger',
    );
    await expect(showCode.target).toBeFocused();
    expectInsetFocusPaint(await focusPaint(showCode.target), 'Show code trigger');

    const propsTable = await locatePropsTableScrollRegion(frame);
    await tabOntoFromNeighbor(
      page,
      frame,
      propsTable.precedingNeighbor,
      propsTable.target,
      'props table scroll region',
    );
    await expect(propsTable.target).toBeFocused();
    expectInsetFocusPaint(await focusPaint(propsTable.target), 'props table scroll region');
  });

  test('forced-colors mode repaints the props-table focus outline inside the scroll container', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.waitForFunction(() => matchMedia('(forced-colors: active)').matches);
    const frame = await openButtonDocumentationPage(page);
    const propsTable = await locatePropsTableScrollRegion(frame);

    await tabOntoFromNeighbor(
      page,
      frame,
      propsTable.precedingNeighbor,
      propsTable.target,
      'props table scroll region',
    );
    await expect(propsTable.target).toBeFocused();

    const paint = await focusPaint(propsTable.target);
    expect(paint.matchesFocusVisible, 'props table should match :focus-visible').toBe(true);
    expect(paint.outlineStyle, 'forced-colors outline should be solid').toBe('solid');
    expect(
      isTransparentColor(paint.outlineColor),
      'forced-colors outline should repaint with a system color',
    ).toBe(false);
    expect(
      Math.abs(paint.outlineWidth - paint.ringWidth),
      'forced-colors outline width should match ring width',
    ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
    expect(paint.outlineOffset, 'forced-colors outline should be drawn inside').toBeLessThan(0);
  });
});
