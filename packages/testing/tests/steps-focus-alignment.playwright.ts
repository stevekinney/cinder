/// <reference lib="dom" />
/**
 * Regression test for ticket e4c7c327 — "Steps: focused step body alignment with
 * marker and connector."
 *
 * In the WIDE horizontal layout the interactive body (the `<a>`/`<button>` that
 * carries `.cinder-steps__interactive.cinder-steps__body`) used to stretch to the
 * full equal-width step column (`inline-size: 100%`). Its Strategy-B
 * `:focus-visible` ring therefore boxed the entire ~570px column around only the
 * centered label/description — a wide pill — while:
 *   - the marker (a 24px circle, an in-flow sibling ABOVE the body) protruded
 *     ~24px above the ring's top edge, floating detached, and
 *   - the connector (absolutely pinned to the marker center, ~12px above the
 *     body top) cut horizontally across the empty band between the floating
 *     marker and the ring.
 * Net: three disconnected pieces instead of one step item.
 *
 * The fix is geometry-only (Strategy B is retained verbatim): in the wide layout
 * the focusable box hugs its centered content (`inline-size: auto;
 * align-self: center`) and its top edge is raised up to the marker's top via a
 * negative `margin-block-start` equal to the marker diameter, with an equal-plus-
 * existing `padding-block-start` so the visible label/description do not move.
 * The ring then frames marker + label + description as ONE centered unit, and the
 * connector sits inside the ring's vertical span.
 *
 * This spec drives the component with REAL KEYBOARD NAVIGATION (a programmatic
 * `.focus()` does NOT engage `:focus-visible` in Chromium) and then measures the
 * rendered geometry to prove the fix:
 *
 *   1. Tab-walk from `document.body` until the first interactive step is
 *      `activeElement`; assert `element.matches(':focus-visible') === true`.
 *   2. The marker's vertical box is enclosed by the focus box (marker no longer
 *      protrudes above it). PRE-FIX FAILS: marker.top ~24px above anchor.top.
 *   3. The focus box is centered under the marker AND content-width, not a
 *      full-column strip. PRE-FIX FAILS: anchor.width ≈ li.width.
 *   4. The connector is within the focus box's vertical span. PRE-FIX FAILS:
 *      connector.top ~12px above anchor.top.
 *   5. Zero net shift: the label stays exactly `space-2` below the marker bottom
 *      (and centered under it), proving the negative-margin / added-padding pair
 *      nets to zero against the marker — the reference the fix never moves. This
 *      passes both pre- and post-fix (it guards FUTURE regressions of the fix:
 *      a mismatched margin/padding pair would move the label off the marker).
 *   6. Narrow (<32rem container) layout: the ring is unclipped by any ancestor
 *      and the label/description stay left-aligned beside the marker.
 *
 * The load-bearing PRE-FIX-FAILING assertion is (1)–(4) in the WIDE test; the
 * companion fast unit suite (`steps.test.ts`) pins the CSS contract directly.
 */

import { expect, test, type Page } from '@playwright/test';

const STEPS_ROUTE = '/page/steps?snapshot=1';

// Box metrics come back as fractional pixels; allow a sub-pixel slack so a box
// edge sitting exactly on the marker/connector edge isn't flagged as off.
const PIXEL_TOLERANCE = 0.5;

// The interactive example renders inside `.example-preview`. The first
// interactive step (id "account", carrying an href) is an <a>; the second
// (onclick) is a <button>. The first interactive body in DOM order is the <a>.
const STEPS_NAV = '.example-preview .cinder-steps[data-cinder-orientation="horizontal"]';
const FIRST_INTERACTIVE =
  '.example-preview .cinder-steps li.cinder-steps__item a.cinder-steps__interactive';

type StepGeometry = {
  matchesFocusVisible: boolean;
  anchor: { top: number; bottom: number; left: number; right: number; width: number };
  marker: { top: number; bottom: number; left: number; right: number; centerX: number };
  // The connector that belongs to the SAME li as the focused anchor (absent for
  // the last step — the focused step is the first, which always has one).
  connector: { top: number; bottom: number; left: number; right: number } | null;
  nav: { width: number };
  markerSizePx: number;
  // Largest OUTWARD extent of the computed box-shadow ring (offset + width). For
  // the outset Strategy-B ring this is ~4px; used by the narrow unclipped proof.
  ringOutsetPx: number;
};

/** Reset focus to the body so a subsequent Tab walk is deterministic. */
async function resetFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
  });
}

/**
 * Walk Tab (capped) until the first interactive step is the active element, then
 * read the geometry of the focused anchor, its sibling marker, and connector.
 */
async function tabToFirstInteractiveStep(page: Page): Promise<StepGeometry> {
  await resetFocus(page);

  const isLanded = () =>
    page.evaluate((selector) => {
      const anchor = document.querySelector(selector);
      return anchor instanceof HTMLElement && anchor === document.activeElement;
    }, FIRST_INTERACTIVE);

  let landed = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await page.keyboard.press('Tab');
    if (await isLanded()) {
      landed = true;
      break;
    }
  }
  expect(landed, 'Tab walk never reached the first interactive step').toBe(true);

  return page.evaluate((selector) => {
    const anchor = document.querySelector(selector);
    if (!(anchor instanceof HTMLElement)) throw new Error(`No anchor ${selector}`);
    const li = anchor.closest('li.cinder-steps__item');
    if (!(li instanceof HTMLElement)) throw new Error('No owning li');
    const marker = li.querySelector('.cinder-steps__marker');
    if (!(marker instanceof HTMLElement)) throw new Error('No marker in li');
    const nav = anchor.closest('nav.cinder-steps');
    if (!(nav instanceof HTMLElement)) throw new Error('No nav.cinder-steps');
    const connectorEl = li.querySelector('.cinder-steps__connector');

    const anchorRect = anchor.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const connectorRect =
      connectorEl instanceof HTMLElement ? connectorEl.getBoundingClientRect() : null;

    const styles = getComputedStyle(anchor);
    const markerSizeRaw = getComputedStyle(nav).getPropertyValue('--_marker-size').trim();
    // --_marker-size is authored in rem; resolve to px via the root font size.
    const rootFontSize =
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const markerSizePx = markerSizeRaw.endsWith('rem')
      ? Number.parseFloat(markerSizeRaw) * rootFontSize
      : Number.parseFloat(markerSizeRaw);

    // Measure the outward extent of the box-shadow ring. Each comma-separated
    // layer is `<color> <offsetX> <offsetY> <blur> <spread>` with an optional
    // `inset` keyword. The split keeps rgb()/oklch() commas intact via the
    // unclosed-paren lookahead.
    const boxShadow = styles.boxShadow;
    let ringOutsetPx = 0;
    if (boxShadow && boxShadow !== 'none') {
      for (const layer of boxShadow.split(/,(?![^(]*\))/)) {
        if (/\binset\b/.test(layer)) continue;
        const lengths = [...layer.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) =>
          Number.parseFloat(match[1]!),
        );
        if (lengths.length < 2) continue;
        const offsetX = lengths[0] ?? 0;
        const offsetY = lengths[1] ?? 0;
        const spread = lengths[3] ?? 0;
        const outset = spread + Math.max(Math.abs(offsetX), Math.abs(offsetY));
        if (outset > ringOutsetPx) ringOutsetPx = outset;
      }
    }

    return {
      matchesFocusVisible: anchor.matches(':focus-visible'),
      anchor: {
        top: anchorRect.top,
        bottom: anchorRect.bottom,
        left: anchorRect.left,
        right: anchorRect.right,
        width: anchorRect.width,
      },
      marker: {
        top: markerRect.top,
        bottom: markerRect.bottom,
        left: markerRect.left,
        right: markerRect.right,
        centerX: markerRect.left + markerRect.width / 2,
      },
      connector: connectorRect
        ? {
            top: connectorRect.top,
            bottom: connectorRect.bottom,
            left: connectorRect.left,
            right: connectorRect.right,
          }
        : null,
      nav: { width: navRect.width },
      markerSizePx,
      ringOutsetPx,
    };
  }, FIRST_INTERACTIVE);
}

test.describe('Steps — focused step body aligns with marker and connector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STEPS_ROUTE, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(FIRST_INTERACTIVE, { state: 'visible' });
    // Layout must be settled (non-zero box) before metric reads.
    await page.waitForFunction((selector) => {
      const anchor = document.querySelector(selector);
      return anchor instanceof HTMLElement && anchor.getBoundingClientRect().height > 0;
    }, FIRST_INTERACTIVE);
  });

  test('WIDE: focus box encloses the marker, hugs centered content, and the connector sits inside it', async ({
    page,
  }) => {
    // Ensure the wide horizontal layout is active (container well over 32rem).
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForFunction((selector) => {
      const nav = document.querySelector(selector);
      return nav instanceof HTMLElement && nav.getBoundingClientRect().width > 640;
    }, STEPS_NAV);

    const geometry = await tabToFirstInteractiveStep(page);

    // Real keyboard focus engaged :focus-visible (the pseudo the ring keys off).
    expect(geometry.matchesFocusVisible).toBe(true);

    // (1) The marker no longer protrudes ABOVE the focus box: its top is at or
    //     below the anchor's top edge, so the ring encloses the marker.
    //     PRE-FIX: marker.top is ~one marker diameter above anchor.top.
    expect(
      geometry.marker.top,
      'marker top must be enclosed by (not above) the focus box',
    ).toBeGreaterThanOrEqual(geometry.anchor.top - PIXEL_TOLERANCE);

    // (2) The focus box is centered under the marker…
    const anchorCenterX = geometry.anchor.left + geometry.anchor.width / 2;
    expect(
      Math.abs(anchorCenterX - geometry.marker.centerX),
      'focus box must be horizontally centered under the marker',
    ).toBeLessThanOrEqual(PIXEL_TOLERANCE + 1);

    // …AND it is content-width, not a full equal-width-column strip. The body
    // must be narrower than the column by at least twice the marker size.
    // PRE-FIX: anchor.width ≈ li/column width (the full ~570px strip).
    const columnWidth = geometry.nav.width / 3; // three equal steps in the example
    expect(
      geometry.anchor.width,
      'focus box must hug its content, not span the whole step column',
    ).toBeLessThan(columnWidth - 2 * geometry.markerSizePx);

    // (3) The connector belonging to this step is within the focus box's
    //     vertical span (its top is at/below the focus box top). PRE-FIX: the
    //     connector top is ~half a marker diameter above the anchor top.
    expect(geometry.connector, 'first step must have a connector to the next step').not.toBeNull();
    expect(
      geometry.connector!.top,
      'connector must sit inside the focus box vertical span, not cut an empty band above it',
    ).toBeGreaterThanOrEqual(geometry.anchor.top - PIXEL_TOLERANCE);
  });

  test('WIDE: marker-capture geometry keeps the label exactly space-2 below the marker (zero net shift)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForFunction((selector) => {
      const nav = document.querySelector(selector);
      return nav instanceof HTMLElement && nav.getBoundingClientRect().width > 640;
    }, STEPS_NAV);

    // The marker is the fixed reference the fix never moves. The negative
    // block-start margin (raises the box top up to the marker top) and the added
    // block-start padding (marker diameter + the body's existing space-2) must
    // net to zero, leaving the label exactly `space-2` below the marker bottom —
    // identical to the static-body spacing. A mismatched margin/padding pair (the
    // most likely regression in this fix) moves the label relative to the marker
    // and trips this. Measured against the marker, not against focus state, so it
    // catches a real content-position regression rather than a no-op.
    await resetFocus(page);
    const spacing = await page.evaluate((selector) => {
      const anchor = document.querySelector(selector);
      if (!(anchor instanceof HTMLElement)) throw new Error(`No anchor ${selector}`);
      const li = anchor.closest('li.cinder-steps__item');
      if (!(li instanceof HTMLElement)) throw new Error('No owning li');
      const marker = li.querySelector('.cinder-steps__marker');
      if (!(marker instanceof HTMLElement)) throw new Error('No marker');
      const label = anchor.querySelector('.cinder-steps__label');
      if (!(label instanceof HTMLElement)) throw new Error('No label');
      const nav = anchor.closest('nav.cinder-steps');
      if (!(nav instanceof HTMLElement)) throw new Error('No nav');

      const rootFontSize =
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const space2Raw = getComputedStyle(nav).getPropertyValue('--cinder-space-2').trim();
      const space2Px = space2Raw.endsWith('rem')
        ? Number.parseFloat(space2Raw) * rootFontSize
        : Number.parseFloat(space2Raw);

      const markerRect = marker.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      return {
        gapMarkerBottomToLabelTop: labelRect.top - markerRect.bottom,
        space2Px,
        // Marker and label must share the same horizontal center (centered unit).
        markerCenterX: markerRect.left + markerRect.width / 2,
        labelCenterX: labelRect.left + labelRect.width / 2,
      };
    }, FIRST_INTERACTIVE);

    // Label top sits the body's space-2 gap below the marker — the static-body
    // spacing the marker-capture margin/padding pair must preserve exactly.
    expect(
      spacing.gapMarkerBottomToLabelTop,
      'label must remain space-2 below the marker (margin/padding net to zero)',
    ).toBeCloseTo(spacing.space2Px, 0);

    // The captured unit is still centered: label center under marker center.
    expect(
      Math.abs(spacing.labelCenterX - spacing.markerCenterX),
      'label must stay centered under the marker',
    ).toBeLessThanOrEqual(PIXEL_TOLERANCE + 1);
  });

  test('NARROW: focused step ring is unclipped and the body stays left-aligned beside the marker', async ({
    page,
  }) => {
    // Drop the viewport so the `.cinder-steps` container query resolves below
    // 32rem (512px) and the stacked grid layout takes over.
    await page.setViewportSize({ width: 420, height: 900 });
    await page.waitForFunction((selector) => {
      const nav = document.querySelector(selector);
      return nav instanceof HTMLElement && nav.getBoundingClientRect().width < 512;
    }, STEPS_NAV);

    const geometry = await tabToFirstInteractiveStep(page);
    expect(geometry.matchesFocusVisible).toBe(true);

    // The body is left-aligned beside the marker (grid column 2): the body's
    // left edge is to the RIGHT of the marker's left edge (they are side by
    // side, not stacked).
    expect(
      geometry.anchor.left,
      'narrow body must sit to the right of the marker (grid column 2)',
    ).toBeGreaterThan(geometry.marker.left - PIXEL_TOLERANCE);

    // The painted focus ring (anchor box grown by the ring's outward extent)
    // must sit inside the NEAREST scroll/overflow-clip ancestor on all four
    // sides. If no ancestor clips (every ancestor is overflow:visible up to the
    // viewport), the ring is unclipped by definition — assert that fact too.
    const clip = await page.evaluate((selector) => {
      const anchor = document.querySelector(selector);
      if (!(anchor instanceof HTMLElement)) throw new Error('No anchor');
      // Walk ancestors to the nearest one whose computed overflow clips on any
      // axis (anything other than `visible`).
      let node: HTMLElement | null = anchor.parentElement;
      while (node) {
        const styles = getComputedStyle(node);
        const clips = [styles.overflowX, styles.overflowY, styles.overflow].some(
          (value) => value !== '' && value !== 'visible',
        );
        if (clips) {
          const rect = node.getBoundingClientRect();
          return {
            clipped: true,
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
          };
        }
        node = node.parentElement;
      }
      return { clipped: false, top: 0, bottom: 0, left: 0, right: 0 };
    }, FIRST_INTERACTIVE);

    if (clip.clipped) {
      const outset = geometry.ringOutsetPx;
      expect(
        geometry.anchor.top - outset,
        'narrow ring top must be inside the clipping ancestor',
      ).toBeGreaterThanOrEqual(clip.top - PIXEL_TOLERANCE);
      expect(
        geometry.anchor.bottom + outset,
        'narrow ring bottom must be inside the clipping ancestor',
      ).toBeLessThanOrEqual(clip.bottom + PIXEL_TOLERANCE);
      expect(
        geometry.anchor.left - outset,
        'narrow ring left must be inside the clipping ancestor',
      ).toBeGreaterThanOrEqual(clip.left - PIXEL_TOLERANCE);
      expect(
        geometry.anchor.right + outset,
        'narrow ring right must be inside the clipping ancestor',
      ).toBeLessThanOrEqual(clip.right + PIXEL_TOLERANCE);
    } else {
      // No clipping ancestor exists, so the outset Strategy-B ring cannot be
      // clipped. Confirm the ring is actually painted (a real outset ring, not
      // a missing/zero one) so this branch can't pass on a vanished ring.
      expect(geometry.ringOutsetPx, 'a real outset focus ring must be painted').toBeGreaterThan(0);
    }
  });
});
