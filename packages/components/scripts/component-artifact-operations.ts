/**
 * Reusable component artifact operations for schema, variables, and README files.
 *
 * Keep lightweight discovery imports pointed at `discover-component-directories.ts`.
 * This module intentionally imports the heavier schema, variable, README, and
 * formatter dependencies needed to generate or check per-component artifacts,
 * while the CLI entrypoint in `generate-component-artifacts.ts` stays thin.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import * as prettier from 'prettier';

import { assertPrettierResolvesToRoot } from './lib/prettier-resolution.ts';

import {
  discoverComponentDirectories,
  type DiscoveredComponent,
} from './discover-component-directories.ts';
import { generateSchemaForComponent } from './generate-component-schema.ts';
import { generateVariablesForComponent } from './generate-component-variables.ts';
import { renderComponentReadme } from './render-component-readme.ts';

const COMPOSE_ONLY_ACCESSIBILITY_DOCUMENTATION_EXEMPTIONS = new Set([
  'accordion-item',
  'dropdown-group',
  'dropdown-item',
  'dropdown-label',
  'dropdown-menu',
  'dropdown-separator',
  'dropdown-trigger',
  'feed-event',
  'grid-list-item',
  'side-navigation-group',
  'side-navigation-item',
  'statistic',
  'tab',
  'tab-list',
  'tab-panel',
  'table-body',
  'table-cell',
  'table-header',
  'table-header-cell',
  'table-row',
  'tree-item',
]);

const prettierConfigurationCache = new Map<string, Promise<prettier.Options | null>>();

/**
 * Run prettier over generated content using the repo's prettier configuration.
 *
 * Failures are NOT swallowed. An earlier version returned `content` unformatted
 * on any error, so a formatter that failed to load -- or a version that could not
 * parse a generated file -- produced artifacts that `components:check` flagged as
 * drifted with no hint of the actual cause. A formatting error now names the file
 * and where prettier was resolved from.
 */
export async function formatGenerated(content: string, filepath: string): Promise<string> {
  assertPrettierResolvesToRoot();
  try {
    const configurationDirectory = dirname(filepath);
    let optionsPromise = prettierConfigurationCache.get(configurationDirectory);
    if (!optionsPromise) {
      optionsPromise = prettier.resolveConfig(filepath);
      prettierConfigurationCache.set(configurationDirectory, optionsPromise);
    }
    const options = await optionsPromise;
    return await prettier.format(content, { ...options, filepath });
  } catch (error) {
    throw new Error(
      `formatGenerated: prettier ${prettier.version} (${import.meta.resolve('prettier')}) ` +
        `failed to format ${filepath}`,
      { cause: error },
    );
  }
}

export interface ComponentArtifacts {
  component: DiscoveredComponent;
  schemaJson: string;
  schemaModule: string;
  variablesJson: string;
  variablesModule: string;
  readme: string | null;
}

export async function generateArtifactsForComponent(
  component: DiscoveredComponent,
): Promise<ComponentArtifacts> {
  const { directory, name, isExperimental } = component;
  const depthToSrc = isExperimental ? 3 : 2;
  const typesFilePath = join(directory, `${name}.types.ts`);

  const schema = generateSchemaForComponent({ typesFilePath, componentName: name, depthToSrc });
  const variables = await generateVariablesForComponent({
    componentDirectory: directory,
    componentName: name,
  });

  const readmePath = join(directory, 'README.md');
  let readme: string | null = null;
  if (existsSync(readmePath)) {
    const existing = await Bun.file(readmePath).text();
    readme = renderComponentReadme({
      existingReadme: existing,
      schema: schema.schema,
      variables: variables.variables,
    });
  }

  const schemaJsonPath = join(directory, `${name}.schema.json`);
  const schemaModulePath = join(directory, `${name}.schema.ts`);
  const variablesJsonPath = join(directory, `${name}.variables.json`);
  const variablesModulePath = join(directory, `${name}.variables.ts`);

  return {
    component,
    schemaJson: await formatGenerated(schema.schemaJson, schemaJsonPath),
    schemaModule: await formatGenerated(schema.schemaModule, schemaModulePath),
    variablesJson: await formatGenerated(variables.variablesJson, variablesJsonPath),
    variablesModule: await formatGenerated(variables.variablesModule, variablesModulePath),
    readme: readme === null ? null : await formatGenerated(readme, readmePath),
  };
}

export async function writeArtifacts(artifacts: ComponentArtifacts): Promise<void> {
  const { component } = artifacts;
  await Bun.write(join(component.directory, `${component.name}.schema.json`), artifacts.schemaJson);
  await Bun.write(join(component.directory, `${component.name}.schema.ts`), artifacts.schemaModule);
  await Bun.write(
    join(component.directory, `${component.name}.variables.json`),
    artifacts.variablesJson,
  );
  await Bun.write(
    join(component.directory, `${component.name}.variables.ts`),
    artifacts.variablesModule,
  );
  if (artifacts.readme !== null) {
    await Bun.write(join(component.directory, 'README.md'), artifacts.readme);
  }
}

export interface DriftIssue {
  component: string;
  file: string;
  reason: 'missing' | 'stale';
}

export async function checkComponentArtifacts(): Promise<DriftIssue[]> {
  const components = await discoverComponentDirectories();

  // Sequential on purpose: `generateSchemaForComponent` (called via
  // `generateArtifactsForComponent`) type-checks each component's props
  // against a shared, module-cached `ts-morph` `Project` (see
  // `generate-component-schema.ts`'s `getProject()`) so repeated calls in
  // the same process avoid reparsing common dependencies. Running these
  // calls concurrently interleaves their synchronous `Project` mutations —
  // TypeScript's checker enumerates an intersection type's members in an
  // order that depends on the Program's incidental accumulated state, so
  // concurrent access made property order for at least one component
  // (`input`) non-deterministic across otherwise-identical runs, producing
  // a `stale` verdict for a tree that had zero real drift. `generate` mode
  // has always been sequential, which is exactly why regenerating locally
  // could never reproduce a `check` failure. A full sequential run over
  // every component (measured against `bun run components:check` on the
  // full ~230-component tree) costs no measurable wall-clock time versus a
  // 12-way concurrent one — the work is CPU-bound type-checking, not I/O
  // that benefits from overlap — so there is no performance trade-off here.
  const issueGroups: DriftIssue[][] = [];
  for (const component of components) {
    const issues: DriftIssue[] = [];
    const artifacts = await generateArtifactsForComponent(component);
    const files: Array<{ filename: string; expected: string | null }> = [
      { filename: `${component.name}.schema.json`, expected: artifacts.schemaJson },
      { filename: `${component.name}.schema.ts`, expected: artifacts.schemaModule },
      { filename: `${component.name}.variables.json`, expected: artifacts.variablesJson },
      { filename: `${component.name}.variables.ts`, expected: artifacts.variablesModule },
      { filename: 'README.md', expected: artifacts.readme },
    ];

    if (!existsSync(join(component.directory, 'README.md'))) {
      issues.push({ component: component.name, file: 'README.md', reason: 'missing' });
    }
    if (
      !COMPOSE_ONLY_ACCESSIBILITY_DOCUMENTATION_EXEMPTIONS.has(component.name) &&
      !existsSync(join(component.directory, `${component.name}.a11y.md`))
    ) {
      issues.push({
        component: component.name,
        file: `${component.name}.a11y.md`,
        reason: 'missing',
      });
    }

    for (const { filename, expected } of files) {
      if (expected === null) continue;
      const path = join(component.directory, filename);
      if (!existsSync(path)) {
        issues.push({ component: component.name, file: filename, reason: 'missing' });
        continue;
      }
      const actual = await Bun.file(path).text();
      if (actual !== expected) {
        issues.push({ component: component.name, file: filename, reason: 'stale' });
      }
    }

    issueGroups.push(issues);
  }

  return issueGroups.flat();
}
