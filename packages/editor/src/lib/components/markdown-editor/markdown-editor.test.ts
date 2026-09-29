/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';

setupHappyDom();

const [{ default: MarkdownEditor }, { cleanup, render, waitFor }] = await Promise.all([
  import('./markdown-editor.svelte'),
  import('@testing-library/svelte'),
]);

type NoiseCollector = {
  messages: string[];
  restore: () => void;
};

function normalizeMessage(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  return String(value);
}

function collectTeardownNoise(): NoiseCollector {
  const messages: string[] = [];
  const originalConsoleError = console.error;
  const handleWindowError = (event: ErrorEvent) => {
    messages.push(normalizeMessage(event.error ?? event.message));
  };
  const handleWindowUnhandledRejection = (event: PromiseRejectionEvent) => {
    messages.push(normalizeMessage(event.reason));
  };
  const handleProcessUncaughtException = (error: Error) => {
    messages.push(normalizeMessage(error));
  };
  const handleProcessUnhandledRejection = (reason: unknown) => {
    messages.push(normalizeMessage(reason));
  };

  console.error = (...args: unknown[]) => {
    messages.push(args.map(normalizeMessage).join(' '));
  };
  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleWindowUnhandledRejection);
  process.on('uncaughtException', handleProcessUncaughtException);
  process.on('unhandledRejection', handleProcessUnhandledRejection);

  return {
    messages,
    restore() {
      console.error = originalConsoleError;
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleWindowUnhandledRejection);
      process.off('uncaughtException', handleProcessUncaughtException);
      process.off('unhandledRejection', handleProcessUnhandledRejection);
    },
  };
}

async function drainLateCallbacks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// COR-463 — LinkPopover closing and focus restoration
//
// MarkdownEditor's own render path requires a browser-bound Milkdown/
// ProseMirror instance (see the `$effect` gated on `browser` in
// markdown-editor.svelte) that this happy-dom suite does not boot, matching
// the existing convention in markdown-editor.toolbar-layout.test.ts of
// asserting the composed wiring against source rather than a full render.
// ---------------------------------------------------------------------------

describe('MarkdownEditor — LinkPopover closing and focus restoration (COR-463)', () => {
  test('explicit closes (Escape/Cancel/Close/Insert/Update/Remove) still restore editor focus', async () => {
    const source = await Bun.file(new URL('./markdown-editor.svelte', import.meta.url)).text();

    // onclose (which LinkPopover fires for Escape, its Cancel/Close buttons,
    // and Enter/Insert-triggered submission) still refocuses the editor.
    const closeHandlerMatch = source.match(/function handleLinkPopoverClose\(\)\s*\{([^}]*)\}/);
    expect(closeHandlerMatch).not.toBeNull();
    expect(closeHandlerMatch![1]).toContain('editorState?.focus()');

    // Insert and Remove keep their own existing editor-focus restoration too.
    const insertHandlerMatch = source.match(
      /function handleLinkInsert\([^)]*\)\s*\{([\s\S]*?)\n {2}\}/,
    );
    expect(insertHandlerMatch).not.toBeNull();
    expect(insertHandlerMatch![1]).toContain('editorState?.focus()');

    const removeHandlerMatch = source.match(/function handleLinkRemove\(\)\s*\{([^}]*)\}/);
    expect(removeHandlerMatch).not.toBeNull();
    expect(removeHandlerMatch![1]).toContain('editorState?.focus()');

    expect(source).toContain('onclose={handleLinkPopoverClose}');
  });

  test('outside-click dismissal is wired separately and does not steal focus into the editor', async () => {
    const source = await Bun.file(new URL('./markdown-editor.svelte', import.meta.url)).text();

    // A distinct handler backs outside dismissal, and it must NOT call
    // editorState.focus() — doing so would steal focus from whatever the
    // user actually clicked (COR-463: "Outside click dismisses without
    // stealing focus from the clicked control").
    const dismissHandlerMatch = source.match(
      /function handleLinkPopoverOutsideDismiss\(\)\s*\{([^}]*)\}/,
    );
    expect(dismissHandlerMatch).not.toBeNull();
    expect(dismissHandlerMatch![1]).not.toContain('editorState?.focus()');
    expect(dismissHandlerMatch![1]).toContain('linkPopoverOpen = false');

    expect(source).toContain('onOutsideDismiss={handleLinkPopoverOutsideDismiss}');
  });
});

describe('MarkdownEditor teardown', () => {
  test('unmounts without uncaught cleanup errors', async () => {
    const noise = collectTeardownNoise();

    try {
      const result = render(MarkdownEditor, {
        props: {
          id: 'quiet-markdown-editor',
          label: 'Quiet Markdown editor',
          toolbarEnabled: false,
          value: 'Initial **markdown**',
        },
      });

      await waitFor(() => {
        expect(result.getByRole('textbox', { name: 'Quiet Markdown editor' })).toBeTruthy();
      });

      result.unmount();
    } finally {
      cleanup();
      await drainLateCallbacks();
      noise.restore();
    }

    expect(noise.messages).toEqual([]);
  });
});
