import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { PLAYGROUND_ROOT, PLAYGROUND_TEMP_ROOT } from './playground-paths.ts';

type RenderedFeaturedExample = {
  body: string;
  head: string;
};

type FeaturedExampleServerModule = {
  renderFeaturedExample: (mountIdPrefix: string) => RenderedFeaturedExample;
};

function isFeaturedExampleServerModule(value: unknown): value is FeaturedExampleServerModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'renderFeaturedExample') === 'function'
  );
}

function formatBuildLogs(logs: readonly { message: string }[]): string {
  return logs.map(({ message }) => message).join('\n');
}

async function main(): Promise<void> {
  const [componentName, scenario, mountIdPrefix] = process.argv.slice(2);
  if (
    componentName === undefined ||
    scenario === undefined ||
    mountIdPrefix === undefined ||
    !/^[a-z0-9][a-z0-9-]*$/.test(componentName) ||
    !/^[a-z0-9][a-z0-9-]*$/.test(scenario) ||
    mountIdPrefix !== `overview-mount-${scenario}`
  ) {
    throw new Error(
      'featured example worker requires safe component, scenario, and mount id inputs',
    );
  }

  const examplePath = join(
    PLAYGROUND_ROOT,
    'src',
    'examples',
    componentName,
    `${scenario}.example.svelte`,
  );
  if (!(await Bun.file(examplePath).exists())) {
    throw new Error(`[playground] featured example not found: ${componentName}/${scenario}`);
  }

  const temporaryDirectory = join(PLAYGROUND_TEMP_ROOT, randomUUID());
  const entryPath = join(temporaryDirectory, 'featured-example-server-entry.ts');
  const relativeExamplePath = relative(dirname(entryPath), examplePath).split(sep).join('/');
  const exampleImportSpecifier = relativeExamplePath.startsWith('.')
    ? relativeExamplePath
    : `./${relativeExamplePath}`;
  const entrySource = `import { render } from 'svelte/server';
import Example from ${JSON.stringify(exampleImportSpecifier)};

export function renderFeaturedExample(mountIdPrefix: string) {
  const rendered = render(Example, { props: { mountIdPrefix } });
  return { body: rendered.body, head: rendered.head };
}
`;

  try {
    await Bun.write(entryPath, entrySource);
    const result = await Bun.build({
      entrypoints: [entryPath],
      plugins: [sveltePlugin({ generate: 'server' })],
      target: 'bun',
      format: 'esm',
      conditions: ['bun', 'svelte'],
      splitting: false,
    });
    if (!result.success || result.outputs[0] === undefined) {
      throw new Error(
        `[playground] featured example server build failed for ${componentName}/${scenario}:\n${formatBuildLogs(result.logs)}`,
      );
    }

    const bundlePath = join(temporaryDirectory, 'featured-example-server.js');
    await Bun.write(bundlePath, await result.outputs[0].text());
    const loaded: unknown = await import(pathToFileURL(bundlePath).href);
    if (!isFeaturedExampleServerModule(loaded)) {
      throw new Error('[playground] featured example server bundle exported no renderer');
    }
    process.stdout.write(JSON.stringify(loaded.renderFeaturedExample(mountIdPrefix)));
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
