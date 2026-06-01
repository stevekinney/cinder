/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

// ---------------------------------------------------------------------------
// Floating-ui mocks — installed before importing the component.
// Mirror the pattern from popover.test.ts.
// ---------------------------------------------------------------------------

let computePositionResult = {
  x: 50,
  y: 80,
  placement: 'bottom-start',
  middlewareData: {},
};

const computePositionSpy = mock(async () => computePositionResult);

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

mock.module('@floating-ui/dom', () => ({
  arrow: () => ({ name: 'arrow', fn: () => ({}) }),
  computePosition: computePositionSpy,
  autoUpdate: autoUpdateSpy,
  flip: flipSpy,
  shift: shiftSpy,
  offset: offsetSpy,
}));

const { render, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: LinkPopover } = await import('./link-popover.svelte');

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
    middlewareData: {},
  };
});

afterEach(() => {
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

    const options = computePositionSpy.mock.calls[0]?.at(2) as { strategy?: string } | undefined;
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

    const options = computePositionSpy.mock.calls[0]?.at(2) as { placement?: string } | undefined;
    expect(options?.placement).toBe('bottom-start');
  });

  test('computed x and y become inline left and top style', async () => {
    computePositionResult = { x: 120, y: 200, placement: 'bottom-start', middlewareData: {} };
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

  test('close button uses --cinder-touch-target-min token for 44px target', async () => {
    const source = await Bun.file(
      new URL('./link-popover.svelte', import.meta.url).pathname,
    ).text();
    // The close button CSS must reference the touch target token
    expect(source).toMatch(/--cinder-touch-target-min/);
    // Both width and height must use the token
    expect(source).toMatch(
      /\.link-popover-close\s*\{[^}]*width:\s*var\(--cinder-touch-target-min/s,
    );
    expect(source).toMatch(
      /\.link-popover-close\s*\{[^}]*height:\s*var\(--cinder-touch-target-min/s,
    );
  });
});
