/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import { setupClipboardTests } from './clipboard-test-support.ts';
import { copyToClipboard } from './clipboard.ts';

setupClipboardTests();

describe('copyToClipboard', () => {
  test('starts a rich clipboard write before a same-origin image fetch resolves', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const originalFetch = globalThis.fetch;
    const OriginalClipboardItem = globalThis.ClipboardItem;
    class TestClipboardItem {
      constructor(readonly values: Record<string, Blob | Promise<Blob>>) {}
    }
    const write = mock(async (items: ClipboardItem[]) => {
      const item = items[0];
      if (!(item instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      await item.values['image/png'];
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: mock(() => pendingFetch),
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: TestClipboardItem,
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText: mock(async () => undefined) },
    });

    try {
      const copy = copyToClipboard('Hello', {
        html: '<strong>Hello</strong>',
        image: 'data:image/png;base64,cG5n',
      });
      await Promise.resolve();
      expect(write).toHaveBeenCalledTimes(1);
      resolveFetch?.(
        new Response('png', { status: 200, headers: { 'Content-Type': 'image/png' } }),
      );
      expect(await copy).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      });
    }
  });

  test('includes PNG responses from extensionless same-origin image routes', async () => {
    const originalFetch = globalThis.fetch;
    const OriginalClipboardItem = globalThis.ClipboardItem;
    const originalLocation = globalThis.location;
    class TestClipboardItem {
      constructor(readonly values: Record<string, Blob | Promise<Blob>>) {}
    }
    const write = mock(async (items: ClipboardItem[]) => {
      const item = items[0];
      if (!(item instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      const image = await item.values['image/png'];
      expect(image?.type).toBe('image/png');
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: new URL('https://chat.example.test/conversation'),
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: mock(async () =>
        Promise.resolve(
          new Response('png', { status: 200, headers: { 'Content-Type': 'image/png' } }),
        ),
      ),
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: TestClipboardItem,
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText: mock(async () => undefined) },
    });

    try {
      expect(
        await copyToClipboard('Hello', {
          html: '<strong>Hello</strong>',
          image: 'https://chat.example.test/api/attachments/123',
        }),
      ).toBe(true);
      expect(write).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: originalLocation,
      });
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      });
    }
  });

  test('retries rich HTML without an image when the image representation rejects', async () => {
    const originalFetch = globalThis.fetch;
    const OriginalClipboardItem = globalThis.ClipboardItem;
    class TestClipboardItem {
      constructor(readonly values: Record<string, Blob | Promise<Blob>>) {}
    }
    const write = mock(async (items: ClipboardItem[]) => {
      const item = items[0];
      if (!(item instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      if (item.values['image/png']) await item.values['image/png'];
    });
    const writeText = mock(async () => undefined);
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: mock(async () => Promise.reject(new Error('offline'))),
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: TestClipboardItem,
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText },
    });

    try {
      expect(
        await copyToClipboard('Hello', {
          html: '<strong>Hello</strong>',
          image: 'data:image/png;base64,cG5n',
        }),
      ).toBe(true);
      expect(write).toHaveBeenCalledTimes(2);
      const fallbackItem = write.mock.calls[1]?.[0]?.[0];
      if (!(fallbackItem instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      expect(Object.keys(fallbackItem.values)).toEqual(['text/plain', 'text/html']);
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      });
    }
  });

  test('retries rich HTML without an image when the fetched blob type does not match the URL-inferred type', async () => {
    const originalFetch = globalThis.fetch;
    const OriginalClipboardItem = globalThis.ClipboardItem;
    class TestClipboardItem {
      constructor(readonly values: Record<string, Blob | Promise<Blob>>) {}
    }
    const write = mock(async (items: ClipboardItem[]) => {
      const item = items[0];
      if (!(item instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      if (item.values['image/png']) await item.values['image/png'];
    });
    const writeText = mock(async () => undefined);
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: mock(async () =>
        // The URL declares `image/png` (its data: URI MIME type); the fetched
        // blob reports a different type, so the representation's own
        // type-mismatch check must reject rather than hand back mislabeled
        // bytes.
        Promise.resolve(new Response(new Blob(['jpg'], { type: 'image/jpeg' }), { status: 200 })),
      ),
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: TestClipboardItem,
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText },
    });

    try {
      expect(
        await copyToClipboard('Hello', {
          html: '<strong>Hello</strong>',
          image: 'data:image/png;base64,cG5n',
        }),
      ).toBe(true);
      expect(write).toHaveBeenCalledTimes(2);
      const fallbackItem = write.mock.calls[1]?.[0]?.[0];
      if (!(fallbackItem instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      expect(Object.keys(fallbackItem.values)).toEqual(['text/plain', 'text/html']);
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      });
    }
  });
});
