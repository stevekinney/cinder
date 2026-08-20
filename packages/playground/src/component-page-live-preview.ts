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
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';

import type {
  PlaygroundControl,
  PlaygroundSeed,
  PlaygroundValue,
} from './component-page-playground.ts';
import type { PreviewRecipe } from './component-page-preview-recipes.ts';
import { toMountErrorDetail, type MountErrorDetail } from './example-error.ts';
import { CONTEXT_REQUIRED_PARTS } from './shell-app/compound-families.ts';

/**
 * Translate the flat playground control values into the props object handed to
 * `mount`. Almost every value passes through unchanged; the one transform is the
 * synthesized `children` text control, whose plain string must become a Svelte
 * snippet (components receive `children` as a snippet, never a raw string).
 *
 * The page supplies that compiled snippet, so text is rendered as a text node
 * rather than through a wrapper element. This keeps valid text-only contexts
 * such as `textarea` and `option` valid when a component exposes an `as` prop.
 *
 * An empty children string yields no `children` prop at all, so the component
 * falls back to its own default rendering rather than mounting an empty snippet.
 */
export function toMountProps(
  controls: PlaygroundControl[],
  values: Record<string, PlaygroundValue>,
  seeds: readonly PlaygroundSeed[] = [],
  recipe?: PreviewRecipe,
  children?: Snippet,
): Record<string, unknown> {
  // Recipe props establish a valid baseline for the bare preview. Editable
  // controls still win below, so changing a generated control remains live.
  const props: Record<string, unknown> = { ...recipe?.props };
  // A recipe's children are a repo constant (placeholder boxes for a layout
  // primitive, a padded block for Surface), so they are inserted as MARKUP —
  // that is the point, since the whole failure being fixed is that one text run
  // shows nothing about a component whose job is arranging elements.
  if (recipe?.childrenHtml !== undefined) {
    // Recipes with sibling layout items need a compiled Svelte snippet—not a
    // `createRawSnippet` wrapper—so direct-child selectors keep reaching the
    // actual items. The page supplies that compiled snippet at the call site.
    if (children !== undefined) props['children'] = children;
  }
  // Synthesized structural values (a required `items: Item[]`, say). These are
  // live objects, not strings, so nothing is parsed at mount time.
  for (const seed of seeds) props[seed.name] = seed.value;
  for (const control of controls) {
    const value = values[control.name] ?? control.value;
    if (control.kind === 'text' && control.isChildren === true) {
      // A recipe already supplied structured children; the name-as-text seed
      // must not overwrite them.
      if (recipe?.childrenHtml !== undefined) continue;
      const text = String(value);
      if (text === '') continue;
      if (children !== undefined) props['children'] = children;
      continue;
    }
    // A SYNTHESIZED empty string — a prop with no manifest default, seeded to
    // `''` — is not passed to the mount, mirroring `shouldEmit`, which already
    // drops it from the copyable snippet.
    //
    // Two reasons. The preview must render the code it tells you to copy: with a
    // seeded `''` passed here but omitted there, `<DropdownGroup />` was the
    // published snippet while the live mount was really
    // `<DropdownGroup label="" ariaLabelledby="" />`. And a component that validates
    // its own inputs is entitled to reject `''` — DropdownGroup throws
    // "requires a non-empty label value", so the seed did not just differ from
    // the snippet, it painted an error callout over a component that works.
    // A synthesized `0` is dropped for the same reason (and matters for `Image`,
    // where `width={0} height={0}` collapses the element regardless of `src`).
    if (!control.hasDefault && (value === '' || value === 0)) continue;
    props[control.name] = value;
  }
  return props;
}

/**
 * The DOM `id` of the live-preview mount container, and therefore the
 * {@link MountErrorRecord} key the live mount writes its failures under. Exported
 * so the page template, the `liveMountFailed` derivation, and the test fixture all
 * reference ONE string — a rename then fails at every import site instead of
 * silently leaving the fixture asserting against a key the page no longer writes.
 */
export const LIVE_MOUNT_CONTAINER_ID = 'playground-live-mount';

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
 * Whether the playground may mount this component BARE with synthesized props.
 *
 * Two structural exclusions, both about children the playground cannot invent:
 *
 *  - A compound ROOT (`isCompound`, from the manifest) expects structured
 *    sub-components (`<Accordion.Item>`); a bare mount renders an empty shell or
 *    throws on `{@render children()}`.
 *  - A context-requiring PART (see {@link CONTEXT_REQUIRED_PARTS}) reads a strict
 *    context getter during init, so a mount with no provider ancestor throws
 *    `missing_context` — which the page then paints as a red error callout on a
 *    component whose only sin is being designed for composition.
 *
 * Auto-wrapping the parts in a synthesized `<Root><Part/></Root>` was considered
 * and rejected: several need a nesting depth greater than two
 * (`Table > Table.Header > Table.Row > Table.HeaderCell`), the roots have their
 * own required props, and `tab`/`segment`/`choice-grid-item` need registration
 * values that match the root's selection state. A generic wrapper renders blank
 * or misleading for most of them, and the root's own page already shows the real
 * composition.
 *
 * Deliberately NOT gated on compound-family membership as a whole: most family
 * members read context through the optional `tryGet*` accessors and bare-mount
 * fine today.
 */
export function canBareMount(kebabName: string, isCompound: boolean | undefined): boolean {
  return isCompound !== true && !CONTEXT_REQUIRED_PARTS.has(kebabName);
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
   * The mount-error record to write into, keyed by the container's DOM id.
   * Mutated in place (never reassigned) so a Svelte `$state` proxy stays
   * reactive for the error callout that reads it back.
   */
  mountErrors: MountErrorRecord;
};

/**
 * Build the `{@attach …}` factory that mounts the bare component live.
 *
 * The returned factory takes the resolved component AND a plain snapshot of the
 * current prop values, and yields an attachment that mounts the component with
 * those props.
 *
 * The reason props are passed EAGERLY (not via a late getter) is how Svelte
 * attachments track reactivity: Svelte re-runs an `{@attach EXPR}` only when
 * reactive state read **while evaluating EXPR** changes — not state read inside
 * the returned attachment body. So the caller must read its reactive
 * `playgroundValues` in the attach expression itself:
 *
 *     {@attach mountLivePreview(bareComponent, $state.snapshot(playgroundValues))}
 *
 * The `$state.snapshot(...)` call is the tracked read; changing any control
 * re-evaluates the expression, which produces a new attachment, which Svelte runs
 * after tearing down the previous mount — so the preview tracks the controls.
 * The snapshot is a plain object, exactly what a real consumer passes as props,
 * never the reactive proxy.
 *
 * On each run the attachment:
 *
 *   - records a SYNCHRONOUS mount failure (a throw from the component's
 *     construction, e.g. an unsynthesized required snippet or a missing context
 *     provider) under the container's DOM id, and returns a cleanup that unmounts
 *     the instance. Errors thrown LATER — from an `$effect` or `onMount` that runs
 *     after `mount()` returns — escape this `try`/`catch` and are NOT recorded
 *     here; catching those would require wrapping the mount in a
 *     `<svelte:boundary>`, which #405 deliberately leaves out of scope (the
 *     featured-example fallback already covers the common construction-time case).
 *
 * Remount-on-change is intentional and correct for the boolean/select controls
 * that dominate the playground. The known trade-off: a text control loses focus
 * on each keystroke because the whole instance is rebuilt — acceptable for a
 * preview surface (the snippet, not this mount, is the copy target).
 *
 * @returns A factory `(Component, props) => attachment`. When `Component` isn't
 *   mountable the attachment clears any stale error and renders nothing, letting
 *   the caller's template fall back to the featured example.
 */
export function createLivePreviewMount(
  options: LivePreviewMountOptions,
): (component: unknown, props: Record<string, unknown>) => (element: HTMLElement) => () => void {
  const { mountErrors } = options;
  return (component: unknown, props: Record<string, unknown>) => (element: HTMLElement) => {
    const mountKey = element.id;
    if (!isMountableComponent(component)) {
      mountErrors[mountKey] = undefined;
      return () => {};
    }
    let app: ReturnType<typeof mount> | undefined;
    try {
      app = mount(component, {
        target: element,
        props,
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
