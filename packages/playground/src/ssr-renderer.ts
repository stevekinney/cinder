import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { coordinatedBuild } from './build-artifacts-shared.ts';
import type { ComponentDocumentationPayload } from './component-documentation-types.ts';
import { PLAYGROUND_ROOT, PLAYGROUND_TEMP_ROOT } from './playground-paths.ts';
import { getRebuildGeneration } from './rebuild-generation.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type ShellServerRenderer = (props: { components: string[]; readmeHtml: string }) => {
  body: string;
  head: string;
};
export type ShellServerRendererModule = { renderShellBody: ShellServerRenderer };

export function isShellServerRendererModule(value: unknown): value is ShellServerRendererModule {
  return isRecord(value) && typeof value['renderShellBody'] === 'function';
}

export type ShellServerRendererLoadResult = {
  renderer: ShellServerRenderer;
  usedFallback: boolean;
};

/** Return the last-good value after a failed rebuild, or preserve the original failure. */
export function fallbackToLastGood<T>(lastGood: T | null, error: unknown): T {
  if (lastGood === null) throw error;
  return lastGood;
}

/** Resolve a renderer load failure against the current last-good renderer. */
export async function resolveRendererLoad<T>(
  loadRenderer: () => Promise<T>,
  getLastGood: () => T | null,
  onError?: (error: unknown) => void,
): Promise<{ renderer: T; usedFallback: boolean }> {
  try {
    return { renderer: await loadRenderer(), usedFallback: false };
  } catch (error) {
    onError?.(error);
    return { renderer: fallbackToLastGood(getLastGood(), error), usedFallback: true };
  }
}

let shellServerRendererPromise: Promise<ShellServerRendererLoadResult> | null = null;
let lastGoodShellServerRenderer: ShellServerRenderer | null = null;
let preparedShellServerRenderer: ShellServerRenderer | null = null;

/**
 * Server renderer for the canonical documentation page (`src/page-server-entry.ts`).
 * Same shape and caching discipline as {@link ShellServerRenderer}.
 */
type RenderedBody = { body: string; head: string };
type PageServerRenderer = (props: {
  componentName: string;
  documentation: ComponentDocumentationPayload;
  examples: { scenario: string; title: string; description?: string; featured?: boolean }[];
  sidebarComponents: string[];
  overviewExampleHtml: string | null;
}) => RenderedBody;
type LandingServerRenderer = (props: {
  readmeHtml: string;
  sidebarComponents: string[];
}) => RenderedBody;
/**
 * Both renderers come from the same server bundle: `/` and `/page/<name>` are
 * the same Svelte component with different content, so they share one chrome.
 */
export type PageServerRenderers = {
  renderComponentPageBody: PageServerRenderer;
  renderLandingBody: LandingServerRenderer;
};

export function isPageServerRenderers(value: unknown): value is PageServerRenderers {
  return (
    isRecord(value) &&
    typeof value['renderComponentPageBody'] === 'function' &&
    typeof value['renderLandingBody'] === 'function'
  );
}

/**
 * Mirrors {@link ShellServerRendererLoadResult}. `usedFallback` matters to the
 * startup warmup: a fallback RESOLVES rather than rejects, so without this flag a
 * failed warmup build is indistinguishable from a successful one and readiness
 * would be advertised behind a stale renderer.
 */
export type PageServerRendererLoadResult = {
  renderers: PageServerRenderers;
  usedFallback: boolean;
};

let pageServerRendererPromise: Promise<PageServerRendererLoadResult> | null = null;
let lastGoodPageServerRenderer: PageServerRenderers | null = null;

export function shellBuildSucceeded(code: string | null, usedFallback: boolean): boolean {
  return code !== null && !usedFallback;
}

export function formatBuildLogs(logs: readonly { message: string }[]): string {
  return logs.map(({ message }) => message).join('\n');
}

export async function loadShellServerRenderer(): Promise<ShellServerRendererLoadResult> {
  if (shellServerRendererPromise !== null) return shellServerRendererPromise;

  const generationAtStart = getRebuildGeneration();
  const loadFreshRenderer = async (): Promise<ShellServerRenderer> => {
    const result = await coordinatedBuild(() =>
      Bun.build({
        entrypoints: [join(PLAYGROUND_ROOT, 'src', 'shell-app', 'shell-server-entry.ts')],
        plugins: [sveltePlugin({ generate: 'server' })],
        target: 'bun',
        format: 'esm',
        conditions: ['bun', 'svelte'],
        splitting: false,
      }),
    );
    if (!result.success || result.outputs[0] === undefined) {
      throw new Error(`Shell server bundle failed:\n${formatBuildLogs(result.logs)}`);
    }

    const serverBundleDirectory = join(PLAYGROUND_TEMP_ROOT, randomUUID());
    const serverBundlePath = join(serverBundleDirectory, 'shell-server.js');
    let loaded: unknown;
    try {
      await Bun.write(serverBundlePath, await result.outputs[0].text());
      loaded = await import(pathToFileURL(serverBundlePath).href);
    } finally {
      rmSync(serverBundleDirectory, { recursive: true, force: true });
    }
    if (!isShellServerRendererModule(loaded)) {
      throw new Error('Shell server bundle did not export renderShellBody');
    }
    return loaded.renderShellBody;
  };

  shellServerRendererPromise = resolveRendererLoad(
    loadFreshRenderer,
    () => lastGoodShellServerRenderer,
    (error) => {
      console.error(
        '[playground] shell server rebuild failed; serving the last-good renderer:',
        error,
      );
    },
  ).then((result) => {
    if (!result.usedFallback && generationAtStart === getRebuildGeneration()) {
      lastGoodShellServerRenderer = result.renderer;
    }
    return result;
  });

  return shellServerRendererPromise;
}

/** Inject the renderer prepared by server startup (or a deterministic test renderer). */
export function setPreparedShellServerRenderer(renderer: ShellServerRenderer | null): void {
  preparedShellServerRenderer = renderer;
}

/** Read the renderer prepared by server startup (or a deterministic test renderer). */
export function getPreparedShellServerRenderer(): ShellServerRenderer | null {
  return preparedShellServerRenderer;
}

export function resetShellRendererWarmupState(): void {
  shellServerRendererPromise = null;
  preparedShellServerRenderer = null;
}

/**
 * Reset the documentation-page server renderer's in-flight/dedup slot.
 * Called by `file-watcher.ts`'s `invalidateCachesForChange` — the
 * documentation page's server bundle shares the component graph the shell
 * rebuild invalidates, so it drops its dedup slot on the same signal, kept
 * separate from `resetShellRendererWarmupState` because that function's own
 * (unrelated) call site in `startServer`'s renderer-warmup retry loop must
 * not also reset the page-server renderer.
 */
export function resetPageServerRendererPromise(): void {
  pageServerRendererPromise = null;
}

export function rendererWarmupNeedsPrebuild(
  generationChanged: boolean,
  sourceChanged: boolean,
  hasPendingRebuild: boolean,
): boolean {
  return generationChanged || sourceChanged || hasPendingRebuild;
}

export function rendererWarmupNeedsCacheInvalidation(
  generationChanged: boolean,
  sourceChanged: boolean,
  hasPendingRebuild: boolean,
): boolean {
  return sourceChanged || (!generationChanged && hasPendingRebuild);
}

/** Decide whether a renderer attempt is acceptable and whether its bundles must be rebuilt. */
export function rendererWarmupAttemptDecision(
  usedFallback: boolean,
  generationChanged: boolean,
  sourceChanged: boolean,
  hasPendingRebuild: boolean,
): { accepted: boolean; needsPrebuild: boolean } {
  const needsPrebuild = rendererWarmupNeedsPrebuild(
    generationChanged,
    sourceChanged,
    hasPendingRebuild,
  );
  return { accepted: !usedFallback && !needsPrebuild, needsPrebuild };
}

/**
 * Compile and load the documentation page's server renderer.
 *
 * Deliberately mirrors {@link loadShellServerRenderer}: same `generate: 'server'`
 * plugin, same `target: 'bun'` + `['bun','svelte']` conditions, same
 * write-to-temp-then-dynamic-import dance, and the same last-good fallback so a
 * transient compile error during development serves the previous good renderer
 * instead of a 500.
 */
export async function loadPageServerRenderer(): Promise<PageServerRendererLoadResult> {
  if (pageServerRendererPromise !== null) return pageServerRendererPromise;

  pageServerRendererPromise = (async () => {
    try {
      const generationAtStart = getRebuildGeneration();
      const result = await coordinatedBuild(() =>
        Bun.build({
          entrypoints: [join(PLAYGROUND_ROOT, 'src', 'page-server-entry.ts')],
          plugins: [sveltePlugin({ generate: 'server' })],
          target: 'bun',
          format: 'esm',
          conditions: ['bun', 'svelte'],
          splitting: false,
        }),
      );
      if (!result.success || result.outputs[0] === undefined) {
        throw new Error(`Page server bundle failed:\n${formatBuildLogs(result.logs)}`);
      }

      const serverBundleDirectory = join(PLAYGROUND_TEMP_ROOT, randomUUID());
      const serverBundlePath = join(serverBundleDirectory, 'page-server.js');
      let loaded: unknown;
      try {
        await Bun.write(serverBundlePath, await result.outputs[0].text());
        loaded = await import(pathToFileURL(serverBundlePath).href);
      } finally {
        rmSync(serverBundleDirectory, { recursive: true, force: true });
      }
      if (!isPageServerRenderers(loaded)) {
        throw new Error('Page server bundle did not export both renderers');
      }
      const renderer: PageServerRenderers = {
        renderComponentPageBody: loaded.renderComponentPageBody,
        renderLandingBody: loaded.renderLandingBody,
      };
      if (generationAtStart === getRebuildGeneration()) {
        lastGoodPageServerRenderer = renderer;
      }
      return { renderers: renderer, usedFallback: false };
    } catch (error) {
      console.error(
        '[playground] page server rebuild failed; serving the last-good renderer:',
        error,
      );
      return {
        renderers: fallbackToLastGood(lastGoodPageServerRenderer, error),
        usedFallback: true,
      };
    }
  })();

  return pageServerRendererPromise;
}
