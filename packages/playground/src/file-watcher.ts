import { existsSync, watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';

import { resetProject } from './analyze.ts';
import {
  fixtureArtifactByPath,
  fixtureBuildPromiseByKey,
  pageArtifactByPath,
  pageBuildPromiseByKey,
  scenarioArtifactByPath,
  scenarioBuildPromiseByKey,
} from './build-artifacts-shared.ts';
import { COMPONENT_SOURCES } from './component-sources.ts';
import { invalidateDiscoveryCache } from './discover.ts';
import { fixtureEntryByKey } from './fixture-bundle.ts';
import { clearManifestCaches } from './manifest-cache.ts';
import { pageEntryByName } from './page-bundle.ts';
import { PLAYGROUND_ROOT } from './playground-paths.ts';
import { bundleEntryByKey } from './scenario-bundle.ts';
import { resetShellBuildPromise } from './shell-bundle.ts';
import { triggerReload } from './sse-broadcast.ts';
import { resetPageServerRendererPromise, resetShellRendererWarmupState } from './ssr-renderer.ts';

/** Repository root — same derivation `playground-server.ts` uses for its own `REPO_ROOT`. */
const REPO_ROOT = join(PLAYGROUND_ROOT, '..', '..');

/**
 * The blast radius of a watched change, computed once per debounce window.
 * Three tiers, widest wins:
 *
 * - `shell`: `shell-app/**` or `render-shell.ts` changed. Clears the shell
 *   bundle plus every page bundle (every page bundle's generated entry mounts
 *   `component-page.svelte`, and the "everything else under playground src"
 *   fallback below also routes through here — see `startWatcher`).
 * - `components`: a file under the components package's `src/` changed.
 *   Clears every page bundle. This is conservative on purpose — components
 *   cross-import each other directly (e.g. `pricing-card.svelte`
 *   imports `Button`) and share `utilities/*.ts` helpers
 *   used almost everywhere, so a precise per-file reverse-dependency scope
 *   isn't cheaply computable. Clearing is an O(1) Map operation, not a
 *   rebuild — only the page(s) actually requested next pay a compile cost.
 * - `examples`: only `.example.svelte` files changed. An example file
 *   belongs to exactly one component, so this scope is precise.
 */
export type ChangeScope =
  | { kind: 'shell' }
  | { kind: 'components' }
  | { kind: 'examples'; names: ReadonlySet<string> };

/**
 * Invalidation generation. Bumped synchronously by `invalidateCachesForChange`
 * every time the watcher invalidates caches (never by an async rebuild — there
 * is no rebuild). The lazy per-artifact builders (`buildPageBundle`,
 * `buildShellBundle`, `buildFixtureBundle`) capture this value before
 * compiling and skip publishing their entry-name pointer if the generation
 * moved on while they were mid-build, so a build that started just before an
 * edit can't finish just after the cache clear and republish a stale pointer.
 */
let rebuildGeneration = 0;

/** Exposed for behavioral tests that verify debounce ordering, and for every module that needs to check for a racing invalidation. */
export function getRebuildGeneration(): number {
  return rebuildGeneration;
}

/** Debounce timer for the watcher. */
let rebuildDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let rebuildDebouncePromise: Promise<void> | null = null;
let settleRebuildDebounce: (() => void) | null = null;
/** Whether any change in the current debounce window touched shell sources. */
let pendingShellChanged = false;
/** Whether any change in the current debounce window touched components-package source. */
let pendingComponentsChanged = false;
/** Example component names (kebab) touched in the current debounce window. */
const pendingExampleNames = new Set<string>();

/** True while a debounced invalidation is still pending. */
export function hasPendingRebuild(): boolean {
  return rebuildDebounceTimer !== null;
}

/**
 * True when the shell bundle's cached entry may be out of date. Set by
 * `invalidateCachesForChange` for `components`/`shell`-scope changes;
 * cleared by `shell-bundle.ts`'s `buildShellBundle` only after a compile
 * that succeeds AND isn't itself racing a newer invalidation.
 *
 * Deliberately NOT the same treatment as `pageEntryByName`/`pageArtifactByPath`
 * (which get cleared outright): the shell is critical infrastructure — losing
 * it blanks the entire playground, not just one component's doc page — so
 * `buildShellBundle` attempts a fresh compile while this is true but falls
 * back to serving the last-good cached shell if that attempt fails, instead
 * of 404ing. This matches the pre-redesign rebuild path's behavior, which
 * only swapped the shell bundle on a successful compile.
 */
let shellStale = false;

/** Read by `shell-bundle.ts`'s `buildShellBundle`. */
export function isShellStale(): boolean {
  return shellStale;
}

/** Written by both this module (on invalidation) and `shell-bundle.ts` (on a successful rebuild). */
export function setShellStale(value: boolean): void {
  shellStale = value;
}

/**
 * Schedule a debounced cache invalidation. Coalesces save bursts: multiple
 * calls within the debounce window accumulate into one invalidation that
 * fires after the window elapses with no further calls. Scopes accumulate
 * (OR the booleans, union the example names) so the final invalidation
 * reflects everything touched during the window, not just the last call.
 */
export function scheduleRebuild(scope: ChangeScope): void {
  if (scope.kind === 'shell') pendingShellChanged = true;
  else if (scope.kind === 'components') pendingComponentsChanged = true;
  else for (const name of scope.names) pendingExampleNames.add(name);

  if (rebuildDebounceTimer !== null) clearTimeout(rebuildDebounceTimer);
  rebuildDebouncePromise ??= new Promise<void>((resolve) => {
    settleRebuildDebounce = resolve;
  });
  rebuildDebounceTimer = setTimeout(() => {
    rebuildDebounceTimer = null;
    const shellChanged = pendingShellChanged;
    const componentsChanged = pendingComponentsChanged;
    const exampleNames = new Set(pendingExampleNames);
    pendingShellChanged = false;
    pendingComponentsChanged = false;
    pendingExampleNames.clear();

    if (shellChanged) invalidateCachesForChange({ kind: 'shell' });
    else if (componentsChanged) invalidateCachesForChange({ kind: 'components' });
    else if (exampleNames.size > 0) {
      invalidateCachesForChange({ kind: 'examples', names: exampleNames });
    }
    settleRebuildDebounce?.();
    settleRebuildDebounce = null;
    rebuildDebouncePromise = null;
  }, 100);
}

/** Wait for pending invalidation, then return the settled rebuild generation. */
export async function waitForPendingRebuild(): Promise<number> {
  await rebuildDebouncePromise;
  return rebuildGeneration;
}

/**
 * Invalidate the cache entries affected by a change, sized to `scope`. This
 * is deliberately NOT a rebuild: the previous implementation eagerly
 * recompiled every sidebar component's page bundle (plus the shell) on every
 * single watched change, which meant one saved file could trigger ~161
 * concurrent `Bun.build()` calls — the actual cause of multi-gigabyte RSS
 * spikes and Bun segfaults during local dev.
 *
 * Clearing a cache Map is O(1); the actual compile is deferred entirely to
 * the existing per-route lazy build-and-cache fallback (`buildPageBundle`,
 * `buildShellBundle`, `buildBundle`) the next time a request actually needs
 * that artifact — the same mechanism already used today when a brand-new
 * component is added after server start, or an eager pre-build failed.
 *
 * Runs fully synchronously (no `await` between steps) so no request can ever
 * observe a half-invalidated cache — this is what makes it safe for route
 * handlers to read the cache maps directly with no additional coordination.
 */
export function invalidateCachesForChange(scope: ChangeScope): void {
  // Bump first: a lazy build already in flight captured the OLD generation
  // and will skip publishing its entry-name pointer once it notices the
  // generation moved on (see `buildPageBundle` et al.), so it can't
  // republish a stale pointer after the clears below.
  rebuildGeneration += 1;

  // Component files may have been added, renamed, or removed — re-scan on
  // next request.
  invalidateDiscoveryCache();
  clearManifestCaches();
  // Dispose the shared ts-morph project so the next analyzeAll() rebuilds
  // from fresh compiler state rather than reusing sources from before this
  // change.
  resetProject();

  // Scenario and fixture builds are lazy (per-example / per-fixture) and were
  // never part of the eager sweep. Clear them unconditionally on every
  // invalidation tier — rebuilding one example or fixture on next request is
  // cheap regardless of what changed.
  bundleEntryByKey.clear();
  scenarioArtifactByPath.clear();
  fixtureEntryByKey.clear();
  fixtureArtifactByPath.clear();
  fixtureBuildPromiseByKey.clear();
  // Also clear the in-flight dedup slot, not just the resolved-artifact
  // caches above. A build already in flight when this invalidation fires
  // keeps running (it'll skip publishing its entry pointer once it notices
  // the generation moved on — see `buildPageBundle` et al.), but if we left
  // its dedup entry in place, a request that arrives AFTER this invalidation
  // (e.g. the browser's reload in response to the SSE event below) would
  // find that stale in-flight promise and join it, serving pre-edit content
  // as if it were fresh. Clearing the slot here — before `triggerReload`
  // fires the event that causes the browser to re-request — guarantees any
  // post-invalidation request starts a genuinely new build instead.
  scenarioBuildPromiseByKey.clear();

  if (scope.kind === 'examples') {
    for (const name of scope.names) {
      const entryPath = pageEntryByName.get(name);
      pageEntryByName.delete(name);
      if (entryPath !== undefined) pageArtifactByPath.delete(entryPath);
      pageBuildPromiseByKey.delete(name);
    }
    triggerReload('reload');
    return;
  }

  // `shell`-scope and `components`-scope changes share the same clearing
  // footprint because `shell-app/color-token-panel.svelte` (rendered by
  // `shell.svelte`) imports Button, ColorPicker, Input, and Popover from the
  // full components barrel (`../../../components/src/index.ts`). A
  // components-package change can still affect the shell's compiled output.
  // The only difference between the two scopes is
  // which files caused the invalidation. Both tiers emit `shell-reload`: the
  // canonical shell now owns README and prop metadata as well as the preview,
  // so reloading only the iframe would leave that outer documentation stale.
  // Session-only shell state is persisted before navigation, so the document
  // refresh does not discard filters or color-token overrides.
  pageEntryByName.clear();
  pageArtifactByPath.clear();
  pageBuildPromiseByKey.clear();

  // See `isShellStale`/`setShellStale`'s doc comments for why this marks
  // staleness rather than clearing `shellEntryByName`/`shellArtifactByPath`
  // outright. Still clear the in-flight dedup slot for the same reason as
  // `scenarioBuildPromiseByKey` above — a post-invalidation request must not
  // join a pre-edit build.
  setShellStale(true);
  resetShellBuildPromise();
  resetShellRendererWarmupState();
  // The documentation page's server bundle shares the component graph the shell
  // rebuild invalidates, so drop its dedup slot on the same signal.
  resetPageServerRendererPromise();

  triggerReload('shell-reload');
}

/**
 * Classify a raw `fs.watch` filename reported for the playground `src` tree
 * (component-page.svelte, render-shell.ts, the shell-app/ directory,
 * analyze.ts, etc.) into a {@link ChangeScope}, or `null` when the change
 * should be ignored entirely.
 *
 * Excludes example files (handled by a separate, more precise watcher),
 * `.tmp-`-prefixed and dotfile paths (editor swap/lock files), `.test.ts`
 * files, and `*-mock.svelte`/`*-fixture.svelte` files (exist only to support
 * their sibling `.test.ts`, never reached by a real page render).
 *
 * Shell-source changes (paths under `shell-app/` or to `render-shell.ts`)
 * use the 'shell' scope so the SSE event is `shell-reload` instead of
 * `reload`. Everything else under playground src (component-page.svelte, and
 * genuine server-logic files like discover.ts/analyze.ts) uses the
 * 'components' scope: for component-page.svelte that's the correct
 * footprint (it's embedded in every page bundle's generated entry, same as a
 * components-package change); for server-logic files it's redundant with
 * `bun --watch` restarting the whole process (see the `dev` script) but
 * harmless, since invalidation is now an O(1) Map-clear rather than a
 * rebuild.
 */
export function classifyPlaygroundSrcChange(filename: string): ChangeScope | null {
  if (
    filename.startsWith('examples/') ||
    filename.startsWith('.tmp-') ||
    filename.endsWith('.test.ts') ||
    filename.startsWith('.') ||
    /(-mock|-fixture)\.svelte$/.test(filename)
  ) {
    return null;
  }
  const normalizedFilename = filename.replaceAll('\\', '/');
  const isShellChange =
    normalizedFilename.startsWith('shell-app/') || normalizedFilename === 'render-shell.ts';
  return isShellChange ? { kind: 'shell' } : { kind: 'components' };
}

/**
 * Start watching the components, examples, and playground source trees and
 * route every change through `scheduleRebuild`. The scheduler debounces
 * bursts and the generation-token state machine guarantees publish atomicity.
 */
export function startWatcher(): FSWatcher[] {
  const created: FSWatcher[] = [];

  try {
    // Components tree: source or shared-utility changes can affect any page
    // bundle (see the `ChangeScope` doc comment for the verified
    // cross-component-import / shared-utility fan-out), so this always uses
    // the 'components' scope — which ALSO marks the shell stale (shell-app
    // UI imports the full component barrel; see `ChangeScope`'s doc comment).
    for (const componentSource of COMPONENT_SOURCES) {
      const srcPath = join(componentSource.packageRoot, 'src');
      created.push(
        watch(srcPath, { recursive: true }, (_event, filename) => {
          if (filename) scheduleRebuild({ kind: 'components' });
        }),
      );

      for (const metadataPath of [
        join(componentSource.packageRoot, 'package.json'),
        componentSource.manifestPath,
      ]) {
        if (!existsSync(metadataPath)) continue;
        created.push(
          watch(metadataPath, () => {
            scheduleRebuild({ kind: 'components' });
          }),
        );
      }
    }

    // Markdown is a transitive dependency of the shell and page bundles, but
    // it is not one of the published component sources. Watch its source tree
    // explicitly so a successful dependency rebuild invalidates cached
    // artifacts instead of leaving stale renderer bytes in memory.
    const markdownSourcePath = join(REPO_ROOT, 'packages', 'markdown', 'src');
    if (existsSync(markdownSourcePath)) {
      created.push(
        watch(markdownSourcePath, { recursive: true }, (_event, filename) => {
          if (filename) scheduleRebuild({ kind: 'components' });
        }),
      );
    }

    // Examples directory: an edit to `<name>/<scenario>.example.svelte` can
    // only ever affect that one component's page bundle, so the scope is
    // precisely the touched component name (the first path segment). Other
    // files can also live directly under `examples/` (e.g.
    // `featured-examples.ts`, a shared test-data registry) — those aren't
    // scoped to one component, so they fall back to 'components' scope
    // rather than being silently treated as a bogus per-component name.
    const examplesPath = join(PLAYGROUND_ROOT, 'src', 'examples');
    created.push(
      watch(examplesPath, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const normalizedFilename = filename.replaceAll('\\', '/');
        if (normalizedFilename.endsWith('.test.ts') || normalizedFilename.startsWith('.')) return;
        if (normalizedFilename.endsWith('.example.svelte')) {
          const segments = normalizedFilename.split('/');
          // Recursive `fs.watch` can report a nested edit as a bare basename
          // with no directory segment on some platforms (observed on Linux
          // with certain Bun versions) — in that case we can't tell which
          // component owns it, so fall back to 'components' scope rather
          // than treating the whole filename as a bogus per-component name
          // (which would invalidate nothing real and leave the actual
          // component's stale cache entry untouched).
          if (segments.length < 2) {
            scheduleRebuild({ kind: 'components' });
            return;
          }
          const name = segments[0];
          if (name) scheduleRebuild({ kind: 'examples', names: new Set([name]) });
          return;
        }
        scheduleRebuild({ kind: 'components' });
      }),
    );

    const playgroundSrcPath = join(PLAYGROUND_ROOT, 'src');
    created.push(
      watch(playgroundSrcPath, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const scope = classifyPlaygroundSrcChange(filename);
        if (scope) scheduleRebuild(scope);
      }),
    );
  } catch (error) {
    // Close any watchers already created before rethrowing.
    for (const watcher of created) {
      watcher.close();
    }
    throw error;
  }

  return created;
}
