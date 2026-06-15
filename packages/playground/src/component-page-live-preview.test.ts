/// <reference lib="dom" />
/**
 * Regression tests for the Playground-section LIVE preview in
 * `component-page.svelte` (#405).
 *
 * The Playground section used to mount the static featured *example* and label
 * it "Featured example", because only the snippet was prop-driven. #405 mounts
 * the BARE component directly with the synthesized `playgroundValues`, so the
 * preview re-renders as the controls change — a genuine "Live preview". The
 * load-bearing invariants this locks:
 *
 *   1. Each `playgroundValues` change re-mounts the bare component with the NEW
 *      values (the attachment reads `playgroundValues` inside its body, so
 *      Svelte tears down and remounts on change).
 *   2. Props arrive as a plain object (`$state.snapshot`), never the reactive
 *      `$state` proxy — that's what a real consumer would receive.
 *   3. When the bare component can't be resolved, the section falls back to the
 *      static featured-example mount (#374 behaviour preserved).
 *   4. Under `?snapshot=1` NEITHER mount renders — the snapshot-mode contract
 *      forbids stray live mounts that would break the browser-test selector
 *      counts and axe surface.
 *   5. Mount errors are keyed by container DOM id, mirroring `mountScenario`.
 *
 * Mounting the full `component-page.svelte` is impractical (it reads
 * `window.location`, the server-injected globals, and deep cinder imports), so
 * these tests drive `component-page-live-preview-fixture.svelte`, which copies
 * the `mountLivePreview` attachment and its gating branch verbatim — exactly
 * the pattern `component-page.test.ts` uses for the example mounts.
 *
 * Harness setup mirrors `component-page.test.ts`: happy-dom is installed onto
 * `globalThis` before `@testing-library/svelte` loads.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../components/src/test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Fixture } = await import('./component-page-live-preview-fixture.svelte');
const probeModule = (await import('./component-page-live-probe.svelte')) as unknown as {
  default: unknown;
  lastProps: () => Record<string, unknown> | undefined;
  mountCount: () => number;
  unmountCount: () => number;
  lastPropsWerePlainObject: () => boolean;
  resetLiveProbe: () => void;
};
const {
  default: LiveProbe,
  lastProps,
  mountCount,
  unmountCount,
  lastPropsWerePlainObject,
  resetLiveProbe,
} = probeModule;
const { default: FeaturedProbe } = (await import('./component-page-scenario-probe.svelte')) as {
  default: unknown;
};
const { tick } = await import('svelte');

/** Count rendered live-mount probes in the document. */
function liveProbeCount(): number {
  return document.querySelectorAll('.live-probe').length;
}

beforeEach(() => {
  resetLiveProbe();
});

afterEach(() => {
  resetLiveProbe();
  document.body.innerHTML = '';
});

describe('component-page live preview (#405)', () => {
  test('mounts the bare component once with the seeded prop values', async () => {
    const { unmount } = render(Fixture, {
      bareComponent: LiveProbe,
      initialValues: { label: 'Save', disabled: false },
    });
    await tick();

    expect(liveProbeCount()).toBe(1);
    expect(mountCount()).toBe(1);
    expect(lastProps()).toEqual({ label: 'Save', disabled: false });
    // The "Live preview" label — not "Featured example" — is what shows.
    expect(document.querySelector('.dx-stage__label')?.textContent).toBe('Live preview');

    unmount();
  });

  test('re-mounts with the new value when a control changes', async () => {
    const { component, unmount } = render(Fixture, {
      bareComponent: LiveProbe,
      initialValues: { label: 'Save' },
    });
    await tick();
    expect(lastProps()).toEqual({ label: 'Save' });
    const mountsAfterFirst = mountCount();

    // Flip a control by MUTATING a key — exactly what the real prop panel does
    // (`playgroundValues[name] = next`), not by reassigning the whole object.
    // `$state.snapshot` deep-reads the proxy, so the key mutation is what
    // re-runs the live-mount attachment.
    (component as unknown as { setValue: (name: string, value: unknown) => void }).setValue(
      'label',
      'Delete',
    );
    await tick();

    // A fresh mount carried the new value; the stale instance was torn down, so
    // there is still exactly one live probe in the document.
    expect(mountCount()).toBeGreaterThan(mountsAfterFirst);
    expect(lastProps()).toEqual({ label: 'Delete' });
    expect(liveProbeCount()).toBe(1);
    // Mounts and unmounts stay balanced: every prior instance was torn down
    // before the next mounted, so the live count never overlaps. With the
    // instance still on screen, unmounts trail mounts by exactly one.
    expect(unmountCount()).toBe(mountCount() - 1);

    unmount();
  });

  test('passes a plain object, not the reactive $state proxy', async () => {
    const { unmount } = render(Fixture, {
      bareComponent: LiveProbe,
      initialValues: { label: 'Save', count: 3 },
    });
    await tick();

    expect(lastPropsWerePlainObject()).toBe(true);

    unmount();
  });

  test('falls back to the featured example when the bare component is undefined', async () => {
    const { unmount } = render(Fixture, {
      bareComponent: undefined,
      featuredExample: FeaturedProbe,
      featuredScenario: 'demo',
      initialValues: { label: 'Save' },
    });
    await tick();

    // No live mount; the static featured example renders instead.
    expect(liveProbeCount()).toBe(0);
    expect(mountCount()).toBe(0);
    expect(document.querySelector('.scenario-probe')).not.toBeNull();
    expect(document.getElementById('playground-mount-demo')).not.toBeNull();
    expect(document.querySelector('.dx-stage__label')?.textContent).toBe('Featured example');

    unmount();
  });

  test('renders NEITHER mount under ?snapshot=1', async () => {
    const { unmount } = render(Fixture, {
      bareComponent: LiveProbe,
      featuredExample: FeaturedProbe,
      featuredScenario: 'demo',
      snapshotMode: true,
      initialValues: { label: 'Save' },
    });
    await tick();

    expect(liveProbeCount()).toBe(0);
    expect(mountCount()).toBe(0);
    expect(document.querySelector('.scenario-probe')).toBeNull();
    expect(document.querySelector('.dx-stage__label')).toBeNull();

    unmount();
  });

  test('tears down the live mount on unmount — no orphaned probe', async () => {
    const { unmount } = render(Fixture, {
      bareComponent: LiveProbe,
      initialValues: { label: 'Save' },
    });
    await tick();
    expect(liveProbeCount()).toBe(1);

    unmount();
    await tick();

    expect(liveProbeCount()).toBe(0);
  });

  test('keys a mount failure by the live container id', async () => {
    // A component whose constructor throws stands in for a real mount failure.
    const Throwing = function ThrowingComponent() {
      throw new Error('boom');
    };
    const mountErrors: Record<string, string | undefined> = {};
    const { unmount } = render(Fixture, {
      bareComponent: Throwing,
      initialValues: { label: 'Save' },
      mountErrors,
    });
    await tick();

    expect(mountErrors['playground-live-mount']).toContain('boom');
    expect(liveProbeCount()).toBe(0);

    unmount();
  });
});
