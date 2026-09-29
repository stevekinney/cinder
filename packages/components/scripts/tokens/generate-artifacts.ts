/**
 * The `tokens:generate` CLI entry point.
 *
 * `generate.ts` owns the base CSS and resolved-context JSON artifacts. This
 * module coordinates those outputs with the registry and documentation
 * artifacts so one command owns the complete token surface.
 */

import { mkdir, readFile } from 'node:fs/promises';

import { format } from 'prettier';
import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import typescriptPlugin from 'prettier/plugins/typescript';
import { assertPrettierResolvesToRoot } from '../lib/prettier-resolution.ts';

import { buildTokensDocMarkdown, validateDocSections } from './docs.ts';
import { buildGeneratedOutputs, findDriftedPaths, loadCorpus, readExisting } from './generate.ts';
import {
  JSON_PLUGINS,
  PRETTIER_OPTIONS,
  REGENERATE_COMMAND,
  registryJsonPath,
  registryModulePath,
  resolvedDirectory,
  tokenIndexPath,
  tokensDocPath,
} from './generator-configuration.ts';
import {
  buildBaseDocuments,
  buildBaseIndex,
  buildTokenRegistryFromIndexes,
  serializeTokenRegistry,
  themeAwarePaths,
  type TokenRegistry,
} from './registry.ts';
import { createValueResolver } from './resolve.ts';
import { RESOLVED_CONTEXT_COMBOS } from './resolved-contexts.ts';
import type { TokenDocument } from './types.ts';

const TYPESCRIPT_PLUGINS = [typescriptPlugin, estreePlugin, babelPlugin];
/**
 * The typed registry uses the same JSON data as the token tooling. Its root
 * export widens lookup keys and preserves optional entry facets without
 * duplicating the registry literal in generated TypeScript.
 *
 * The emitted type declares `category`, `component`, and `description` as
 * OPTIONAL KEYS rather than required keys of type `string | undefined`, which
 * is how `registry.ts` models them in-repo. That is not a drift: the data
 * reaches this module through `JSON.stringify`, which omits an undefined value
 * entirely, so a required key would be missing from the imported data and the
 * module would not typecheck against its own type.
 */
async function buildTokenRegistryModule(): Promise<string> {
  const source = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Source: the DTCG token corpus under components/cinder/src/tokens/.
 * Regenerate: ${REGENERATE_COMMAND}
 */

import registry from './registry.generated.json' with { type: 'json' };

/** One token's registry record. */
export type TokenRegistryEntry = {
  /** Dotted corpus path, e.g. \`space.4\`. */
  path: string;
  /** The custom property this token emits. */
  cssProperty: string;
  /** The token's category, when it declares one. */
  category?: string;
  /** The owning component, for component-scoped tokens. */
  component?: string;
  /** Whether the token is part of the public \`--cinder-*\` surface. */
  public: boolean;
  /** Whether a theme document overrides this token. */
  themeAware: boolean;
  /** The DTCG \`$deprecated\` value: \`false\`, \`true\`, or a message. */
  deprecated: boolean | string;
  /** The token's description, when it has one. */
  description?: string;
};

/** The registry's shape: every token, plus the lookups built over them. */
export type TokenRegistry = {
  entries: readonly TokenRegistryEntry[];
  pathToCssProperty: Readonly<Record<string, string>>;
  cssPropertyToPath: Readonly<Record<string, string>>;
  cssPropertyToPaths: Readonly<Record<string, readonly string[]>>;
  byCategory: Readonly<Record<string, readonly string[]>>;
  byComponent: Readonly<Record<string, readonly string[]>>;
};

/**
 * Declared as \`TokenRegistry\` rather than emitted \`as const\`.
 *
 * A literal type looks like a free upgrade -- exact keys, autocompletion -- but
 * it breaks both documented ways of using this data. Every lookup map keeps
 * only its generated keys and no string index signature, so
 * \`TOKEN_REGISTRY.pathToCssProperty[path]\` for a \`string\` path fails with
 * TS7053; and \`entries\` becomes a literal tuple whose elements each omit the
 * optional keys they happen not to carry, so reading \`.component\` while
 * iterating fails on any entry without one.
 *
 * Intersecting the literal with \`TokenRegistry\` fixes the first and not the
 * second. Since the value is generated data whose keys a consumer discovers at
 * runtime, the declared type is what they actually want.
 */
export const TOKEN_REGISTRY: TokenRegistry = registry;
`;
  assertPrettierResolvesToRoot();
  return format(source, { ...PRETTIER_OPTIONS, parser: 'typescript', plugins: TYPESCRIPT_PLUGINS });
}

const sourceExports: Readonly<Record<string, string>> = {
  'modes/motion-default.tokens.json': 'motionDefaultTokens',
  'modes/motion-forced-reduced.tokens.json': 'motionForcedReducedTokens',
  'modes/motion-reduced.tokens.json': 'motionReducedTokens',
  'sets/colors.tokens.json': 'colorTokens',
  'sets/components.tokens.json': 'componentTokens',
  'sets/foundation.tokens.json': 'foundationTokens',
  'sets/semantic.tokens.json': 'semanticTokens',
  'themes/dark.tokens.json': 'darkThemeTokens',
  'themes/light.tokens.json': 'lightThemeTokens',
};

const contextExports: Readonly<Record<string, string>> = {
  dark: 'resolvedDarkTokens',
  'dark-reduced-motion': 'resolvedDarkReducedMotionTokens',
  light: 'resolvedLightTokens',
  'light-reduced-motion': 'resolvedLightReducedMotionTokens',
};

function rootExportName(exports: Readonly<Record<string, string>>, key: string): string {
  const name = exports[key];
  if (!name)
    throw new Error(`Token artifact ${key} needs a named @lostgradient/cinder root export.`);
  return name;
}

/** Describe token files and their named exports from the single package root. */
async function buildTokenIndex(
  documentsByPath: Map<string, TokenDocument>,
  registry: TokenRegistry,
): Promise<string> {
  const sources = [...documentsByPath.keys()].toSorted().map((relativePath) => ({
    file: relativePath,
    exportName: rootExportName(sourceExports, relativePath),
  }));
  const index = {
    $comment: `GENERATED FILE. Do not edit by hand. Regenerate: ${REGENERATE_COMMAND}`,
    version: '2025.10',
    package: '@lostgradient/cinder',
    tokenCount: registry.entries.length,
    resolver: 'tokenResolver',
    registry: 'TOKEN_REGISTRY',
    sources,
    resolvedContexts: RESOLVED_CONTEXT_COMBOS.map(({ name }) => ({
      name,
      exportName: rootExportName(contextExports, name),
    })),
  };
  assertPrettierResolvesToRoot();
  return format(JSON.stringify(index), {
    ...PRETTIER_OPTIONS,
    parser: 'json',
    plugins: JSON_PLUGINS,
  });
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

async function buildAllGeneratedOutputs(): Promise<Map<string, string>> {
  const cssAndResolved = await buildGeneratedOutputs();

  const { resolver, documentsByPath } = await loadCorpus();
  const baseIndex = buildBaseIndex(resolver, documentsByPath);
  const baseDocuments = buildBaseDocuments(resolver, documentsByPath);
  const baseResolveReferences = createValueResolver(baseDocuments);
  const registry = buildTokenRegistryFromIndexes(
    baseIndex,
    themeAwarePaths(resolver, documentsByPath),
  );

  validateDocSections(registry);

  const existingDocMarkdown = await readFile(tokensDocPath, 'utf8');
  // Guards every formatter in the Promise.all below, at a statement boundary.
  assertPrettierResolvesToRoot();
  const [docMarkdown, registryJson, registryModule, tokenIndex] = await Promise.all([
    buildTokensDocMarkdown(existingDocMarkdown, baseIndex, baseResolveReferences),
    format(serializeTokenRegistry(registry), {
      ...PRETTIER_OPTIONS,
      parser: 'json',
      plugins: JSON_PLUGINS,
    }),
    buildTokenRegistryModule(),
    buildTokenIndex(documentsByPath, registry),
  ]);

  const generated = new Map(cssAndResolved);
  generated.set(registryJsonPath, registryJson);
  generated.set(tokensDocPath, docMarkdown);
  generated.set(registryModulePath, registryModule);
  generated.set(tokenIndexPath, tokenIndex);
  return generated;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const generated = await buildAllGeneratedOutputs();

  if (check) {
    const existing = await readExisting(generated.keys());
    const drifted = findDriftedPaths(generated, existing);
    if (drifted.length > 0) {
      throw new Error(
        `Generated token output drifted from the committed files:\n${drifted
          .map((path) => `  - ${path}`)
          .join('\n')}\nRun ${REGENERATE_COMMAND}.`,
      );
    }
    return;
  }

  await mkdir(resolvedDirectory, { recursive: true });
  for (const [path, content] of generated) await Bun.write(path, content);
}

if (import.meta.main) await main();
