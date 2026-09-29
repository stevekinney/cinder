/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

import type {
  SourceDiffAnnotationSelection,
  SourceDiffFileDescriptor,
  SourceDiffViewerRef,
} from './source-diff-viewer.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: SourceDiffViewer } = await import('./index.ts');

afterEach(() => cleanup());

const onePatch = `diff --git a/src/one.ts b/src/one.ts
--- a/src/one.ts
+++ b/src/one.ts
@@ -1,4 +1,4 @@
 context before
-removed line
+added line
 context after
`;

const twoFilePatch = `diff --git a/src/one.ts b/src/one.ts
--- a/src/one.ts
+++ b/src/one.ts
@@ -1,2 +1,2 @@
-old one
+new one
diff --git a/src/two.ts b/src/two.ts
--- a/src/two.ts
+++ b/src/two.ts
@@ -1,2 +1,2 @@
-old two
+new two
`;

function control(
  container: HTMLElement,
  side: 'old' | 'new',
  line: number,
  fileOccurrence = 0,
  hunkOccurrence = 0,
): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    `[data-cinder-annotation-control][data-cinder-file-occurrence="${fileOccurrence}"]` +
      `[data-cinder-hunk-occurrence="${hunkOccurrence}"][data-cinder-side="${side}"][data-cinder-line="${line}"]`,
  );
  if (!element) throw new Error(`No annotation control for ${side} line ${line}`);
  return element;
}

describe('SourceDiffViewer: default rendering has no annotation controls', () => {
  test('renders no annotation controls or status region without onAnnotationSelectionChange', () => {
    const { container } = render(SourceDiffViewer, { patch: onePatch });

    expect(container.querySelectorAll('[data-cinder-annotation-control]')).toHaveLength(0);
    expect(container.querySelector('.cinder-source-diff-viewer__annotation-status')).toBeNull();
  });
});

describe('SourceDiffViewer: pointer and keyboard annotation selection', () => {
  test('clicking a control commits a single-line selection on the correct side', async () => {
    let selection: SourceDiffAnnotationSelection | null | undefined;
    const { container } = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        selection = next;
      },
    });

    await fireEvent.click(control(container, 'new', 2));

    expect(selection).toMatchObject({
      side: 'new',
      startLine: 2,
      endLine: 2,
      selectedText: 'added line',
      fileOccurrence: 0,
      hunkOccurrence: 0,
    });
  });

  test('clicking the old-side control on a removal selects the removed line', async () => {
    let selection: SourceDiffAnnotationSelection | null | undefined;
    const { container } = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        selection = next;
      },
    });

    await fireEvent.click(control(container, 'old', 2));

    expect(selection).toMatchObject({ side: 'old', startLine: 2, selectedText: 'removed line' });
  });

  test('a context row exposes both an old and a new control, each independently selectable', async () => {
    let selection: SourceDiffAnnotationSelection | null | undefined;
    const { container } = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        selection = next;
      },
    });

    await fireEvent.click(control(container, 'old', 1));
    expect(selection).toMatchObject({ side: 'old', startLine: 1 });

    await fireEvent.click(control(container, 'new', 1));
    expect(selection).toMatchObject({ side: 'new', startLine: 1 });
  });

  test('shift-click extends from the last origin into a contiguous range', async () => {
    let selection: SourceDiffAnnotationSelection | null | undefined;
    const { container } = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        selection = next;
      },
    });

    await fireEvent.click(control(container, 'new', 1));
    await fireEvent.click(control(container, 'new', 3), { shiftKey: true });

    expect(selection).toMatchObject({ side: 'new', startLine: 1, endLine: 3 });
  });

  test('shift-clicking across a file boundary is rejected with a visible explanation and no callback', async () => {
    let callCount = 0;
    const { container } = render(SourceDiffViewer, {
      patch: twoFilePatch,
      onAnnotationSelectionChange: () => {
        callCount += 1;
      },
    });

    await fireEvent.click(control(container, 'new', 1, 0, 0));
    expect(callCount).toBe(1);

    await fireEvent.click(control(container, 'new', 1, 1, 0), { shiftKey: true });

    expect(callCount).toBe(1);
    const status = container.querySelector('.cinder-source-diff-viewer__annotation-status');
    expect(status?.textContent?.trim().length).toBeGreaterThan(0);
  });

  test('keyboard: Enter starts, Shift+ArrowDown extends, Enter commits', async () => {
    let selection: SourceDiffAnnotationSelection | null | undefined;
    const { container } = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        selection = next;
      },
    });

    const startControl = control(container, 'new', 1);
    startControl.focus();
    await fireEvent.keyDown(startControl, { key: 'Enter' });
    // Starting a selection must not itself commit.
    expect(selection).toBeUndefined();

    await fireEvent.keyDown(startControl, { key: 'ArrowDown', shiftKey: true });
    await fireEvent.keyDown(control(container, 'new', 2), { key: 'Enter' });

    expect(selection).toMatchObject({ startLine: 1, endLine: 2 });
  });

  test('keyboard selection and shift-click selection produce an identical payload for the same range', async () => {
    let keyboardSelection: SourceDiffAnnotationSelection | null | undefined;
    let pointerSelection: SourceDiffAnnotationSelection | null | undefined;

    const keyboardRender = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        keyboardSelection = next;
      },
    });
    const start = control(keyboardRender.container, 'new', 1);
    start.focus();
    await fireEvent.keyDown(start, { key: 'Enter' });
    await fireEvent.keyDown(start, { key: 'ArrowDown', shiftKey: true });
    await fireEvent.keyDown(control(keyboardRender.container, 'new', 2), {
      key: 'ArrowDown',
      shiftKey: true,
    });
    await fireEvent.keyDown(control(keyboardRender.container, 'new', 3), { key: 'Enter' });

    const pointerRender = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        pointerSelection = next;
      },
    });
    await fireEvent.click(control(pointerRender.container, 'new', 1));
    await fireEvent.click(control(pointerRender.container, 'new', 3), { shiftKey: true });

    expect(keyboardSelection).toBeDefined();
    expect(pointerSelection).toBeDefined();
    expect(keyboardSelection).toEqual(pointerSelection);
  });

  test('keyboard: Escape cancels a pending selection and returns focus to the origin', async () => {
    let selection: SourceDiffAnnotationSelection | null | undefined;
    const { container } = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        selection = next;
      },
    });

    const startControl = control(container, 'new', 1);
    startControl.focus();
    await fireEvent.keyDown(startControl, { key: 'Enter' });
    await fireEvent.keyDown(startControl, { key: 'ArrowDown', shiftKey: true });
    await fireEvent.keyDown(control(container, 'new', 2), { key: 'Escape' });

    expect(document.activeElement).toBe(startControl);

    // A further Enter on the origin now starts a NEW selection rather than
    // committing the canceled one.
    await fireEvent.keyDown(startControl, { key: 'Enter' });
    expect(selection).toBeUndefined();
  });

  test('metadata and non-content rows never render an annotation control', () => {
    const binaryPatch = `diff --git a/image.png b/image.png
index 1111111..2222222 100644
Binary files a/image.png and b/image.png differ
`;
    const { container } = render(SourceDiffViewer, {
      patch: binaryPatch,
      onAnnotationSelectionChange: () => {},
    });

    expect(container.querySelectorAll('[data-cinder-annotation-control]')).toHaveLength(0);
  });

  test('a fully truncated file renders no annotation control and no line anchor is possible', () => {
    const { container } = render(SourceDiffViewer, {
      patch: onePatch,
      maxLines: 0,
      onAnnotationSelectionChange: () => {},
    });

    expect(container.querySelectorAll('[data-cinder-annotation-control]')).toHaveLength(0);
  });
});

describe('SourceDiffViewer: onFilesChange and activeFileOccurrence', () => {
  test('calls onFilesChange with a descriptor for every recognized file', async () => {
    let files: SourceDiffFileDescriptor[] | undefined;
    render(SourceDiffViewer, {
      patch: twoFilePatch,
      onFilesChange: (next: SourceDiffFileDescriptor[]) => {
        files = next;
      },
    });

    await waitFor(() => expect(files).toBeDefined());
    expect(files).toHaveLength(2);
    expect(files?.[0]?.fileOccurrence).toBe(0);
    expect(files?.[1]?.fileOccurrence).toBe(1);
  });

  test('activeFileOccurrence renders only the matching file', () => {
    const { container } = render(SourceDiffViewer, {
      patch: twoFilePatch,
      activeFileOccurrence: 1,
    });

    expect(container.querySelectorAll('.cinder-source-diff-viewer__file')).toHaveLength(1);
    expect(container.textContent).toContain('src/two.ts');
    expect(container.textContent).not.toContain('src/one.ts');
  });

  test('absent activeFileOccurrence renders every file, matching prior behavior', () => {
    const { container } = render(SourceDiffViewer, { patch: twoFilePatch });

    expect(container.querySelectorAll('.cinder-source-diff-viewer__file')).toHaveLength(2);
  });

  test('a fully truncated active file shows its header and an unavailable-lines message', () => {
    const { container } = render(SourceDiffViewer, {
      patch: onePatch,
      maxLines: 0,
      activeFileOccurrence: 0,
    });

    expect(container.textContent).toContain('Lines unavailable at the current display limit.');
  });
});

describe('SourceDiffViewer: ref.focusFile / ref.focusAnchor', () => {
  test('focusFile focuses the matching file header and reports focused', async () => {
    let ref: SourceDiffViewerRef | undefined;
    const { container } = render(SourceDiffViewer, {
      patch: twoFilePatch,
      get ref() {
        return ref;
      },
      set ref(next: SourceDiffViewerRef | undefined) {
        ref = next;
      },
    });

    await waitFor(() => expect(ref).toBeDefined());
    const result = ref?.focusFile(1);

    expect(result).toEqual({ status: 'focused' });
    const header = container.querySelector('[data-cinder-file-occurrence="1"]');
    expect(document.activeElement).toBe(header);
  });

  test('focusFile reports unavailable for an occurrence that does not exist', async () => {
    let ref: SourceDiffViewerRef | undefined;
    render(SourceDiffViewer, {
      patch: onePatch,
      get ref() {
        return ref;
      },
      set ref(next: SourceDiffViewerRef | undefined) {
        ref = next;
      },
    });

    await waitFor(() => expect(ref).toBeDefined());
    expect(ref?.focusFile(99)).toEqual({ status: 'unavailable' });
  });

  test('focusAnchor focuses the matching line control', async () => {
    let ref: SourceDiffViewerRef | undefined;
    render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: () => {},
      get ref() {
        return ref;
      },
      set ref(next: SourceDiffViewerRef | undefined) {
        ref = next;
      },
    });

    await waitFor(() => expect(ref).toBeDefined());
    const result = ref?.focusAnchor({
      fileOccurrence: 0,
      hunkOccurrence: 0,
      side: 'new',
      startLine: 2,
    });

    expect(result).toEqual({ status: 'focused' });
  });

  test('focusAnchor reports unavailable for a pruned/unknown row', async () => {
    let ref: SourceDiffViewerRef | undefined;
    render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: () => {},
      get ref() {
        return ref;
      },
      set ref(next: SourceDiffViewerRef | undefined) {
        ref = next;
      },
    });

    await waitFor(() => expect(ref).toBeDefined());
    expect(
      ref?.focusAnchor({ fileOccurrence: 0, hunkOccurrence: 0, side: 'new', startLine: 999 }),
    ).toEqual({ status: 'unavailable' });
  });

  test('releases the ref on unmount', async () => {
    let ref: SourceDiffViewerRef | undefined;
    const view = render(SourceDiffViewer, {
      patch: onePatch,
      get ref() {
        return ref;
      },
      set ref(next: SourceDiffViewerRef | undefined) {
        ref = next;
      },
    });

    await waitFor(() => expect(ref).toBeDefined());
    view.unmount();
    await tick();
    expect(ref).toBeUndefined();
  });
});

describe('SourceDiffViewer: controlled annotationSelection as the extension origin', () => {
  test('shift-click extends from a host-supplied controlled selection, not a stale internal origin', async () => {
    const externalSelection: SourceDiffAnnotationSelection = {
      fileOccurrence: 0,
      hunkOccurrence: 0,
      side: 'new',
      startLine: 1,
      endLine: 1,
      coordinateSpace: 'raw-source',
      selectedText: 'context before',
      contextBefore: [],
      contextAfter: [],
      oldPath: 'src/one.ts',
      newPath: 'src/one.ts',
    };
    let selection: SourceDiffAnnotationSelection | null | undefined;
    const { container } = render(SourceDiffViewer, {
      patch: onePatch,
      annotationSelection: externalSelection,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        selection = next;
      },
    });

    // No click happened yet in this instance — the only way a shift-click can
    // extend is if the controlled `annotationSelection` prop supplied the
    // origin.
    await fireEvent.click(control(container, 'new', 3), { shiftKey: true });

    expect(selection).toMatchObject({ startLine: 1, endLine: 3 });
  });
});

describe('SourceDiffViewer: annotationSelection survives $state round-trips', () => {
  test('a backward shift-click range keeps the true origin after the selection round-trips through $state', async () => {
    const { default: AnnotationSelectionHarness } =
      await import('./source-diff-viewer-annotation-selection-harness.svelte');
    const { container, getByTestId } = render(AnnotationSelectionHarness, { patch: onePatch });

    // Origin at line 3 (the highest line), then shift-click backward to line
    // 1: the contiguous range is 1-3, but the true origin stays line 3 — the
    // harness echoes the emitted selection back in through `$state`, which
    // wraps it in a new proxy object before the component reads it back as
    // `annotationSelection`.
    await fireEvent.click(control(container, 'new', 3));
    await fireEvent.click(control(container, 'new', 1), { shiftKey: true });
    await tick();
    expect(getByTestId('selection-readout').textContent?.trim()).toBe('1-3');

    // A further shift-click to line 2 must extend from the true origin (3),
    // producing 2-3 — not from the echoed range's `startLine` (1), which
    // would incorrectly produce 1-2.
    await fireEvent.click(control(container, 'new', 2), { shiftKey: true });
    await tick();

    const status = container.querySelector('.cinder-source-diff-viewer__annotation-status');
    expect(status?.textContent?.trim()).toBe('');
    expect(getByTestId('selection-readout').textContent?.trim()).toBe('2-3');
  });
});

describe('SourceDiffViewer: focusFile/focusAnchor after a synchronous prop change', () => {
  test('focusFile succeeds for a file revealed by the same synchronous activeFileOccurrence change', async () => {
    const { default: ActiveFileFocusHarness } =
      await import('./source-diff-viewer-active-file-focus-harness.svelte');
    const { getByTestId } = render(ActiveFileFocusHarness, { patch: twoFilePatch });
    await tick();

    await fireEvent.click(getByTestId('switch-and-focus'));

    expect(getByTestId('focus-result').textContent).toBe('focused');
  });
});

describe('SourceDiffViewer: two-instance isolation', () => {
  test('selecting in one instance does not affect another, and control IDs never collide', async () => {
    let firstSelection: SourceDiffAnnotationSelection | null | undefined;
    let secondCallCount = 0;

    const first = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: (next: SourceDiffAnnotationSelection | null) => {
        firstSelection = next;
      },
    });
    const second = render(SourceDiffViewer, {
      patch: onePatch,
      onAnnotationSelectionChange: () => {
        secondCallCount += 1;
      },
    });

    const firstControls = first.container.querySelectorAll('[data-cinder-annotation-control]');
    const secondControls = second.container.querySelectorAll('[data-cinder-annotation-control]');
    const firstIds = [...firstControls].map((element) => element.id);
    const secondIds = [...secondControls].map((element) => element.id);
    for (const id of firstIds) expect(secondIds).not.toContain(id);

    await fireEvent.click(control(first.container, 'new', 2));

    expect(firstSelection).toMatchObject({ startLine: 2 });
    expect(secondCallCount).toBe(0);
  });
});
