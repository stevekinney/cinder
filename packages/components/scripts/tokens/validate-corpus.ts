import { loadResolverDocument, loadTokenDocuments } from './load.ts';
import { resolveDocuments } from './resolve.ts';
import { TokenValidationError, type ResolverModifier, type TokenDocument } from './types.ts';
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

  const documentsByPath = new Map(documents.map(({ path, document }) => [path, document]));
  const sourceDocuments = resolver.sets.flatMap((set) =>
    set.source.flatMap((source) => {
      const document = documentsByPath.get(source);
      return document ? [document] : [];
    }),
  );
  const modifiersByName = new Map(resolver.modifiers.map((modifier) => [modifier.name, modifier]));
  const orderedModifiers = resolver.resolutionOrder.map((name) => modifiersByName.get(name)!);
  for (const modifierValues of combinations(orderedModifiers)) {
    const modifierDocuments = orderedModifiers.map((modifier) => {
      const document = findModifierDocument(documents, modifier, modifierValues[modifier.name]);
      if (!document)
        throw new TokenValidationError([
          {
            path: `$.modifiers.${modifier.name}`,
            reason: `no token document exists for ${modifier.name}=${modifierValues[modifier.name]}`,
          },
        ]);
      return document;
    });
    const resolved = resolveDocuments([...sourceDocuments, ...modifierDocuments]);
    for (const [path, token] of Object.entries(resolved)) validateResolvedToken(token, path);
  }
}

function combinations(modifiers: ResolverModifier[]): Array<Record<string, string>> {
  return modifiers.reduce<Array<Record<string, string>>>(
    (current, modifier) =>
      current.flatMap((selection) =>
        modifier.values.map((value) => ({ ...selection, [modifier.name]: value })),
      ),
    [{}],
  );
}

function findModifierDocument(
  documents: Array<{ path: string; document: TokenDocument }>,
  modifier: ResolverModifier,
  value: string | undefined,
): TokenDocument | undefined {
  if (!value) return undefined;
  const directPath = `${modifier.name}-${value}.tokens.json`;
  const themedPath = `${modifier.name}s/${value}.tokens.json`;
  return documents.find(
    ({ path }) =>
      path === directPath ||
      path.endsWith(`/${directPath}`) ||
      path === themedPath ||
      path.endsWith(`/${themedPath}`),
  )?.document;
}

await main();
