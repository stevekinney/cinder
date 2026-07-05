import { afterEach, describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const [{ default: MarkdownEditor }, { cleanup, render, waitFor }] = await Promise.all([
  import('./markdown-editor.svelte'),
  import('@testing-library/svelte'),
]);

afterEach(() => cleanup());

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
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
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
  process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    messages.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return originalStderrWrite(chunk, ...(args as []));
  }) as typeof process.stderr.write;
  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleWindowUnhandledRejection);
  process.on('uncaughtException', handleProcessUncaughtException);
  process.on('unhandledRejection', handleProcessUnhandledRejection);

  return {
    messages,
    restore() {
      console.error = originalConsoleError;
      process.stderr.write = originalStderrWrite;
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

describe('MarkdownEditor teardown', () => {
  test('unmounts without late Milkdown cleanup noise', async () => {
    const noise = collectTeardownNoise();

    try {
      const result = render(MarkdownEditor, {
        props: {
          id: 'quiet-markdown-editor',
          label: 'Quiet Markdown editor',
          showToolbar: false,
          value: 'Initial **markdown**',
        },
      });

      await waitFor(() => {
        expect(result.getByRole('textbox', { name: 'Quiet Markdown editor' })).toBeTruthy();
      });

      result.unmount();
      await drainLateCallbacks();
    } finally {
      noise.restore();
    }

    expect(noise.messages).toEqual([]);
  });

  test('unmounts during asynchronous Milkdown initialization without cleanup noise', async () => {
    const noise = collectTeardownNoise();

    try {
      const result = render(MarkdownEditor, {
        props: {
          id: 'rapid-markdown-editor',
          label: 'Rapid Markdown editor',
          showToolbar: false,
          value: 'Initial **markdown**',
        },
      });

      result.unmount();
      await drainLateCallbacks();
    } finally {
      noise.restore();
    }

    expect(noise.messages).toEqual([]);
  });
});
