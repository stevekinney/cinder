/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import { setupClipboardTests } from './clipboard-test-support.ts';
import { copyToClipboard } from './clipboard.ts';

setupClipboardTests();

describe('copyToClipboard', () => {
  test('keeps rich HTML when an optional image cannot be fetched', async () => {
    const write = mock(async (_items: ClipboardItem[]) => undefined);
    const writeText = mock(async () => undefined);
    const originalFetch = globalThis.fetch;
    const OriginalClipboardItem = globalThis.ClipboardItem;
    class TestClipboardItem {
      constructor(readonly values: Record<string, Blob>) {}
    }
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: mock(async () => Promise.reject(new Error('cors'))),
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
          image: 'https://example.test/cross-origin.png',
        }),
      ).toBe(true);
      const [writtenItems] = write.mock.calls[0]!;
      const item = writtenItems[0];
      if (!(item instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      expect(await item.values['text/html']?.text()).toBe('<strong>Hello</strong>');
      expect(Object.keys(item.values)).toEqual(['text/plain', 'text/html']);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: originalFetch,
      });
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      });
    }
  });

  test('keeps rich HTML when an optional image URL is invalid', async () => {
    const write = mock(async (_items: ClipboardItem[]) => undefined);
    const OriginalClipboardItem = globalThis.ClipboardItem;
    class TestClipboardItem {
      constructor(readonly values: Record<string, Blob | Promise<Blob>>) {}
    }
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
          image: 'http://[invalid',
        }),
      ).toBe(true);
      const [writtenItems] = write.mock.calls[0]!;
      const item = writtenItems[0];
      if (!(item instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      expect(Object.keys(item.values)).toEqual(['text/plain', 'text/html']);
    } finally {
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      });
    }
  });

  test('keeps rich HTML when the optional image string is blank', async () => {
    const write = mock(async (_items: ClipboardItem[]) => undefined);
    const OriginalClipboardItem = globalThis.ClipboardItem;
    class TestClipboardItem {
      constructor(readonly values: Record<string, Blob | Promise<Blob>>) {}
    }
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
          image: '   ',
        }),
      ).toBe(true);
      const [writtenItems] = write.mock.calls[0]!;
      const item = writtenItems[0];
      if (!(item instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      expect(Object.keys(item.values)).toEqual(['text/plain', 'text/html']);
    } finally {
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      });
    }
  });

  test('skips blob URLs whose MIME type cannot be inferred synchronously', async () => {
    const write = mock(async (_items: ClipboardItem[]) => undefined);
    const originalFetch = globalThis.fetch;
    const OriginalClipboardItem = globalThis.ClipboardItem;
    class TestClipboardItem {
      constructor(readonly values: Record<string, Blob | Promise<Blob>>) {}
    }
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: mock(async () => Promise.reject(new Error('must not fetch'))),
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
          image: 'blob:https://example.test/attachment',
        }),
      ).toBe(true);
      const item = write.mock.calls[0]?.[0]?.[0];
      if (!(item instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      expect(Object.keys(item.values)).toEqual(['text/plain', 'text/html']);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      });
    }
  });

  test('keeps rich HTML when an optional image format is unsupported', async () => {
    const write = mock(async (_items: ClipboardItem[]) => undefined);
    const writeText = mock(async () => undefined);
    const OriginalClipboardItem = globalThis.ClipboardItem;
    class TestClipboardItem {
      static supports = mock((_type: string) => false);
      constructor(readonly values: Record<string, Blob>) {}
    }
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
          image: new Blob(['jpeg'], { type: 'image/jpeg' }),
        }),
      ).toBe(true);
      const [writtenItems] = write.mock.calls[0]!;
      const item = writtenItems[0];
      if (!(item instanceof TestClipboardItem))
        throw new Error('Expected the captured clipboard item');
      expect(Object.keys(item.values)).toEqual(['text/plain', 'text/html']);
      expect(await item.values['text/html']?.text()).toBe('<strong>Hello</strong>');
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      });
    }
  });
});
