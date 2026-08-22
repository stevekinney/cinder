import { join } from 'node:path';

import { PLAYGROUND_ROOT } from './playground-paths.ts';
import { getRebuildGeneration } from './rebuild-generation.ts';

export type RenderedFeaturedExample = {
  body: string;
  head: string;
};

const renderPromises = new Map<string, Promise<RenderedFeaturedExample>>();

const SVELTE_HYDRATION_MARKER = /<!--(?:\[[^>]*|\]|\$[^>]*)?-->/g;

/**
 * The example is compiled independently from the page that embeds it. Its
 * hydration markers therefore do not belong to the page's component tree and
 * can confuse the page-level hydration cursor. Keep the meaningful static HTML
 * while removing only Svelte's internal comment markers; the client mount
 * replaces this fragment atomically once its own bundle is ready.
 */
function removeHydrationMarkers(html: string): string {
  return html.replace(SVELTE_HYDRATION_MARKER, '');
}

function isRenderedFeaturedExample(value: unknown): value is RenderedFeaturedExample {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'body') === 'string' &&
    typeof Reflect.get(value, 'head') === 'string'
  );
}

async function renderInFreshProcess(
  componentName: string,
  scenario: string,
  mountIdPrefix: string,
): Promise<RenderedFeaturedExample> {
  const workerPath = join(PLAYGROUND_ROOT, 'src', 'featured-example-server-worker.ts');
  const worker = Bun.spawn(
    [process.execPath, 'run', workerPath, componentName, scenario, mountIdPrefix],
    {
      cwd: PLAYGROUND_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    worker.exited,
    new Response(worker.stdout).text(),
    new Response(worker.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `[playground] featured example render failed for ${componentName}/${scenario}: ${stderr.trim()}`,
    );
  }
  const parsed: unknown = JSON.parse(stdout);
  if (!isRenderedFeaturedExample(parsed)) {
    throw new Error('[playground] featured example worker returned malformed output');
  }
  return {
    body: removeHydrationMarkers(parsed.body),
    head: parsed.head,
  };
}

/** Server-render a featured documentation example for the exported first paint. */
export async function renderFeaturedExample(
  componentName: string,
  scenario: string,
  mountIdPrefix: string,
): Promise<RenderedFeaturedExample> {
  const cacheKey = `${getRebuildGeneration()}:${componentName}/${scenario}:${mountIdPrefix}`;
  let renderPromise = renderPromises.get(cacheKey);
  if (renderPromise === undefined) {
    renderPromise = renderInFreshProcess(componentName, scenario, mountIdPrefix);
    renderPromises.set(cacheKey, renderPromise);
    void renderPromise.catch(() => renderPromises.delete(cacheKey));
  }
  return await renderPromise;
}
