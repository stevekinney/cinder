import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { getPackFileName } from './publish-release.ts';
import { packageTarballPath } from './report-package-weight.ts';
import {
  bumpPackageVersion,
  chatPeerValidationTarballPath,
  EXAMPLES_CONSUMER_READINESS_PATH,
  resolveChatFixtureCinderVersion,
  runBoundedHydrationTeardown,
  unreclaimedTeardownFailures,
} from './validate-consumers.ts';

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
