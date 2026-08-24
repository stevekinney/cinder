import { describe, expect, mock, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getPackFileName } from './publish-release.ts';
import { packageTarballPath } from './report-package-weight.ts';
import {
  boundedDiagnosticSnapshot,
  bumpPackageVersion,
  captureSvelteKitHydrationRouteFailureSnapshot,
  chatPeerValidationTarballPath,
  createBoundedDiagnosticCollection,
  diagnosticSnapshotFromValues,
  EXAMPLES_CONSUMER_READINESS_PATH,
  formatSvelteKitHydrationRouteFailure,
  isBrowserCrashError,
  parseHydrationBrowserProcessIds,
  preoptimizeSvelteKitChatHydration,
  prepareSvelteKitChatHydrationDevServer,
  recordBoundedDiagnostic,
  removeFixtureEntries,
  resolveChatFixtureCinderVersion,
  runBoundedHydrationTeardown,
  startSvelteKitChatHydrationDevServer,
  stopDevelopmentServer,
  SVELTEKIT_HYDRATION_ROUTES,
  unreclaimedTeardownFailures,
  wrapSvelteKitHydrationRouteFailure,
  type SvelteKitChatHydrationDevServerOptions,
  type SvelteKitHydrationRouteFailureSnapshot,
} from './validate-consumers.ts';

describe('consumer fixture cleanup', () => {
  test('removes nested requested entries and tolerates a missing entry', () => {
    const fixtureDirectory = mkdtempSync(join(tmpdir(), 'cinder-consumer-cleanup-'));
    const nestedDirectory = join(fixtureDirectory, '.svelte-kit', 'output', 'client');
    mkdirSync(nestedDirectory, { recursive: true });
    writeFileSync(join(nestedDirectory, 'entry.js'), 'generated');
    mkdirSync(join(fixtureDirectory, 'build'), { recursive: true });

    try {
      removeFixtureEntries(fixtureDirectory, ['.svelte-kit', 'build', 'missing']);

      expect(existsSync(join(fixtureDirectory, '.svelte-kit'))).toBe(false);
      expect(existsSync(join(fixtureDirectory, 'build'))).toBe(false);
      expect(existsSync(fixtureDirectory)).toBe(true);
    } finally {
      rmSync(fixtureDirectory, { recursive: true, force: true });
    }
  });
});

describe('SvelteKit Chat hydration optimizer preflight', () => {
  test('forces dependency optimization under the Chat hydration environment', async () => {
    const runCommand = mock(async () => ({ exitCode: 0, stdout: 'optimized', stderr: '' }));

    await preoptimizeSvelteKitChatHydration('/fixture', runCommand);

    expect(runCommand).toHaveBeenCalledWith('bun', ['x', 'vite', 'optimize', '--force'], {
      cwd: '/fixture',
      stdout: 'pipe',
      stderr: 'pipe',
      environment: {
        CINDER_CHAT_DEV_HYDRATION: '1',
        LANG: 'en_US.UTF-8',
        TZ: 'UTC',
      },
    });
  });

  test('stops before route readiness when dependency optimization fails', async () => {
    const runCommand = mock(async () => ({
      exitCode: 1,
      stdout: 'optimizer output',
      stderr: 'optimizer failure',
    }));

    await expect(preoptimizeSvelteKitChatHydration('/fixture', runCommand)).rejects.toThrow(
      'Vite dependency optimization failed before Chat hydration readiness:\noptimizer output\noptimizer failure',
    );
  });

  test('reports a shared-readiness-budget abort without starting Vite', async () => {
    const controller = new AbortController();
    controller.abort();
    const runCommand = mock(async () => ({ exitCode: 130, stdout: '', stderr: '' }));

    await expect(
      preoptimizeSvelteKitChatHydration('/fixture', runCommand, controller.signal),
    ).rejects.toThrow(
      'Vite dependency optimization exceeded the shared Chat hydration readiness budget',
    );
    expect(runCommand).toHaveBeenCalledWith(
      'bun',
      ['x', 'vite', 'optimize', '--force'],
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  test('rejects published-package source-map warnings from successful optimization', async () => {
    const runCommand = mock(async () => ({
      exitCode: 0,
      stdout: 'warning: @lostgradient/cinder/dist/index.js.map points to missing source',
      stderr: '',
    }));

    await expect(preoptimizeSvelteKitChatHydration('/fixture', runCommand)).rejects.toThrow(
      'Vite dependency optimization emitted source-map warnings for published package artifacts',
    );
  });

  test('starts Vite dev without forced reoptimization', () => {
    const fakeServer = {} as Bun.ReadableSubprocess;
    const startServer = mock(
      (_command: string[], _options: SvelteKitChatHydrationDevServerOptions) => {
        return fakeServer;
      },
    );

    const server = startSvelteKitChatHydrationDevServer('/fixture', 4_321, { startServer });

    expect(server).toBe(fakeServer);
    expect(startServer).toHaveBeenCalledWith(
      ['bunx', 'vite', 'dev', '--host', '127.0.0.1', '--port', '4321', '--strictPort'],
      expect.objectContaining({
        cwd: '/fixture',
        detached: true,
        env: expect.objectContaining({
          CINDER_CHAT_DEV_HYDRATION: '1',
          LANG: 'en_US.UTF-8',
          TZ: 'UTC',
        }),
        stderr: 'pipe',
        stdout: 'pipe',
      }),
    );
    expect(startServer.mock.calls[0]?.[0]).not.toContain('--force');
  });

  test('does not reserve a port or start Vite when optimization fails', async () => {
    const optimizerError = new Error('optimizer failed');
    const preoptimize = mock(async () => {
      throw optimizerError;
    });
    const pickPort = mock(async () => 4_321);
    const startServer = mock(
      (_command: string[], _options: SvelteKitChatHydrationDevServerOptions) =>
        ({}) as Bun.ReadableSubprocess,
    );

    await expect(
      prepareSvelteKitChatHydrationDevServer('/fixture', 'latest', {
        pickPort,
        preoptimize,
        startServer,
      }),
    ).rejects.toBe(optimizerError);
    expect(pickPort).not.toHaveBeenCalled();
    expect(startServer).not.toHaveBeenCalled();
  });
});

describe('SvelteKit hydration route matrix', () => {
  test('uses focused feature routes instead of the monolithic dev SSR fixture', () => {
    expect(SVELTEKIT_HYDRATION_ROUTES).toEqual([
      '/chat-layout',
      '/dev-ssr-dialog',
      '/dev-ssr-navigation',
      '/dev-ssr-tabs',
    ]);
    expect(SVELTEKIT_HYDRATION_ROUTES).not.toContain('/subpath');
    expect(SVELTEKIT_HYDRATION_ROUTES).not.toContain('/dev-ssr');
  });
});

describe('SvelteKit hydration route failure diagnostics', () => {
  const snapshot: SvelteKitHydrationRouteFailureSnapshot = {
    browserEvents: diagnosticSnapshotFromValues(['browser:connected']),
    currentUrl: 'http://127.0.0.1:4173/dev-ssr-tabs',
    documentReadyState: 'interactive',
    hydrationMarkerPresent: true,
    hydrationMarkerSelector: '[data-dev-ssr-hydrated]',
    hydrationMarkerValue: 'false',
    nonOkResponses: diagnosticSnapshotFromValues(['500 http://127.0.0.1:4173/api/bootstrap']),
    requestFailures: diagnosticSnapshotFromValues([
      'requestfailed route=/dev-ssr-tabs url=http://127.0.0.1:4173/chunk.js failure=net::ERR_FAILED',
    ]),
    runtimeErrors: diagnosticSnapshotFromValues(['hydration_mismatch: expected tab trigger']),
  };

  test('bounds diagnostic collections while tracking omitted events', () => {
    const collection = createBoundedDiagnosticCollection();
    for (let index = 0; index < 25; index += 1) {
      recordBoundedDiagnostic(collection, `event ${index}`);
    }

    expect(collection.values).toHaveLength(20);
    expect(collection.omitted).toBe(5);
    expect(boundedDiagnosticSnapshot(collection)).toEqual({
      omitted: 5,
      values: Array.from({ length: 20 }, (_, index) => `event ${index}`),
    });
  });

  test('formats a 100-event collection as the first two events plus the true omitted count', () => {
    const collection = createBoundedDiagnosticCollection();
    for (let index = 0; index < 100; index += 1) {
      recordBoundedDiagnostic(collection, `event ${index}`);
    }

    const message = formatSvelteKitHydrationRouteFailure({
      cause: new Error('locator wait timed out'),
      label: 'fixture',
      routePath: '/dev-ssr-tabs',
      snapshot: {
        ...snapshot,
        runtimeErrors: boundedDiagnosticSnapshot(collection),
      },
    });

    expect(message).toContain('  - event 0');
    expect(message).toContain('  - event 1');
    expect(message).toContain('98 additional item(s) omitted');
    expect(message).not.toContain('event 2');
    expect(boundedDiagnosticSnapshot(collection).values).not.toContain(
      '... (80 additional collected item(s) omitted)',
    );
  });

  test('captures only immediate diagnostics without evaluating the page', () => {
    const evaluate = mock(() => {
      throw new Error('evaluate should not be called');
    });
    const page = {
      evaluate,
      url: () => 'http://127.0.0.1:4173/dev-ssr-tabs',
    };

    const captured = captureSvelteKitHydrationRouteFailureSnapshot(page, {
      browserEvents: ['browser:connected'],
      domObservation: {
        documentReadyState: 'complete',
        hydrationMarkerPresent: true,
        hydrationMarkerValue: 'true',
      },
      errors: diagnosticSnapshotFromValues(['runtime error']),
      nonOkResponses: diagnosticSnapshotFromValues(['500 http://fixture.test/api']),
      requestFailures: diagnosticSnapshotFromValues(['request failed']),
      routePath: '/dev-ssr-tabs',
    });

    expect(evaluate).not.toHaveBeenCalled();
    expect(captured.currentUrl).toBe('http://127.0.0.1:4173/dev-ssr-tabs');
    expect(captured.documentReadyState).toBe('complete');
    expect(captured.hydrationMarkerPresent).toBe(true);
    expect(captured.hydrationMarkerValue).toBe('true');
    expect(captured.runtimeErrors.values).toEqual(['runtime error']);
  });

  test('wraps route failures with route, network, runtime, and DOM state', () => {
    const cause = new Error('locator wait timed out');
    const error = wrapSvelteKitHydrationRouteFailure({
      cause,
      label: 'fixture',
      routePath: '/dev-ssr-tabs',
      snapshot,
    });

    expect(error.cause).toBe(cause);
    expect(error.message).toContain('sveltekit-consumer fixture /dev-ssr-tabs');
    expect(error.message).toContain('currentUrl: http://127.0.0.1:4173/dev-ssr-tabs');
    expect(error.message).toContain('documentReadyState: interactive');
    expect(error.message).toContain(
      'hydrationMarker: selector=[data-dev-ssr-hydrated] present=true value=false',
    );
    expect(error.message).toContain('500 http://127.0.0.1:4173/api/bootstrap');
    expect(error.message).toContain('net::ERR_FAILED');
    expect(error.message).toContain('hydration_mismatch');
  });

  test('bounds repeated diagnostic output', () => {
    const message = formatSvelteKitHydrationRouteFailure({
      cause: new Error('locator wait timed out'),
      label: 'fixture',
      routePath: '/dev-ssr-tabs',
      snapshot: {
        ...snapshot,
        nonOkResponses: diagnosticSnapshotFromValues(
          Array.from(
            { length: 20 },
            (_, index) => `500 http://fixture.test/network-error-${index}-${'n'.repeat(800)}`,
          ),
        ),
        requestFailures: diagnosticSnapshotFromValues(
          Array.from({ length: 20 }, (_, index) => `request failure ${index} ${'r'.repeat(800)}`),
        ),
        runtimeErrors: diagnosticSnapshotFromValues(
          Array.from({ length: 20 }, (_, index) => `runtime error ${index} ${'x'.repeat(800)}`),
        ),
        browserEvents: diagnosticSnapshotFromValues(
          Array.from({ length: 20 }, (_, index) => `browser event ${index} ${'b'.repeat(800)}`),
        ),
      },
    });

    expect(message.length).toBeLessThanOrEqual(6_000);
    expect(message).toContain('item(s) omitted');
    expect(message).toContain('char(s) omitted');
    expect(message).toContain('HTTP error responses');
    expect(message).toContain('request failures');
    expect(message).toContain('page and console errors');
    expect(message).toContain('browser events');
  });

  test('caps the cause without starving structured diagnostic categories', () => {
    const message = formatSvelteKitHydrationRouteFailure({
      cause: new Error('c'.repeat(10_000)),
      label: 'fixture',
      routePath: '/dev-ssr-tabs',
      snapshot,
    });

    expect(message.length).toBeLessThanOrEqual(6_000);
    expect(message).toContain('char(s) omitted');
    expect(message).toContain('HTTP error responses');
    expect(message).toContain('request failures');
    expect(message).toContain('page and console errors');
    expect(message).toContain('browser events');
  });

  test('caps diagnostic-capture errors without starving structured categories', () => {
    const message = formatSvelteKitHydrationRouteFailure({
      cause: new Error('locator wait timed out'),
      label: 'fixture',
      routePath: '/dev-ssr-tabs',
      snapshot: { ...snapshot, diagnosticCaptureError: 'd'.repeat(10_000) },
    });

    expect(message.length).toBeLessThanOrEqual(6_000);
    expect(message).toContain('char(s) omitted');
    expect(message).toContain('HTTP error responses');
    expect(message).toContain('request failures');
    expect(message).toContain('page and console errors');
    expect(message).toContain('browser events');
  });

  test('classifies browser crashes from the original cause instead of diagnostics', () => {
    const contentFailure = wrapSvelteKitHydrationRouteFailure({
      cause: new Error('locator wait timed out'),
      label: 'fixture',
      routePath: '/dev-ssr-tabs',
      snapshot: {
        ...snapshot,
        runtimeErrors: diagnosticSnapshotFromValues(['application worker crashed']),
      },
    });
    const browserCrash = wrapSvelteKitHydrationRouteFailure({
      cause: new Error('Target closed'),
      label: 'fixture',
      routePath: '/dev-ssr-tabs',
      snapshot,
    });

    expect(isBrowserCrashError(contentFailure)).toBe(false);
    expect(isBrowserCrashError(browserCrash)).toBe(true);
  });

  test('classifies a browser crash found before a deeper original cause', () => {
    const browserCrash = wrapSvelteKitHydrationRouteFailure({
      cause: new Error('Target closed', { cause: new Error('socket closed') }),
      label: 'fixture',
      routePath: '/dev-ssr-tabs',
      snapshot,
    });

    expect(isBrowserCrashError(browserCrash)).toBe(true);
  });
});

describe('development server teardown', () => {
  test('does not signal a process group that is already gone', async () => {
    let signalCount = 0;
    await stopDevelopmentServer(
      { exitCode: 0, exited: Promise.resolve(0), pid: 4_242 },
      1,
      () => {
        signalCount += 1;
      },
      () => false,
    );

    expect(signalCount).toBe(0);
  });

  test('signals a live process group after its leader already exited', async () => {
    const signals: NodeJS.Signals[] = [];
    let processGroupAlive = true;

    await stopDevelopmentServer(
      { exitCode: 0, exited: Promise.resolve(0), pid: 4_242 },
      1,
      (_pid, signal) => {
        signals.push(signal);
        processGroupAlive = false;
      },
      () => processGroupAlive,
    );

    expect(signals).toEqual(['SIGTERM']);
  });

  test('escalates to SIGKILL when graceful termination never settles', async () => {
    const signals: NodeJS.Signals[] = [];
    let resolveExit!: (exitCode: number) => void;
    const exited = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });
    const server = {
      exitCode: null as number | null,
      exited,
      pid: 4_242,
    };
    const signalProcessGroup = (pid: number, signal: NodeJS.Signals) => {
      expect(pid).toBe(-4_242);
      signals.push(signal);
      if (signal === 'SIGKILL') {
        server.exitCode = 137;
        resolveExit(137);
      }
    };

    await stopDevelopmentServer(server, 1, signalProcessGroup, () => server.exitCode === null);

    expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(server.exitCode).toBe(137);
  });

  test('fails after a bounded hard termination when the process group survives', async () => {
    const signals: NodeJS.Signals[] = [];
    const server = {
      exitCode: null,
      exited: new Promise<number>(() => {}),
      pid: 4_242,
    };

    await expect(
      stopDevelopmentServer(
        server,
        1,
        (_pid, signal) => {
          signals.push(signal);
        },
        () => true,
      ),
    ).rejects.toThrow('still running after SIGKILL');

    expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
  });
});

describe('hydration teardown', () => {
  test('forces later resources closed when page close never settles', async () => {
    const calls: string[] = [];
    const failures = await runBoundedHydrationTeardown(
      [
        {
          phase: 'page.close',
          close: () => {
            calls.push('page.close');
            return new Promise<void>(() => {});
          },
          state: () => 'pageClosed=false',
        },
        {
          phase: 'browser.close',
          close: async () => {
            calls.push('browser.close');
          },
          state: () => 'browserConnected=false',
        },
        {
          phase: 'fixture-server.exited',
          close: async () => {
            calls.push('fixture-server.exited');
          },
          state: () => 'fixtureServerExitCode=0',
        },
      ],
      1,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]?.phase).toBe('page.close');
    expect(failures[0]?.state).toBe('pageClosed=false');
    expect(calls).toEqual(['page.close', 'browser.close', 'fixture-server.exited']);
  });

  test('continues after a force-close path also times out', async () => {
    const calls: string[] = [];
    const failures = await runBoundedHydrationTeardown(
      [
        {
          phase: 'browser.close',
          close: () => new Promise<void>(() => {}),
          forceClose: () => new Promise<void>(() => {}),
          state: () => 'browserConnected=true',
        },
        {
          phase: 'fixture-server.exited',
          close: async () => {
            calls.push('fixture-server.exited');
          },
          state: () => 'fixtureServerExitCode=0',
        },
      ],
      1,
    );

    expect(failures).toHaveLength(2);
    expect(failures[0]?.phase).toBe('browser.close');
    expect(failures[1]?.phase).toBe('browser.close.force');
    expect(calls).toEqual(['fixture-server.exited']);
  });
});

/**
 * Reproduces the #900 recurrence: `/subpath`'s `page.close()` is issued and
 * never settles, and the sequence must decide the run on whether Chromium was
 * ultimately reclaimed — not on whether that one call came back.
 *
 * `closeCount` proves each cleanup method is invoked exactly once and never
 * retried; the "never settles" case is a promise that is simply never resolved,
 * so no timer or sleep is involved.
 */
async function runAbandonedPageTeardown(browserIsGone: () => boolean) {
  const closeCount = { browser: 0, context: 0, page: 0 };
  const order: string[] = [];

  const failures = await runBoundedHydrationTeardown(
    [
      {
        phase: 'page.close route=/subpath',
        close: () => {
          closeCount.page += 1;
          order.push('page.close');
          return new Promise<void>(() => {});
        },
        state: () => 'pageClosed=false browserConnected=true',
        reclaimed: browserIsGone,
      },
      {
        phase: 'context.close',
        close: async () => {
          closeCount.context += 1;
          order.push('context.close');
        },
        state: () => 'contextPages=0',
        reclaimed: browserIsGone,
      },
      {
        phase: 'browser.close',
        close: async () => {
          closeCount.browser += 1;
          order.push('browser.close');
        },
        state: () => 'browserConnected=false processRunning=false',
        reclaimed: browserIsGone,
      },
    ],
    1,
  );

  return { closeCount, failures, order };
}

describe('hydration teardown reclamation verdict', () => {
  test('still closes context and browser after a page close that never settles', async () => {
    const { closeCount, order } = await runAbandonedPageTeardown(() => true);

    expect(order).toEqual(['page.close', 'context.close', 'browser.close']);
    expect(closeCount).toEqual({ browser: 1, context: 1, page: 1 });
  });

  test('treats an abandoned page close as clean once Chromium is gone', async () => {
    const { closeCount, failures } = await runAbandonedPageTeardown(() => true);

    // The close call failed, but the resource it owned was reclaimed by the
    // wider close — so the gate stays green and the same commit stops
    // alternating red/green on runner contention.
    expect(failures).toHaveLength(1);
    expect(unreclaimedTeardownFailures(failures)).toEqual([]);

    // Taking the verdict must not re-drive any cleanup.
    expect(closeCount).toEqual({ browser: 1, context: 1, page: 1 });
  });

  test('reports the exact failing phase when Chromium really survives', async () => {
    const { failures } = await runAbandonedPageTeardown(() => false);
    const unreclaimed = unreclaimedTeardownFailures(failures);

    expect(unreclaimed).toHaveLength(1);
    expect(unreclaimed[0]?.phase).toBe('page.close route=/subpath');
    expect(unreclaimed[0]?.state).toBe('pageClosed=false browserConnected=true');
  });

  test('treats an unobservable reclamation signal as unproven rather than clean', async () => {
    const failures = await runBoundedHydrationTeardown(
      [
        {
          phase: 'browser.close',
          close: () => Promise.reject(new Error('closing Chromium failed')),
          state: () => 'browserConnected=true processRunning=unknown',
          reclaimed: () => 'unavailable',
        },
      ],
      1,
    );

    expect(unreclaimedTeardownFailures(failures)).toHaveLength(1);
  });

  test('never subsumes a resource nothing wider can reclaim', async () => {
    const failures = await runBoundedHydrationTeardown(
      [
        {
          phase: 'fixture-server.exited',
          close: () => Promise.reject(new Error('fixture server did not exit')),
          state: () => 'fixtureServerExitCode=running',
        },
      ],
      1,
    );

    // No `reclaimed` signal: the fixture server sits outside the browser
    // containment chain, so its failure always counts.
    expect(unreclaimedTeardownFailures(failures)).toHaveLength(1);
  });

  test('refuses to read an unreadable process table as a reclaimed browser', () => {
    // `[]` means "provably gone" and subsumes earlier teardown failures, so a
    // failed `ps` must never produce it — that would turn the gate permanently
    // green, which is strictly worse than the flake this fixes.
    expect(() =>
      parseHydrationBrowserProcessIds(
        { exitCode: 1, stdout: '', stderr: 'ps: permission denied' },
        'cinder-hydration-abc',
        10,
      ),
    ).toThrow('ps failed');

    expect(
      parseHydrationBrowserProcessIds(
        { exitCode: 0, stdout: '', stderr: '' },
        'cinder-hydration-abc',
        10,
      ),
    ).toEqual([]);
  });

  test('finds the launch token deep inside a full-length Chromium argv', () => {
    const token = 'cinder-hydration-abc';
    // Playwright appends our flag ~1.7 KB into Chromium's ~1.9 KB argv, so the
    // listing must be read untruncated (`ps -ww`). A truncated line drops the
    // token, reports "no process", and lets the reclamation verdict read a
    // leaked browser as reclaimed — the gate would fail open.
    const argv = `/path/chrome-headless-shell ${'--disable-some-feature '.repeat(75)}--cinder-hydration-token=${token} --headless`;

    expect(argv.length).toBeGreaterThan(1_500);
    expect(argv.indexOf(token)).toBeGreaterThan(80);
    expect(
      parseHydrationBrowserProcessIds(
        { exitCode: 0, stdout: `  4242 ${argv}`, stderr: '' },
        token,
        10,
      ),
    ).toEqual([4242]);

    // A default-width truncated line incorrectly looks clean because it hides
    // the token; the wide process listing is what prevents that false verdict.
    expect(
      parseHydrationBrowserProcessIds(
        { exitCode: 0, stdout: `  4242 ${argv.slice(0, 80)}`, stderr: '' },
        token,
        10,
      ),
    ).toEqual([]);
  });

  test('matches only this run’s launch token and never its own pid', () => {
    const token = 'cinder-hydration-abc';
    const stdout = [
      `  4242 /path/chrome-headless-shell --cinder-hydration-token=${token} --headless`,
      `    10 bun validate-consumers.ts --cinder-hydration-token=${token}`,
      '  5150 /path/chrome-headless-shell --cinder-hydration-token=cinder-hydration-other',
    ].join('\n');

    expect(parseHydrationBrowserProcessIds({ exitCode: 0, stdout, stderr: '' }, token, 10)).toEqual(
      [4242],
    );
  });
});

describe('examples consumer readiness', () => {
  test('polls a static build asset instead of repeatedly rendering every example', () => {
    expect(EXAMPLES_CONSUMER_READINESS_PATH).toBe('/_app/version.json');
    expect(EXAMPLES_CONSUMER_READINESS_PATH).not.toBe('/');
  });
});

describe('Chat peer-compatible Cinder fixture artifact', () => {
  test('uses the exact publish artifact once Cinder satisfies the Chat peer', () => {
    expect(
      resolveChatFixtureCinderVersion({
        currentVersion: '0.16.0',
        peerRange: '^0.16.0',
        pendingReleaseType: 'minor',
      }),
    ).toEqual({ version: '0.16.0', requiresValidationOnlyRepack: false });
  });

  test('stages only the pending minor version before the Version Packages pull request', () => {
    expect(
      resolveChatFixtureCinderVersion({
        currentVersion: '0.15.0',
        peerRange: '^0.16.0',
        pendingReleaseType: 'minor',
      }),
    ).toEqual({ version: '0.16.0', requiresValidationOnlyRepack: true });
  });

  test('keeps the canonical tarball filename below a fixture-only directory', () => {
    const packageRoot = '/workspace/packages/components';
    const identity = {
      name: '@lostgradient/cinder',
      version: '0.16.0',
    };
    const validationPath = chatPeerValidationTarballPath(packageRoot, identity);
    const publishPath = join(packageRoot, getPackFileName(identity));

    expect(validationPath).toBe(
      '/workspace/packages/components/tmp/chat-peer-validation/lostgradient-cinder-0.16.0.tgz',
    );
    expect(packageTarballPath(packageRoot, identity)).toBe(publishPath);
    expect(validationPath).not.toBe(publishPath);
  });

  test('rejects an incompatible pair without an exact pending changeset bridge', () => {
    expect(() =>
      resolveChatFixtureCinderVersion({
        currentVersion: '0.15.0',
        peerRange: '^0.16.0',
      }),
    ).toThrow('no pending Cinder changeset');
    expect(() =>
      resolveChatFixtureCinderVersion({
        currentVersion: '0.15.0',
        peerRange: '^0.16.0',
        pendingReleaseType: 'patch',
      }),
    ).toThrow('pending Cinder 0.15.1 does not satisfy');
  });

  test('applies plain semantic-version bumps deterministically', () => {
    expect(bumpPackageVersion('0.15.0', 'patch')).toBe('0.15.1');
    expect(bumpPackageVersion('0.15.0', 'minor')).toBe('0.16.0');
    expect(bumpPackageVersion('0.15.0', 'major')).toBe('1.0.0');
  });
});
