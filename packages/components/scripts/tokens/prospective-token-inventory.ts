import { createHash } from 'node:crypto';
import { inventoryFromSources, type Source } from './css-usage-inventory.ts';
import { buildTokensBaseCss } from './generate.ts';
import { buildBaseIndex, buildTokenRegistryFromIndexes, themeAwarePaths } from './registry.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';

/** Inventory the authored corpus before any generated artifact or review is written. */
export async function buildInventoryForCorpus(
  sources: readonly Source[],
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
) {
  const registry = buildTokenRegistryFromIndexes(
    buildBaseIndex(resolver, documentsByPath),
    themeAwarePaths(resolver, documentsByPath),
  );
  const publicTokens = registry.entries
    .filter((entry) => entry.public)
    .map(({ path, cssProperty }) => ({ path, cssProperty }))
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const publicProperties = new Set(publicTokens.map((token) => token.cssProperty));
  const generatedCss = await buildTokensBaseCss(resolver, documentsByPath);
  if (sources.filter((source) => source.globalDefinitions).length !== 1)
    throw new Error('Prospective inventory requires exactly one generated token stylesheet');
  const inventory = {
    ...inventoryFromSources(
      sources.map((source) =>
        source.globalDefinitions ? { ...source, content: generatedCss } : source,
      ),
      publicProperties,
    ),
    tokenRegistry: {
      entries: publicTokens,
      sha256: createHash('sha256').update(JSON.stringify(publicTokens)).digest('hex'),
    },
  };
  return { inventory, registry, publicProperties, generatedCss };
}
