import { afterAll, beforeAll, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { setupHappyDom } from './happy-dom.ts';

let originalURL: string;
let harnessServer: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  setupHappyDom();
  originalURL = window.location.href;
  harnessServer = Bun.serve({ port: 0, fetch: () => new Response('') });
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
    'http://127.0.0.1:' + harnessServer.port + '/',
  );
});

afterAll(async () => {
  const happyWindow = window as unknown as {
    happyDOM: { setURL(url: string): void; waitUntilComplete(): Promise<void> };
  };
  happyWindow.happyDOM.setURL(originalURL);
  await happyWindow.happyDOM.waitUntilComplete();
  harnessServer.stop(true);
});

test('installs a standards-mode HTML document', () => {
  setupHappyDom();
  expect(document.doctype?.name).toBe('html');
  expect(document.compatMode).toBe('CSS1Compat');
});

test('keeps the installed MutationObserver replaceable', () => {
  setupHappyDom();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');

  expect(descriptor).toMatchObject({
    configurable: true,
    enumerable: true,
    writable: true,
  });
});

test('dispatches events created by the installed DOM realm', () => {
  setupHappyDom();
  const target = document.createElement('button');
  const event = new Event('click', { cancelable: true });
  const customEvent = new CustomEvent('cinder:test', { detail: { value: 1 } });
  let receivedEvent: Event | undefined;
  let receivedCustomEvent = false;

  target.addEventListener('click', (candidate) => {
    receivedEvent = candidate;
    candidate.preventDefault();
  });
  target.addEventListener('cinder:test', (candidate) => {
    receivedCustomEvent = candidate === customEvent;
  });

  expect(target.dispatchEvent(event)).toBe(false);
  expect(receivedEvent).toBe(event);
  expect(event.defaultPrevented).toBe(true);
  expect(target.dispatchEvent(customEvent)).toBe(true);
  expect(receivedCustomEvent).toBe(true);
  expect(customEvent.detail).toEqual({ value: 1 });
});

test('resolves and loads relative image URLs through a local server', async () => {
  setupHappyDom();
  const fixturePath = fileURLToPath(
    new URL('./__fixtures__/block-baseline-fixture.png', import.meta.url),
  );
  const fixtureBytes = readFileSync(fixturePath);
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname === '/fixture.png') {
        return new Response(fixtureBytes, { headers: { 'content-type': 'image/png' } });
      }
      return new Response('not found', { status: 404 });
    },
  });
  const happyWindow = window as unknown as Window & {
    happyDOM: {
      settings: { enableImageFileLoading: boolean };
      setURL(url: string): void;
      waitUntilComplete(): Promise<void>;
    };
  };
  const previousURL = happyWindow.location.href;
  const previousImageFileLoading = happyWindow.happyDOM.settings.enableImageFileLoading;
  const image = document.createElement('img');
  const outcome = new Promise<'load' | 'error'>((resolve) => {
    image.addEventListener('load', () => resolve('load'), { once: true });
    image.addEventListener('error', () => resolve('error'), { once: true });
  });

  try {
    const origin = 'http://127.0.0.1:' + server.port + '/';
    happyWindow.happyDOM.settings.enableImageFileLoading = true;
    happyWindow.happyDOM.setURL(origin);
    image.src = '/fixture.png';

    expect(image.src).toBe(origin + 'fixture.png');
    expect(await outcome).toBe('load');
    expect(image.complete).toBe(true);
    expect(image.naturalWidth).toBeGreaterThan(0);
    expect(image.naturalHeight).toBeGreaterThan(0);
  } finally {
    image.removeAttribute('src');
    happyWindow.happyDOM.setURL(previousURL);
    await happyWindow.happyDOM.waitUntilComplete();
    happyWindow.happyDOM.settings.enableImageFileLoading = previousImageFileLoading;
    server.stop(true);
  }
});

test('creates fetchable object URLs for files from the installed DOM realm', async () => {
  setupHappyDom();
  const server = Bun.serve({ port: 0, fetch: () => new Response('') });
  const happyWindow = window as unknown as Window & {
    happyDOM: { setURL(url: string): void; waitUntilComplete(): Promise<void> };
  };
  const previousURL = happyWindow.location.href;
  const file = new File(['pasted content'], 'paste.txt', { type: 'text/plain' });
  let objectUrl: string | undefined;
  try {
    happyWindow.happyDOM.setURL('http://127.0.0.1:' + server.port + '/');
    objectUrl = URL.createObjectURL(file);
    const response = await fetch(objectUrl);
    expect(response.headers.get('content-type')?.split(';')[0]).toBe('text/plain');
    expect(await response.text()).toBe('pasted content');
  } finally {
    if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
    happyWindow.happyDOM.setURL(previousURL);
    await happyWindow.happyDOM.waitUntilComplete();
    server.stop(true);
  }
});
