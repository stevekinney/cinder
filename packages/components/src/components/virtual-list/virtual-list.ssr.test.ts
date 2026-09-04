/**
 * VirtualList SSR contract (CIN-205).
 *
 * VirtualList measures rows with a `ResizeObserver` when `dynamicSize` is true.
 * None of that may run on the server: every DOM touch in the component lives
 * inside an `$effect`, an `$effect.pre`, or an `{@attach ...}` body, and Svelte's
 * server renderer runs none of those. The dynamic-size path therefore renders
 * server-side exactly the way an unmeasured client mount does — every row at the
 * `itemHeight` estimate — with no measurement machinery constructed at all.
 *
 * This is asserted as an executable regression rather than a structural argument:
 * `globalThis.ResizeObserver` is replaced with a constructor that throws for the
 * duration of the render, so any code path that attempted to build one would fail
 * the test loudly instead of silently working in this environment and breaking in
 * a real server.
 *
 * The compile-and-render mechanics mirror `resizable-panels.ssr.test.ts`: compile
 * in `generate: 'server'` mode, rewrite bare `svelte` imports to the SSR entry, and
 * use the SERVER `createRawSnippet` (the client one builds DOM nodes and crashes
 * once `window` is nulled).
 */
import { rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, test } from 'bun:test';
import { compile } from 'svelte/compiler';

import type { VirtualListRowContext } from './virtual-list.types.ts';

const sourcePath = new URL('./virtual-list.svelte', import.meta.url).pathname;

type EventRow = { id: string; label: string };

const rows: EventRow[] = Array.from({ length: 500 }, (_, index) => ({
  id: `row-${index}`,
  label: `Row ${index}`,
}));

const originalResizeObserver = globalThis.ResizeObserver;

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

/**
 * Stands in for ResizeObserver during the server render and throws if anything
 * tries to construct it. A plain function rather than a class: `new` on it still
 * runs the body and throws, and a class whose only member is a constructor is
 * what it is replacing.
 */
function throwingResizeObserver(): never {
  throw new Error('ResizeObserver must never be constructed during server rendering');
}

async function renderComponentToServerHtml(props: Record<string, unknown>): Promise<string> {
  const source = await Bun.file(sourcePath).text();
  const compiled = compile(source, {
    filename: sourcePath,
    generate: 'server',
    css: 'external',
    dev: false,
  });

  const sveltePackageJson = new URL(import.meta.resolve('svelte/package.json')).pathname;
  const serverSvelteEntry = pathToFileURL(
    join(dirname(sveltePackageJson), 'src/index-server.js'),
  ).href;
  const serverCode = compiled.js.code.replaceAll(
    "from 'svelte';",
    `from ${JSON.stringify(serverSvelteEntry)};`,
  );

  const tempFile = join(dirname(sourcePath), `.cinder-ssr-test-${process.pid}-${Date.now()}.mjs`);
  await writeFile(tempFile, serverCode, 'utf-8');

  try {
    const ssrModule = (await import(tempFile)) as { default: unknown };
    const { render } = (await import('svelte/server')) as typeof import('svelte/server');
    const { createRawSnippet: serverCreateRawSnippet } = (await import(
      serverSvelteEntry
    )) as typeof import('svelte');

    const row = serverCreateRawSnippet<[EventRow, VirtualListRowContext]>((getItem) => ({
      render: () => `<span>${getItem().label}</span>`,
    }));

    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    globalThis.document = undefined as unknown as Document;
    globalThis.window = undefined as unknown as Window & typeof globalThis;
    globalThis.ResizeObserver = throwingResizeObserver as unknown as typeof ResizeObserver;

    try {
      const { body } = render(
        ssrModule.default as import('svelte').Component<Record<string, unknown>>,
        { props: { ...props, row } },
      );
      return body;
    } finally {
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
      globalThis.ResizeObserver = originalResizeObserver;
    }
  } finally {
    void rm(tempFile, { force: true }).catch(() => {});
  }
}

describe('VirtualList SSR contract', () => {
  test('renders the fixed-height path without throwing', async () => {
    const html = await renderComponentToServerHtml({
      items: rows,
      itemHeight: 40,
      height: '400px',
      'aria-label': 'Rows',
    });

    expect(html).toContain('cinder-virtual-list');
    expect(html).toContain('cinder-virtual-list__row');
  });

  test('renders the dynamic-size path without constructing a ResizeObserver', async () => {
    // ResizeObserver is stubbed to throw for the duration of this render. Reaching
    // the assertions at all proves nothing tried to construct one on the server.
    const html = await renderComponentToServerHtml({
      items: rows,
      itemHeight: 40,
      height: '400px',
      dynamicSize: true,
      'aria-label': 'Rows',
    });

    expect(html).toContain('cinder-virtual-list');
    expect(html).toContain('data-cinder-dynamic-size="true"');
  });

  test('sizes the dynamic-size spacer from the estimate when nothing has been measured', async () => {
    // 500 rows x 40px estimate. Server-side the measurement cache is empty, so
    // buildVirtualOffsets falls back to the estimate for every row — the same
    // fallback an unmeasured first client paint takes.
    const html = await renderComponentToServerHtml({
      items: rows,
      itemHeight: 40,
      height: '400px',
      dynamicSize: true,
      'aria-label': 'Rows',
    });

    expect(html).toContain('block-size:20000px');
  });

  test('emits no measured row heights in dynamic-size mode', async () => {
    // Fixed mode pins each row's height inline; dynamic mode must NOT, because a
    // pinned height would make every row measure back as exactly the estimate and
    // the measurement pass could never observe a real size.
    const dynamicHtml = await renderComponentToServerHtml({
      items: rows,
      itemHeight: 40,
      height: '400px',
      dynamicSize: true,
      'aria-label': 'Rows',
    });
    const fixedHtml = await renderComponentToServerHtml({
      items: rows,
      itemHeight: 40,
      height: '400px',
      'aria-label': 'Rows',
    });

    expect(fixedHtml).toContain('block-size:40px');
    expect(dynamicHtml).not.toContain('block-size:40px');
  });
});
