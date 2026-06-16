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
 *   1. The bare component is resolved from its module namespace by the documented
 *      export name, falling back to the default export.
 *   2. Each `playgroundValues` change re-mounts the bare component with the NEW
 *      values (the attachment reads `playgroundValues` inside its body, so
 *      Svelte tears down and remounts on change).
 *   3. Props arrive as a plain object (`$state.snapshot`), never the reactive
 *      `$state` proxy — that's what a real consumer would receive.
 *   4. When the bare component can't be resolved, or its live mount FAILS while a
 *      featured example exists, the section falls back to the static
 *      featured-example mount (#374 behaviour preserved; no error callout over a
 *      preview that would otherwise work).
 *   5. Under `?snapshot=1` NEITHER mount renders — the snapshot-mode contract
 *      forbids stray live mounts that would break the browser-test selector
 *      counts and axe surface.
 *   6. Mount errors are keyed by container DOM id, mirroring `mountScenario`, and
 *      clear once a later mount succeeds.
 *
 * The tests drive `component-page-live-preview-fixture.svelte`, a thin HOST that
 * imports the SAME `createLivePreviewMount` / `resolveBareComponent` the page
 * uses — so a passing test exercises production logic, not a copy of it. Mounting
 * the full `component-page.svelte` is impractical (it reads `window.location`,
 * the server-injected globals, and fetches documentation over HTTP).
 *
 * Harness setup mirrors `component-page.test.ts`: happy-dom is installed onto
 * `globalThis` before `@testing-library/svelte` loads.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../components/src/test/happy-dom.ts';
import {
  createLivePreviewMount,
  LIVE_MOUNT_CONTAINER_ID,
  type MountErrorRecord,
} from './component-page-live-preview.ts';

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

/** Wrap a component as a single-export module namespace, as the page bundle hands it over. */
function asNamedModule(component: unknown, exportName = 'Demo'): Record<string, unknown> {
  return { [exportName]: component };
}

/**
 * The fixture instance exposes `setValue` as a `module`-script export; `render`
 * returns it typed as `unknown`. Name the cast once here rather than repeating the
 * same structural assertion at every call site.
 */
function fixtureComponent(instance: unknown): { setValue: (name: string, value: unknown) => void } {
  // `instance` is already `unknown`, so a single assertion to the call shape is
  // the idiomatic narrowing here — no `as unknown as` double-cast needed.
  return instance as { setValue: (name: string, value: unknown) => void };
}

beforeEach(() => {
  resetLiveProbe();
});

afterEach(() => {
  resetLiveProbe();
  document.body.innerHTML = '';
});

describe('component-page live preview (#405)', () => {
  test('resolves the bare component from the module namespace by export name', async () => {
    const { unmount } = render(Fixture, {
      bareComponentModule: asNamedModule(LiveProbe, 'Demo'),
      exportName: 'Demo',
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

  test('resolves the bare component from the default export when the named one is absent', async () => {
    const { unmount } = render(Fixture, {
      bareComponentModule: { default: LiveProbe },
      exportName: 'NotThisOne',
      initialValues: { label: 'Save' },
    });
    await tick();

    expect(liveProbeCount()).toBe(1);
    expect(mountCount()).toBe(1);
    expect(document.querySelector('.dx-stage__label')?.textContent).toBe('Live preview');

    unmount();
  });

  test('re-mounts with the new value when a control changes', async () => {
    const { component, unmount } = render(Fixture, {
      bareComponentModule: asNamedModule(LiveProbe),
      initialValues: { label: 'Save' },
    });
    await tick();
    expect(lastProps()).toEqual({ label: 'Save' });
    const mountsAfterFirst = mountCount();

    // Flip a control by MUTATING a key — exactly what the real prop panel does
    // (`playgroundValues[name] = next`), not by reassigning the whole object.
    // `$state.snapshot` deep-reads the proxy, so the key mutation is what
    // re-runs the live-mount attachment.
    fixtureComponent(component).setValue('label', 'Delete');
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

  // Lock the remount-with-new-value behavior across the control value shapes the
  // playground actually synthesizes — not just the one string case — since a
  // boolean/select/number value could in principle snapshot or remount
  // differently. Each row mutates a value and asserts the latest mount saw it.
  test.each([
    ['boolean', 'disabled', false, true],
    ['select/string', 'variant', 'primary', 'secondary'],
    ['number', 'count', 1, 2],
  ] as const)('re-mounts with the new %s value', async (_kind, key, from, to) => {
    const { component, unmount } = render(Fixture, {
      bareComponentModule: asNamedModule(LiveProbe),
      initialValues: { [key]: from },
    });
    await tick();
    expect(lastProps()).toEqual({ [key]: from });

    fixtureComponent(component).setValue(key, to);
    await tick();

    expect(lastProps()).toEqual({ [key]: to });
    expect(liveProbeCount()).toBe(1);

    unmount();
  });

  test('passes a plain object, not the reactive $state proxy', async () => {
    const { unmount } = render(Fixture, {
      bareComponentModule: asNamedModule(LiveProbe),
      initialValues: { label: 'Save', count: 3 },
    });
    await tick();

    expect(lastPropsWerePlainObject()).toBe(true);

    unmount();
  });

  test('falls back to the featured example when the module has no resolvable component', async () => {
    // A module namespace that exposes neither the named nor a default component
    // — the real unresolved-export path, not just an explicit `undefined`.
    const { unmount } = render(Fixture, {
      bareComponentModule: { default: undefined, somethingElse: 'not a component' },
      exportName: 'Demo',
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

  test('falls back to the featured example when the live mount fails', async () => {
    // A component whose constructor throws stands in for a bare mount that fails
    // (an unsynthesized required snippet, a missing context provider, …). With a
    // featured example available, the section must show THAT, not an error
    // callout over a preview that would otherwise work.
    const Throwing = function ThrowingComponent() {
      throw new Error('boom');
    };
    const { unmount } = render(Fixture, {
      bareComponentModule: asNamedModule(Throwing),
      featuredExample: FeaturedProbe,
      featuredScenario: 'demo',
      initialValues: { label: 'Save' },
    });
    // Two ticks, not one: the fallback is a TWO-step reactive cascade — the mount
    // throws and writes `mountErrors[LIVE_MOUNT_CONTAINER_ID]` inside the
    // attachment (tick 1), THEN `liveMountFailed` recomputes and the `{#if}` swaps
    // from the live branch to the featured branch (tick 2). One tick happens to
    // suffice under the current scheduler, but waiting the second step explicitly
    // asserts the branch-switch rather than relying on flush ordering.
    await tick();
    await tick();

    expect(liveProbeCount()).toBe(0);
    // The featured example took over once the live mount recorded its failure.
    expect(document.querySelector('.scenario-probe')).not.toBeNull();
    expect(document.querySelector('.dx-stage__label')?.textContent).toBe('Featured example');

    unmount();
  });

  test('renders NEITHER mount under ?snapshot=1', async () => {
    const { unmount } = render(Fixture, {
      bareComponentModule: asNamedModule(LiveProbe),
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
      bareComponentModule: asNamedModule(LiveProbe),
      initialValues: { label: 'Save' },
    });
    await tick();
    expect(liveProbeCount()).toBe(1);

    unmount();
    await tick();

    expect(liveProbeCount()).toBe(0);
  });

  test('keys a mount failure by the live container id when no featured example exists', async () => {
    // With NO featured fallback, the live branch stays put and surfaces the error
    // keyed by container id — better than a blank section.
    const Throwing = function ThrowingComponent() {
      throw new Error('boom');
    };
    const mountErrors: Record<string, { message: string } | undefined> = {};
    const { unmount } = render(Fixture, {
      bareComponentModule: asNamedModule(Throwing),
      initialValues: { label: 'Save' },
      mountErrors,
    });
    await tick();

    expect(mountErrors[LIVE_MOUNT_CONTAINER_ID]?.message).toContain('boom');
    expect(liveProbeCount()).toBe(0);

    unmount();
  });

  test('clears a recorded mount error once a later mount succeeds (invariant 6)', () => {
    // Drive `createLivePreviewMount` directly rather than through the fixture: the
    // fixture resolves its component from a fixed `bareComponentModule`, so it
    // can't model "the SAME container that just failed now mounts a working
    // component." Re-running the factory on one element — first with a throwing
    // component, then with a working one — is the honest way to exercise the
    // success-path `mountErrors[mountKey] = undefined` write (the clear that keeps
    // a stale error callout from lingering over a now-healthy preview).
    const Throwing = function ThrowingComponent() {
      throw new Error('boom');
    };
    const mountErrors: MountErrorRecord = {};
    const element = document.createElement('div');
    element.id = LIVE_MOUNT_CONTAINER_ID;
    document.body.append(element);

    const factory = createLivePreviewMount({ mountErrors });

    // First run: the throwing component records an error under the container id.
    const teardownFailed = factory(Throwing, { label: 'Save' })(element);
    expect(mountErrors[LIVE_MOUNT_CONTAINER_ID]?.message).toContain('boom');
    teardownFailed();

    // Second run on the SAME element: a working component mounts and the error
    // slot is cleared back to `undefined`.
    const teardownOk = factory(LiveProbe, { label: 'Save' })(element);
    expect(mountErrors[LIVE_MOUNT_CONTAINER_ID]).toBeUndefined();
    expect(element.querySelector('.live-probe')).not.toBeNull();
    teardownOk();

    element.remove();
  });

  test('passes the eager props object straight through to mount (invariant 7)', () => {
    // The props are passed by value at the call site — assert the exact object the
    // caller snapshots reaches the mounted component, with no late re-read.
    const mountErrors: MountErrorRecord = {};
    const element = document.createElement('div');
    element.id = LIVE_MOUNT_CONTAINER_ID;
    document.body.append(element);

    const factory = createLivePreviewMount({ mountErrors });
    const teardown = factory(LiveProbe, { label: 'Indigo' })(element);
    expect(element.querySelector('.live-probe')?.textContent).toContain('Indigo');
    teardown();

    element.remove();
  });
});
