import { loadResolverDocument, loadTokenDocuments } from './load.ts';
import { resolveDocuments } from './resolve.ts';
import { TokenValidationError } from './types.ts';
import {
  validateResolvedToken,
  validateResolverDocument,
  validateTokenDocument,
} from './validate.ts';

async function main(): Promise<void> {
  const [resolver, documents] = await Promise.all([loadResolverDocument(), loadTokenDocuments()]);
  validateResolverDocument(resolver);
  for (const { path, document } of documents) validateTokenDocument(document, path);

  const knownSources = new Set(documents.map(({ path }) => path));
  const missingSources = resolver.sets.flatMap((set) =>
    set.source
      .filter((source) => !knownSources.has(source))
      .map((source) => ({
        path: `$.sets.${set.name}.source`,
        reason: `source does not exist: ${source}`,
      })),
  );
  if (missingSources.length > 0) throw new TokenValidationError(missingSources);

  const resolved = resolveDocuments(documents.map(({ document }) => document));
  for (const [path, token] of Object.entries(resolved)) validateResolvedToken(token, path);
}

await main();
