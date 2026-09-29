/// <reference lib="dom" />
import * as floatingUi from '@floating-ui/dom';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import LinkPopover from './link-popover.svelte';

setupHappyDom();

// ---------------------------------------------------------------------------
// Floating-ui spies — scoped per-test via `spyOn`, not a process-global
// module replacement, so they can't leak into other test files sharing this
// process (`bun run test` runs the whole package in one process). Mirrors
// the pattern `attach.test.ts` uses for `./editor.js`.
// ---------------------------------------------------------------------------

let computePositionResult = {
  x: 50,
  y: 80,
  placement: 'bottom-start' as const,
  strategy: 'absolute' as const,
  middlewareData: {},
};

const computePositionSpy = mock(
  async (..._args: Parameters<typeof floatingUi.computePosition>) => computePositionResult,
);

const autoUpdateTeardown = mock(() => {});
const autoUpdateSpy = mock((_anchor: unknown, _panel: unknown, update: () => void) => {
  update();
  return autoUpdateTeardown;
});
const flipSpy = mock(() => ({ name: 'flip', fn: () => ({}) }));
const shiftSpy = mock((opts: unknown) => ({ name: 'shift', options: opts, fn: () => ({}) }));
const offsetSpy = mock((value: unknown) => ({
  name: 'offset',
  options: value,
  fn: () => ({}),
}));
const arrowSpy = mock(() => ({ name: 'arrow', fn: () => ({}) }));

function queryLinkPopover(): HTMLDivElement | null {
  return document.body.querySelector<HTMLDivElement>('.link-popover');
}

let scratchNodes: HTMLElement[] = [];
function attachScratch(node: HTMLElement): void {
  scratchNodes.push(node);
  document.body.appendChild(node);
}

beforeEach(() => {
  computePositionResult = {
    x: 50,
    y: 80,
    placement: 'bottom-start',
    strategy: 'absolute',
    middlewareData: {},
  };
  spyOn(floatingUi, 'computePosition').mockImplementation(computePositionSpy);
  spyOn(floatingUi, 'autoUpdate').mockImplementation(autoUpdateSpy);
  spyOn(floatingUi, 'flip').mockImplementation(flipSpy);
  spyOn(floatingUi, 'shift').mockImplementation(shiftSpy);
  spyOn(floatingUi, 'offset').mockImplementation(offsetSpy);
  spyOn(floatingUi, 'arrow').mockImplementation(arrowSpy);
});

afterEach(() => {
  mock.restore();
  cleanup();
  for (const node of scratchNodes) {
    if (node.isConnected) node.remove();
  }
  scratchNodes = [];
  computePositionSpy.mockClear();
  autoUpdateSpy.mockClear();
  autoUpdateTeardown.mockClear();
  flipSpy.mockClear();
  shiftSpy.mockClear();
  offsetSpy.mockClear();
  arrowSpy.mockClear();
});

// ---------------------------------------------------------------------------
// Rendering without anchor (legacy fallback)
// ---------------------------------------------------------------------------

describe('LinkPopover — rendering without anchor', () => {
  test('renders the popover dialog', () => {
    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert' },
    });
    const panel = queryLinkPopover();
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('dialog');
  });

  test('does not call computePosition when anchorElement is null', async () => {
    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: null },
    });
    await tick();
    expect(computePositionSpy).not.toHaveBeenCalled();
    expect(autoUpdateSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Floating UI positioning with anchorElement
// ---------------------------------------------------------------------------

describe('LinkPopover — Floating UI positioning', () => {
  test('calls autoUpdate when anchorElement is provided', async () => {
    const anchor = document.createElement('button');
    anchor.textContent = 'Link';
    attachScratch(anchor);

    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor },
    });

    await waitFor(() => {
      expect(autoUpdateSpy).toHaveBeenCalled();
    });

    const call = autoUpdateSpy.mock.calls[0]!;
    expect(call[0]).toBe(anchor);
  });

  test('computePosition is called with strategy: fixed', async () => {
    const anchor = document.createElement('button');
    anchor.textContent = 'Link';
    attachScratch(anchor);

    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor },
    });

    await waitFor(() => {
      expect(computePositionSpy).toHaveBeenCalled();
    });

    const options = computePositionSpy.mock.calls[0]?.[2];
    expect(options?.strategy).toBe('fixed');
  });

  test('computePosition uses placement bottom-start', async () => {
    const anchor = document.createElement('button');
    attachScratch(anchor);

    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor },
    });

    await waitFor(() => {
      expect(computePositionSpy).toHaveBeenCalled();
    });

    const options = computePositionSpy.mock.calls[0]?.[2];
    expect(options?.placement).toBe('bottom-start');
  });

  test('computed x and y become inline left and top style', async () => {
    computePositionResult = {
      x: 120,
      y: 200,
      placement: 'bottom-start',
      strategy: 'absolute',
      middlewareData: {},
    };
    const anchor = document.createElement('button');
    attachScratch(anchor);

    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor },
    });

    await waitFor(() => {
      const panel = queryLinkPopover();
      const style = panel?.getAttribute('style') ?? '';
      expect(style).toContain('left: 120px');
      expect(style).toContain('top: 200px');
    });
  });

  test('data-position-ready is false before compute resolves', async () => {
    // The popover element gets data-position-ready=false while awaiting
    // the first computePosition result. After compute resolves it becomes true.
    const anchor = document.createElement('button');
    attachScratch(anchor);

    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor },
    });

    await waitFor(() => {
      const panel = queryLinkPopover();
      // After autoUpdate mock calls update() synchronously and computePosition
      // resolves, data-position-ready should become true.
      expect(panel?.getAttribute('data-position-ready')).toBe('true');
    });
  });

  test('autoUpdate teardown runs when component unmounts', async () => {
    const anchor = document.createElement('button');
    attachScratch(anchor);

    const { unmount } = render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor },
    });

    await waitFor(() => {
      expect(autoUpdateSpy).toHaveBeenCalled();
    });

    autoUpdateTeardown.mockClear();
    unmount();
    expect(autoUpdateTeardown).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CSS contract: old hardcoded positioning must be gone
// ---------------------------------------------------------------------------

describe('LinkPopover — CSS contract', () => {
  test('autofocus is applied once per mounted popover', async () => {
    const source = await Bun.file(
      new URL('./link-popover.svelte', import.meta.url).pathname,
    ).text();

    expect(source).toContain('let initialFocusApplied = false');
    expect(source).toContain('if (initialFocusApplied) return');
    expect(source).toContain('initialFocusApplied = true');
  });

  test('link-popover.svelte main .link-popover rule no longer uses hardcoded top: 20% positioning', async () => {
    const source = await Bun.file(
      new URL('./link-popover.svelte', import.meta.url).pathname,
    ).text();
    // The primary .link-popover rule must not set top: 20% — it now uses Floating UI.
    // Extract the first .link-popover { ... } block (the primary rule, not the :not selector)
    const primaryRuleMatch = source.match(/\.link-popover\s*\{([^}]*)\}/);
    expect(primaryRuleMatch).not.toBeNull();
    const primaryRule = primaryRuleMatch![1];
    // Primary rule must not hardcode top: 20%
    expect(primaryRule).not.toMatch(/top:\s*20%/);
    // Primary rule must not hardcode left: 50%
    expect(primaryRule).not.toMatch(/left:\s*50%/);
  });

  test('link-popover.svelte primary positioning does not use translateX(-50%) in main rule', async () => {
    const source = await Bun.file(
      new URL('./link-popover.svelte', import.meta.url).pathname,
    ).text();
    // The primary .link-popover rule must not contain translateX
    const primaryRuleMatch = source.match(/\.link-popover\s*\{([^}]*)\}/);
    expect(primaryRuleMatch).not.toBeNull();
    const primaryRule = primaryRuleMatch![1];
    expect(primaryRule).not.toMatch(/translateX/);
  });

  test('close button is 28px on a fine pointer, with a 44px coarse-pointer override (COR-463)', async () => {
    const source = await Bun.file(
      new URL('./link-popover.svelte', import.meta.url).pathname,
    ).text();
    // Fine-pointer default: 28px, not the 44px touch target unconditionally.
    expect(source).toMatch(/\.link-popover-close\s*\{[^}]*width:\s*28px/s);
    expect(source).toMatch(/\.link-popover-close\s*\{[^}]*height:\s*28px/s);
    // The existing pointer-aware convention (number-input's stepper) bumps it
    // to the 44px WCAG 2.2 AA target under `@media (pointer: coarse)`.
    const coarseBlockMatch = source.match(
      /@media \(pointer: coarse\)\s*\{\s*\.link-popover-close\s*\{([^}]*)\}/,
    );
    expect(coarseBlockMatch).not.toBeNull();
    expect(coarseBlockMatch![1]).toMatch(/width:\s*var\(--cinder-touch-target-min\)/);
    expect(coarseBlockMatch![1]).toMatch(/height:\s*var\(--cinder-touch-target-min\)/);
  });
});

// ---------------------------------------------------------------------------
// COR-463 — semantic and density regressions
// ---------------------------------------------------------------------------

describe('LinkPopover — nonmodal semantics (COR-463)', () => {
  test('does not declare aria-modal', () => {
    render(LinkPopover, { props: { id: 'test-link-popover', mode: 'insert' } });
    const panel = queryLinkPopover();
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.hasAttribute('aria-modal')).toBe(false);
  });

  test('keeps its visible-title aria-labelledby', () => {
    render(LinkPopover, { props: { id: 'test-link-popover', mode: 'insert' } });
    const panel = queryLinkPopover();
    expect(panel?.getAttribute('aria-labelledby')).toBe('test-link-popover-title');
    expect(document.getElementById('test-link-popover-title')).not.toBeNull();
  });

  test('does not attach a focus trap: Tab from the last control is not intercepted or wrapped', async () => {
    const anchor = document.createElement('button');
    attachScratch(anchor);
    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor },
    });

    // Let the component's own initial-focus effect land on the URL input
    // first — it moves focus asynchronously (a `tick()` after positioning is
    // ready), and racing it with the manual `.focus()` below would let it
    // clobber the manual placement instead of the other way around.
    await waitFor(() => {
      expect(document.activeElement?.id).toBe('test-link-popover-url');
    });

    const panel = queryLinkPopover()!;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const last = focusable[focusable.length - 1]!;
    last.focus();
    expect(document.activeElement).toBe(last);

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    const notPrevented = last.dispatchEvent(tabEvent);

    // A focus trap would call preventDefault() and synchronously wrap focus
    // back to the first tabbable element. Neither should happen now.
    expect(notPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  test('does not attach a focus trap: Shift+Tab from the first control is not intercepted or wrapped', async () => {
    const anchor = document.createElement('button');
    attachScratch(anchor);
    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor },
    });

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('test-link-popover-url');
    });

    const panel = queryLinkPopover()!;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0]!;
    first.focus();

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const notPrevented = first.dispatchEvent(shiftTabEvent);

    expect(notPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  test('moves initial focus to the URL input once anchored positioning is ready', async () => {
    const anchor = document.createElement('button');
    attachScratch(anchor);
    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor },
    });

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('test-link-popover-url');
    });
  });

  test('moves initial focus to the URL input in standalone (no-anchor) rendering too', async () => {
    render(LinkPopover, { props: { id: 'test-link-popover', mode: 'insert' } });

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('test-link-popover-url');
    });
  });

  test('outside click calls onOutsideDismiss, not onclose', async () => {
    const anchor = document.createElement('button');
    attachScratch(anchor);
    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Some other toolbar control';
    attachScratch(outsideButton);

    const onclose = mock(() => {});
    const onOutsideDismiss = mock(() => {});
    render(LinkPopover, {
      props: {
        id: 'test-link-popover',
        mode: 'insert',
        anchorElement: anchor,
        onclose,
        onOutsideDismiss,
      },
    });

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('test-link-popover-url');
    });

    outsideButton.focus();
    outsideButton.click();

    expect(onOutsideDismiss).toHaveBeenCalledTimes(1);
    expect(onclose).not.toHaveBeenCalled();
    // The clicked control keeps focus — LinkPopover itself never moves it.
    expect(document.activeElement).toBe(outsideButton);
  });

  test('outside click falls back to onclose when onOutsideDismiss is not provided (standalone usage)', async () => {
    const anchor = document.createElement('button');
    attachScratch(anchor);
    const outsideButton = document.createElement('button');
    attachScratch(outsideButton);
    const onclose = mock(() => {});
    render(LinkPopover, {
      props: { id: 'test-link-popover', mode: 'insert', anchorElement: anchor, onclose },
    });

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('test-link-popover-url');
    });

    outsideButton.click();
    expect(onclose).toHaveBeenCalledTimes(1);
  });
});

describe('LinkPopover — density (COR-463)', () => {
  test('root composes the shared floating-surface treatment', async () => {
    render(LinkPopover, { props: { id: 'test-link-popover', mode: 'insert' } });
    const panel = queryLinkPopover();
    expect(panel?.classList.contains('cinder-_floating-surface')).toBe(true);
  });

  test('header and footer use at-most-40px-high padding (space-1-5 block / space-3 inline)', async () => {
    const source = await Bun.file(
      new URL('./link-popover.svelte', import.meta.url).pathname,
    ).text();
    const headerBlock = source.match(/\.link-popover-header\s*\{([^}]*)\}/)?.[1] ?? '';
    const footerBlock = source.match(/\.link-popover-footer\s*\{([^}]*)\}/)?.[1] ?? '';
    for (const block of [headerBlock, footerBlock]) {
      expect(block).toMatch(/padding:\s*var\(--cinder-space-1-5\)\s*var\(--cinder-space-3\)/);
      expect(block).toMatch(/box-sizing:\s*border-box/);
    }
  });

  test('content padding and gap are at most --cinder-space-3 (12px)', async () => {
    const source = await Bun.file(
      new URL('./link-popover.svelte', import.meta.url).pathname,
    ).text();
    const contentBlock = source.match(/\.link-popover-content\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(contentBlock).toMatch(/padding:\s*var\(--cinder-space-3\)/);
    expect(contentBlock).toMatch(/gap:\s*var\(--cinder-space-3\)/);
    expect(contentBlock).not.toMatch(/--cinder-space-4/);
  });

  test('title and action icons use the 16px icon utility class', () => {
    render(LinkPopover, { props: { id: 'test-link-popover', mode: 'edit' } });
    const panel = queryLinkPopover()!;
    const icons = panel.querySelectorAll('.cinder-icon-sm');
    // LinkIcon (title), Unlink (Remove, edit mode), X (Close) — all 16px.
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });
});
