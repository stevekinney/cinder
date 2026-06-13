/// <reference lib="dom" />
/**
 * Regression tests for the example-mount `$effect` in `component-page.svelte`.
 *
 * The original effect deferred each mount into a `queueMicrotask` callback that
 * pushed into a per-run `localApps` array. When the effect re-ran, the previous
 * run's cleanup fired before its queued microtasks, so those microtasks mounted
 * into (and were tracked by) a collection that nothing would ever clean up —
 * orphaning Svelte trees and accumulating duplicate mounts across re-runs. The
 * fix mounts synchronously in the effect body (the container exists post
 * DOM-patch in Svelte 5), so cleanup and mount share the same `localApps` ref.
 *
 * Mounting the full `component-page.svelte` is impractical: it reads
 * `window.location.pathname`, the server-injected `__CINDER_EXAMPLES__` /
 * `__CINDER_SCENARIOS__` globals, and several deep-imported cinder components,
 * none of which the race depends on. These tests instead drive a fixture that
 * reproduces the effect verbatim (see `component-page-mount-fixture.svelte`)
 * and assert the load-bearing invariant: mount/unmount count parity, no
 * orphaned trees, and no duplicate scenario containers across rapid re-runs.
 *
 * Harness setup mirrors `shell-app/event-source.test.ts`: happy-dom is
 * installed onto `globalThis` before `@testing-library/svelte` loads.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../components/src/test/happy-dom.ts';

// Install happy-dom globals via the shared, idempotent helper BEFORE
// dynamic-importing @testing-library/svelte. Using the single shared window
// (rather than a private `new Window()`) keeps this file's globals consistent
// with the bunfig preload and the other shell-app DOM tests; a competing window
// install replaces globalThis.document with a second happy-dom document, which
// in a full-suite run corrupts the Svelte runtime/module state that
// `server.test.ts`'s `Bun.build` relies on.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Driver } = await import('./component-page-mount-driver.svelte');
const { default: MountErrorFixture } = await import('./component-page-mount-error-fixture.svelte');
// The probe's `<script module>` exports ledger helpers alongside the default
// component, but the ambient `*.svelte` module type only surfaces `default`.
// Cast to the known shape — test files may assert types they know hold.
const probeModule = (await import('./component-page-scenario-probe.svelte')) as unknown as {
  default: unknown;
  ledgerFor: (scenario: string) => { mounts: number; unmounts: number; live: number };
  totalLive: () => number;
  resetLedgers: () => void;
};
const { default: Probe, ledgerFor, totalLive, resetLedgers } = probeModule;
const { tick } = await import('svelte');

/** Build a `__CINDER_SCENARIOS__`-style registry mapping each id to the probe. */
function registryFor(scenarios: string[]): Record<string, unknown> {
  const registry: Record<string, unknown> = {};
  for (const scenario of scenarios) registry[scenario] = Probe;
  return registry;
}

/** Count rendered `example-mount-*` containers in the document. */
function containerCount(): number {
  return document.querySelectorAll('[id^="example-mount-"]').length;
}

/** Count mounted probe markers in the document. */
function probeMarkerCount(): number {
  return document.querySelectorAll('.scenario-probe').length;
}

beforeEach(() => {
  resetLedgers();
});

afterEach(() => {
  resetLedgers();
  document.body.innerHTML = '';
});

describe('component-page example-mount effect', () => {
  test('mounts exactly one probe per scenario into its container', async () => {
    const scenarios = ['alpha', 'beta', 'gamma'];
    const { unmount } = render(Driver, { scenarios, registry: registryFor(scenarios) });
    await tick();

    expect(containerCount()).toBe(scenarios.length);
    expect(probeMarkerCount()).toBe(scenarios.length);
    for (const scenario of scenarios) {
      expect(ledgerFor(scenario).mounts).toBe(1);
      expect(ledgerFor(scenario).live).toBe(1);
      // Each probe lands in its own scenario container.
      const container = document.getElementById(`example-mount-${scenario}`);
      expect(container?.querySelectorAll('.scenario-probe').length).toBe(1);
    }

    unmount();
  });

  test('unmounts every probe on teardown — no orphaned trees', async () => {
    const scenarios = ['alpha', 'beta'];
    const { unmount } = render(Driver, { scenarios, registry: registryFor(scenarios) });
    await tick();
    expect(totalLive()).toBe(scenarios.length);

    unmount();
    await tick();

    expect(totalLive()).toBe(0);
    expect(probeMarkerCount()).toBe(0);
    for (const scenario of scenarios) {
      const ledger = ledgerFor(scenario);
      expect(ledger.mounts).toBe(ledger.unmounts);
    }
  });

  test('rapid effect re-runs keep mount/unmount parity and never orphan trees', async () => {
    const scenarios = ['alpha', 'beta', 'gamma'];
    const { component, unmount } = render(Driver, {
      scenarios,
      registry: registryFor(scenarios),
    });
    await tick();
    expect(totalLive()).toBe(scenarios.length);

    // Hammer the effect: many re-runs, some without an intervening flush.
    // This is exactly the timing that orphaned trees under the old
    // queueMicrotask deferral.
    const reRuns = 8;
    for (let index = 0; index < reRuns; index += 1) {
      component['bump']();
      // Flush only on alternate iterations to interleave re-runs.
      if (index % 2 === 0) await tick();
    }
    await tick();

    // After every re-run, exactly one live tree per scenario remains — no
    // accumulation, no orphans.
    expect(totalLive()).toBe(scenarios.length);
    expect(probeMarkerCount()).toBe(scenarios.length);
    expect(containerCount()).toBe(scenarios.length);
    for (const scenario of scenarios) {
      const container = document.getElementById(`example-mount-${scenario}`);
      // No duplicate probes stacked into a single container.
      expect(container?.querySelectorAll('.scenario-probe').length).toBe(1);
      const ledger = ledgerFor(scenario);
      // Every mount across the re-runs was matched by an unmount, except the
      // single currently-live tree.
      expect(ledger.mounts - ledger.unmounts).toBe(1);
    }

    unmount();
    await tick();

    expect(totalLive()).toBe(0);
    expect(probeMarkerCount()).toBe(0);
    for (const scenario of scenarios) {
      const ledger = ledgerFor(scenario);
      expect(ledger.mounts).toBe(ledger.unmounts);
    }
  });

  test('renders a visible heading (not an empty container) when there are no scenarios', async () => {
    // A component with no `*.example.svelte` files reaches snapshot mode with an
    // empty examples list. The old block rendered only `{#each examples}`, so the
    // snapshot container had zero children and zero height — and the
    // visual-regression harness's `waitForSelector('#app > *', {state:'visible'})`
    // (visible = non-zero box) timed out after 20s for every such component. The
    // empty branch must paint a non-empty child instead.
    const { unmount } = render(Driver, {
      scenarios: [],
      registry: {},
      emptyHeading: 'Banner',
    });
    await tick();

    // No mount containers and no probes — there is nothing to mount.
    expect(containerCount()).toBe(0);
    expect(probeMarkerCount()).toBe(0);

    // But the container is NOT empty: a single visible heading stands in.
    const heading = document.querySelector('.snapshot-empty-heading');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('Banner');
    // The heading is the snapshot container's sole child, so the container has
    // content to give it a non-zero box under the visual-regression harness.
    expect(document.querySelector('.example-list')?.children.length).toBe(1);

    unmount();
  });

  test('skips scenarios with no registered component without crashing', async () => {
    const scenarios = ['alpha', 'missing'];
    const registry = registryFor(scenarios);
    delete registry['missing'];

    const { unmount } = render(Driver, { scenarios, registry });
    await tick();

    // Both containers render; only the registered scenario mounts a probe.
    expect(containerCount()).toBe(2);
    expect(probeMarkerCount()).toBe(1);
    expect(ledgerFor('alpha').live).toBe(1);
    expect(ledgerFor('missing').mounts).toBe(0);

    unmount();
    await tick();
    expect(totalLive()).toBe(0);
  });
});

describe('component-page mount-error keying (overview vs example)', () => {
  // The featured scenario can mount in two locations — the Overview live
  // preview (`overview-mount-<scenario>`) and the Examples list
  // (`example-mount-<scenario>`). Cursor Bugbot flagged that keying the shared
  // `mountErrors` record by bare scenario lets whichever attachment runs last
  // clobber the other's entry, so a failure in one mount can hide the error in
  // the other or show an error callout over a preview that actually rendered.
  // The fix keys the record by container DOM id; these tests lock that.

  test('a failure in the overview mount does not leak into the example slot', async () => {
    const scenario = 'demo';
    const mountErrors: Record<string, string | undefined> = {};
    const { unmount } = render(MountErrorFixture, {
      scenario,
      registry: registryFor([scenario]),
      failingPrefixes: ['overview-mount'],
      mountErrors,
    });
    await tick();

    // The overview container carries an error keyed to ITS id; the example
    // container, which mounted successfully, is explicitly error-free.
    expect(mountErrors[`overview-mount-${scenario}`]).toContain('overview-mount');
    expect(mountErrors[`example-mount-${scenario}`]).toBeUndefined();

    // The example instance actually rendered its probe; the overview did not.
    expect(
      document.getElementById(`example-mount-${scenario}`)?.querySelector('.scenario-probe'),
    ).not.toBeNull();
    expect(
      document.getElementById(`overview-mount-${scenario}`)?.querySelector('.scenario-probe'),
    ).toBeNull();

    unmount();
  });

  test('a failure in the example mount does not leak into the overview slot', async () => {
    const scenario = 'demo';
    const mountErrors: Record<string, string | undefined> = {};
    const { unmount } = render(MountErrorFixture, {
      scenario,
      registry: registryFor([scenario]),
      failingPrefixes: ['example-mount'],
      mountErrors,
    });
    await tick();

    expect(mountErrors[`example-mount-${scenario}`]).toContain('example-mount');
    expect(mountErrors[`overview-mount-${scenario}`]).toBeUndefined();

    expect(
      document.getElementById(`overview-mount-${scenario}`)?.querySelector('.scenario-probe'),
    ).not.toBeNull();
    expect(
      document.getElementById(`example-mount-${scenario}`)?.querySelector('.scenario-probe'),
    ).toBeNull();

    unmount();
  });

  test('both mounts succeeding leaves both location slots error-free', async () => {
    const scenario = 'demo';
    const mountErrors: Record<string, string | undefined> = {};
    const { unmount } = render(MountErrorFixture, {
      scenario,
      registry: registryFor([scenario]),
      failingPrefixes: [],
      mountErrors,
    });
    await tick();

    expect(mountErrors[`overview-mount-${scenario}`]).toBeUndefined();
    expect(mountErrors[`example-mount-${scenario}`]).toBeUndefined();
    // Both locations rendered their own probe — independent mounts, not a
    // single shared one.
    expect(document.querySelectorAll('.scenario-probe').length).toBe(2);

    unmount();
  });
});
