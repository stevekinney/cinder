import { loadResolverDocument, loadTokenDocuments } from './load.ts';
import { resolveDocuments } from './resolve.ts';
import { TokenValidationError, type ResolverModifier, type TokenDocument } from './types.ts';
import {
  validateResolvedToken,
  validateResolverDocument,
  validateTokenDocument,
} from './validate.ts';

type TokenDocumentEntry = { path: string; document: TokenDocument };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
  const referencedPaths = new Set(resolver.sets.flatMap((set) => set.source));
  const modifiersByName = new Map(resolver.modifiers.map((modifier) => [modifier.name, modifier]));
  const orderedModifiers = resolver.resolutionOrder.map((name) => modifiersByName.get(name)!);
  for (const modifierValues of combinations(orderedModifiers))
    for (const document of findModifierDocuments(documents, modifierValues))
      referencedPaths.add(document.path);
  const unreferencedDocuments = documents
    .filter(({ path }) => !referencedPaths.has(path))
    .map(({ path }) => ({ path, reason: 'token document is not referenced by the resolver' }));
  if (unreferencedDocuments.length > 0) throw new TokenValidationError(unreferencedDocuments);
  for (const set of resolver.sets)
    for (const modifierValues of combinations(orderedModifiers)) {
      const sourceDocuments = set.source.flatMap((source) => {
        const document = documentsByPath.get(source);
        return document ? [document] : [];
      });
      const modifierDocuments = findModifierDocuments(documents, modifierValues);
      for (const modifier of orderedModifiers)
        if (
          !modifierDocuments.some(
            ({ document }) =>
              modifierAssignments(document)?.[modifier.name] === modifierValues[modifier.name],
          )
        )
          throw new TokenValidationError([
            {
              path: `$.modifiers.${modifier.name}`,
              reason: `no token document exists for ${modifier.name}=${modifierValues[modifier.name]}`,
            },
          ]);
      const resolved = resolveDocuments([
        ...sourceDocuments,
        ...modifierDocuments.map(({ document }) => document),
      ]);
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

export function findModifierDocument(
  documents: TokenDocumentEntry[],
  modifier: ResolverModifier,
  value: string | undefined,
): TokenDocumentEntry | undefined {
  if (!value) return undefined;
  return documents.find(({ document }) => {
    return modifierAssignments(document)?.[modifier.name] === value;
  });
}

function modifierAssignments(document: TokenDocument): Record<string, string> | undefined {
  const extensions = document.$extensions?.['com.lostgradient.cinder'];
  if (!isObject(extensions) || !isObject(extensions['modifier'])) return undefined;
  const assignments = extensions['modifier'];
  if (!Object.values(assignments).every((value) => typeof value === 'string')) return undefined;
  return assignments as Record<string, string>;
}

export function findModifierDocuments(
  documents: TokenDocumentEntry[],
  modifierValues: Record<string, string>,
): TokenDocumentEntry[] {
  return documents.filter(({ document }) => {
    const assignments = modifierAssignments(document);
    return (
      assignments !== undefined &&
      Object.entries(assignments).every(([name, value]) => modifierValues[name] === value)
    );
  });
}

if (import.meta.main) await main();
