/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { requiredInstance, requiredValue, setupHappyDom } from '@lostgradient/testing';
import { findById, hasButtonLabelled, type DiffToolbarState } from './diff-viewer-test-helpers.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: DiffToolbar } = await import('./diff-toolbar.svelte');

describe('DiffToolbar: [ / ] shortcut hints (CIN-334)', () => {
  test('the Previous/Next buttons carry the shortcut in their own accessible name and tooltip', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 1, removed: 0, modified: 0 },
      changeCount: 2,
      currentChangeIndex: 0,
      hasChanges: true,
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const previous = buttons.find((button) =>
      button.getAttribute('aria-label')?.startsWith('Previous change'),
    );
    const next = buttons.find((button) =>
      button.getAttribute('aria-label')?.startsWith('Next change'),
    );

    expect(previous?.getAttribute('aria-label')).toBe('Previous change ([)');
    expect(next?.getAttribute('aria-label')).toBe('Next change (])');
    expect(container.textContent).toContain('Previous change ([)');
    expect(container.textContent).toContain('Next change (])');
  });

  test('the [ / ] shortcuts are not rendered as standalone keycaps', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 1, removed: 0, modified: 0 },
      changeCount: 2,
      currentChangeIndex: 0,
      hasChanges: true,
    });

    // No leftover standalone "shortcuts" group with its own description.
    expect(container.querySelector('.shortcuts')).toBeNull();

    expect(container.querySelectorAll('kbd')).toHaveLength(0);
    expect(container.querySelectorAll('.nav-kbd')).toHaveLength(0);
  });

  test('copy is an icon-only button with tooltip help', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 1, removed: 0, modified: 0 },
      changeCount: 2,
      currentChangeIndex: 0,
      hasChanges: true,
      oncopydiff: () => {},
    });

    const copy = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Copy unified diff',
    );
    expect(copy).toBeDefined();
    expect(copy?.getAttribute('data-cinder-icon-only')).toBe('');
    expect(copy?.textContent?.trim()).toBe('');
    expect(container.textContent).toContain('Copy unified diff');
    expect(container.textContent).not.toContain('Copy diff');
  });
});

describe('DiffViewer: toolbar in the manual tier (tier boundaries: diff-controller.svelte.test.ts)', () => {
  const manualState: DiffToolbarState = {
    tier: 'manual',
    isStale: true,
    isComputing: false,
    warning: 'Large document (120 KB). Diff updates require manual trigger.',
    lastComputeTime: null,
  };

  const realtimeState: DiffToolbarState = {
    tier: 'realtime',
    isStale: false,
    isComputing: false,
    warning: null,
    lastComputeTime: 1.2,
  };

  test('the manual tier exposes a "Compute Diff" trigger and an "Outdated" badge', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
      diffState: manualState,
      ontriggercompute: () => {},
    });

    expect(hasButtonLabelled(container, 'Compute Diff')).toBe(true);
    expect(container.textContent).toContain('Outdated');
  });

  test('the realtime tier hides the manual trigger and the "Outdated" badge', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
      diffState: realtimeState,
      ontriggercompute: () => {},
    });

    expect(hasButtonLabelled(container, 'Compute Diff')).toBe(false);
    expect(container.textContent).not.toContain('Outdated');
  });

  test('clicking "Compute Diff" invokes the manual trigger callback', async () => {
    let triggered = 0;
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
      diffState: manualState,
      ontriggercompute: () => {
        triggered += 1;
      },
    });

    const computeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Compute Diff'),
    );
    expect(computeButton).toBeDefined();

    await fireEvent.click(requiredInstance(computeButton, HTMLButtonElement));
    expect(triggered).toBe(1);
  });

  test('the manual trigger is disabled while a computation is in progress', () => {
    const { container } = render(DiffToolbar, {
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
      diffState: { ...manualState, isComputing: true },
      ontriggercompute: () => {},
    });

    const computeButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Compute Diff'),
    );
    expect(computeButton?.disabled).toBe(true);
  });
});

describe('DiffViewer: toolbar id uniqueness (cinder#1309)', () => {
  test('two DiffToolbar instances mounted without an explicit id get distinct view-mode ids', () => {
    // Reverting the diff-toolbar.svelte fix (restoring the literal
    // id="diff-view-mode") makes both instances produce the SAME id here,
    // which fails the inequality assertions below.
    const { container: containerA } = render(DiffToolbar, {
      stats: { added: 1, removed: 0, modified: 0 },
      changeCount: 1,
      currentChangeIndex: 0,
      hasChanges: true,
    });
    const { container: containerB } = render(DiffToolbar, {
      stats: { added: 0, removed: 1, modified: 0 },
      changeCount: 1,
      currentChangeIndex: 0,
      hasChanges: true,
    });

    const radiogroupA = containerA.querySelector('[role="radiogroup"]');
    const radiogroupB = containerB.querySelector('[role="radiogroup"]');
    expect(radiogroupA).not.toBeNull();
    expect(radiogroupB).not.toBeNull();
    expect(radiogroupA?.id).toBeTruthy();
    expect(radiogroupB?.id).toBeTruthy();

    // The actual bug: both were the literal "diff-view-mode" regardless of
    // how many instances were on the page.
    expect(radiogroupA?.id).not.toBe(radiogroupB?.id);

    const labelledByA = radiogroupA?.getAttribute('aria-labelledby');
    const labelledByB = radiogroupB?.getAttribute('aria-labelledby');
    expect(labelledByA).toBeTruthy();
    expect(labelledByB).toBeTruthy();
    expect(labelledByA).not.toBe(labelledByB);

    // Each aria-labelledby resolves to a label INSIDE THAT INSTANCE's own
    // container...
    expect(findById(containerA, requiredValue(labelledByA))).not.toBeNull();
    expect(findById(containerB, requiredValue(labelledByB))).not.toBeNull();

    // ...and, the actual consequence of the collision: A's label id must not
    // resolve inside B's container (a real getElementById lookup from B's
    // radiogroup would otherwise silently find A's label, which is exactly
    // what happened before the fix).
    expect(findById(containerB, requiredValue(labelledByA))).toBeNull();
    expect(findById(containerA, requiredValue(labelledByB))).toBeNull();
  });

  test('an explicit id prop is honoured and its paired label id follows it', () => {
    const { container } = render(DiffToolbar, {
      id: 'my-toolbar-view-mode',
      stats: { added: 0, removed: 0, modified: 0 },
      changeCount: 0,
      currentChangeIndex: -1,
      hasChanges: false,
    });

    const radiogroup = container.querySelector('[role="radiogroup"]');
    expect(radiogroup?.id).toBe('my-toolbar-view-mode');
    expect(radiogroup?.getAttribute('aria-labelledby')).toBe('my-toolbar-view-mode-label');
    expect(findById(container, 'my-toolbar-view-mode-label')).not.toBeNull();
  });

  test('diff-viewer.svelte passes a $props.id()-derived id to DiffToolbar, not the colliding literal', async () => {
    // The behavioural tests above prove DiffToolbar namespaces its view-mode
    // id from whatever `id` it receives — but the actual bug lived in
    // diff-viewer.svelte, which never passed an id at all (so DiffToolbar's
    // own internal `$props.id()` fallback was never reached from a stable,
    // predictable per-instance value at the call site — instead the literal
    // default markup hardcoded "diff-view-mode" directly). The composed shell
    // cannot be mounted under happy-dom (see the file header), so the
    // shell-level wiring is guarded at the source level. Reverting the
    // diff-viewer.svelte change (removing the `id={...}` prop passed to
    // <DiffToolbar>) fails this test.
    const source = await Bun.file(new URL('./diff-viewer.svelte', import.meta.url)).text();

    expect(source).not.toMatch(/id=["']diff-view-mode["']/);
    expect(source).toMatch(/<DiffToolbar[\s\S]*?id=\{`\$\{instanceId\}-view-mode`\}/);
  });
});

describe('DiffViewer: keyboard shortcut ownership (cinder#1310)', () => {
  test("handleKeydown is bound on the component's own root, not on <svelte:window>", async () => {
    // The composed shell cannot be mounted under happy-dom (see the file
    // header), so — like the two shell-wiring tests above — this guards the
    // fix at the source level. Before the fix, `<svelte:window
    // onkeydown={handleKeydown} />` meant every DiffViewer instance on a page
    // reacted to every keystroke, regardless of focus. The fix removes the
    // window-level listener and instead binds `onkeydown` on this instance's
    // own <Surface> root: because keydown only reaches an element listener
    // when the event's target is that element or one of its descendants, and
    // focus is exclusive to a single element in the whole document, at most
    // one DiffViewer instance can ever have the focused element inside its
    // own subtree — so at most one instance's handler can ever fire for a
    // given keystroke. Reverting the fix (restoring
    // `<svelte:window onkeydown={handleKeydown} />` and removing `onkeydown`
    // from the <Surface> tag) fails this test.
    const source = await Bun.file(new URL('./diff-viewer.svelte', import.meta.url)).text();

    // Tight enough to match only the actual markup (not this file's own
    // prose, which mentions the old `<svelte:window onkeydown>` tag without
    // the `={handleKeydown}` binding it had when it was live markup).
    expect(source).not.toMatch(/<svelte:window\s+onkeydown=\{handleKeydown\}/);
    expect(source).toMatch(/<Surface\b[\s\S]*?onkeydown=\{handleKeydown\}/);
  });
});
