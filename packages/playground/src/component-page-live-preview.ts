/**
 * Shared logic for the documentation page's Playground LIVE preview (#405).
 *
 * The Playground section mounts the BARE component directly with the synthesized
 * `playgroundValues` so the preview re-renders as the prop controls change —
 * instead of the static featured-example wrapper, whose only prop-driven part was
 * the copyable snippet. This module owns the two non-trivial pieces of that
 * behavior so they live in ONE place that both `component-page.svelte` and the
 * regression test exercise directly (rather than a test fixture re-implementing
 * the page's branch and drifting out of sync):
 *
 *   - {@link resolveBareComponent}: pick the mountable constructor out of the
 *     component's module namespace.
 *   - {@link createLivePreviewMount}: the `{@attach …}` factory that re-mounts on
 *     every control change, snapshots the reactive props to a plain object, keys
 *     errors by container DOM id, and falls back to a featured-example mount when
 *     the live mount fails.
 */
import { mount, unmount } from 'svelte';

import { toMountErrorDetail, type MountErrorDetail } from './example-error.ts';

/**
 * The parameter type Svelte's `mount` accepts as its first argument. Used as the
 * return type of {@link resolveBareComponent}. Note this union is satisfied by any
 * function (a bare `() => void` type-checks), so the type alias is a readability
 * aid only — {@link isMountableComponent} is what actually guards a value down to
 * something safe to hand `mount`.
 */
type MountableComponent = Parameters<typeof mount>[0];

/** Mount-error record keyed by container DOM id (mirrors the page's `mountErrors`). */
export type MountErrorRecord = Record<string, MountErrorDetail | undefined>;

/**
 * A Svelte component compiled by `Bun.build` is a callable function. Accept that
 * shape and nothing else, so a non-component export (a string constant, a plain
 * data object) degrades to the featured-example fallback instead of crashing
 * `mount`. Centralizing the check here keeps {@link resolveBareComponent} and the
 * mount factory in agreement on what "a component" is. Exported so the test
 * fixture's featured-example fallback narrows components the SAME way the live
 * mount does, rather than re-deriving the check with a bare cast.
 */
export function isMountableComponent(value: unknown): value is MountableComponent {
  return typeof value === 'function';
}

/**
 * Read one property off an unknown value. Returns `undefined` for non-objects —
 * the caller only cares whether the read yields a mountable component.
 *
 * Uses `Reflect.get` (which takes an `object` target and returns `unknown`)
 * rather than `(value as Record<string, unknown>)[key]` so the body stays free of
 * an `as`-assertion — the strict pre-commit oxlint config flags
 * `no-unsafe-type-assertion` on that cast even though it is sound after the
 * `typeof === 'object'` guard above.
 */
function readProperty(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return undefined;
  return Reflect.get(value, key);
}

/**
 * Resolve the mountable bare component out of a component's module namespace.
 *
 * Tries the documented PascalCase export first (e.g. `Accordion`), then the
 * module's `default` export. Returns `undefined` when neither is a mountable
 * component or the module itself is absent — the caller then degrades to the
 * static featured example.
 *
 * @param moduleNamespace - The `import * as …` namespace for the component's
 *   package subpath, or `undefined` when the page bundle didn't provide one.
 * @param exportName - The component's documented PascalCase export name.
 */
export function resolveBareComponent(
  moduleNamespace: unknown,
  exportName: string,
): MountableComponent | undefined {
  const named = readProperty(moduleNamespace, exportName);
  if (isMountableComponent(named)) return named;
  const fallback = readProperty(moduleNamespace, 'default');
  return isMountableComponent(fallback) ? fallback : undefined;
}

/** Options for {@link createLivePreviewMount}. */
export type LivePreviewMountOptions = {
  /**
   * Read the current synthesized prop values as a PLAIN object — the caller
   * snapshots its reactive `$state` here (`() => $state.snapshot(playgroundValues)`)
   * so this module stays rune-free. Called INSIDE the returned attachment so
   * Svelte's attachment effect observes the reactive read and re-runs (teardown +
   * fresh mount) whenever a control changes. Returning a plain object — never the
   * reactive proxy — is exactly what a real consumer would pass as props.
   */
  readValues: () => Record<string, unknown>;
  /**
   * The mount-error record to write into, keyed by the container's DOM id.
   * Mutated in place (never reassigned) so a Svelte `$state` proxy stays
   * reactive for the error callout that reads it back.
   */
  mountErrors: MountErrorRecord;
};

/**
 * Build the `{@attach …}` factory that mounts the bare component live.
 *
 * The returned factory takes the resolved component and yields an attachment
 * that, on each run:
 *
 *   - reads the current values via `readValues()` — the reactive read that makes
 *     Svelte re-run this attachment (teardown + remount) on every control change,
 *     so the preview tracks the controls. The caller snapshots its `$state` in
 *     that getter, so the mounted component receives a plain object, exactly what
 *     a real consumer would pass, never the reactive proxy;
 *   - records any mount failure under the container's DOM id and returns a
 *     cleanup that unmounts the instance.
 *
 * Remount-on-change is intentional and correct for the boolean/select controls
 * that dominate the playground. The known trade-off: a text control loses focus
 * on each keystroke because the whole instance is rebuilt — acceptable for a
 * preview surface (the snippet, not this mount, is the copy target).
 *
 * @returns A factory `(Component) => attachment`. When `Component` isn't
 *   mountable the attachment clears any stale error and renders nothing, letting
 *   the caller's template fall back to the featured example.
 */
export function createLivePreviewMount(
  options: LivePreviewMountOptions,
): (component: unknown) => (element: HTMLElement) => () => void {
  const { readValues, mountErrors } = options;
  return (component: unknown) => (element: HTMLElement) => {
    const mountKey = element.id;
    if (!isMountableComponent(component)) {
      mountErrors[mountKey] = undefined;
      return () => {};
    }
    let app: ReturnType<typeof mount> | undefined;
    try {
      app = mount(component, {
        target: element,
        props: readValues(),
      });
      mountErrors[mountKey] = undefined;
    } catch (error) {
      console.error('[cinder playground] failed to mount live preview:', error);
      mountErrors[mountKey] = toMountErrorDetail(error);
    }
    return () => {
      if (app === undefined) return;
      try {
        // `unmount` returns a Promise (outro animations); the teardown is
        // fire-and-forget here, so the result is intentionally not awaited.
        void unmount(app);
      } catch {
        // Best-effort cleanup only.
      }
    };
  };
}
