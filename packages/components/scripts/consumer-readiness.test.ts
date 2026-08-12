import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { waitForReadyHtml, type ReadinessFetch } from './consumer-readiness.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const svelteKitDevSsrFixturePath = join(
  scriptDirectory,
  '../fixtures/sveltekit-consumer/src/routes/dev-ssr/+page.svelte',
);

function response(html: string, status = 200): Response {
  return new Response(html, { status });
}

describe('waitForReadyHtml', () => {
  test('waits for the target route HTML predicate instead of first HTTP 200', async () => {
    const responses = [
      response('<main>loading shell</main>'),
      response('<main data-ready>ready</main>'),
    ];
    const fetcher: ReadinessFetch = async () => responses.shift() ?? response('unexpected');

    const html = await waitForReadyHtml({
      url: 'http://127.0.0.1:5173/dev-ssr',
      timeoutMs: 1_000,
      pollIntervalMs: 0,
      runningServer: { exitCode: null },
      fetcher,
      isReady: (body) => body.includes('data-ready'),
    });

    expect(html).toContain('data-ready');
  });

  test('caps individual SSR requests so one hung response cannot consume the readiness budget', async () => {
    const observedTimeouts: number[] = [];
    const fetcher: ReadinessFetch = async (_url, timeoutMs) => {
      observedTimeouts.push(timeoutMs);
      return response('<main data-ready>ready</main>');
    };

    await waitForReadyHtml({
      url: 'http://127.0.0.1:5173/dev-ssr',
      timeoutMs: 1_000,
      requestTimeoutMs: 250,
      pollIntervalMs: 0,
      runningServer: { exitCode: null },
      fetcher,
      isReady: (body) => body.includes('data-ready'),
    });

    expect(observedTimeouts).toHaveLength(1);
    expect(observedTimeouts[0]).toBe(250);
  });

  test('retries after a per-request timeout while the overall readiness budget remains open', async () => {
    const observedTimeouts: number[] = [];
    let attempts = 0;
    const fetcher: ReadinessFetch = async (_url, timeoutMs) => {
      observedTimeouts.push(timeoutMs);
      attempts += 1;
      if (attempts === 1) {
        throw new Error('The operation timed out.');
      }
      return response('<main data-ready>ready</main>');
    };

    const html = await waitForReadyHtml({
      url: 'http://127.0.0.1:5173/dev-ssr',
      timeoutMs: 1_000,
      requestTimeoutMs: 250,
      pollIntervalMs: 0,
      runningServer: { exitCode: null },
      fetcher,
      isReady: (body) => body.includes('data-ready'),
    });

    expect(html).toContain('data-ready');
    expect(observedTimeouts).toEqual([250, 250]);
  });

  test('fails immediately when the server exits before the target route is ready', async () => {
    await expect(
      waitForReadyHtml({
        url: 'http://127.0.0.1:5173/dev-ssr',
        timeoutMs: 1_000,
        pollIntervalMs: 0,
        runningServer: { exitCode: 1 },
        fetcher: async () => response('<main data-ready>ready</main>'),
        isReady: (body) => body.includes('data-ready'),
      }),
    ).rejects.toThrow('server exited with code 1');
  });

  test('keeps the dev SSR fixture off the package root barrel', async () => {
    const source = await Bun.file(svelteKitDevSsrFixturePath).text();

    expect(source).not.toContain("from '@lostgradient/cinder'");
    expect(source).not.toContain('from "@lostgradient/cinder"');
  });
});
