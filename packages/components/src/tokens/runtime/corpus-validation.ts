import { mergeAndExpandExtends, resolveDocuments } from './resolve.ts';
import {
  expandContextSources,
  expandSetSources,
  internalSetNames,
  normalizeSourcePath,
  parseResolutionOrder,
  reachableSetNames,
} from './resolver-order.ts';
import { TokenValidationError, type ResolverDocument, type TokenDocument } from './types.ts';

export function validateModifierSetExpansionOrder(
  resolver: ResolverDocument,
  documentsByPath?: Map<string, TokenDocument>,
): void {
  const order = parseResolutionOrder(resolver);
  const basePositions = new Map<string, number>();
  const baseDocumentSets = new Map<string, Set<string>>();
  for (const [position, entry] of order.entries()) {
    if (entry.kind !== 'sets') continue;
    for (const setName of reachableSetNames(resolver, entry.name)) {
      basePositions.set(setName, position);
      for (const source of expandSetSources(resolver, setName)) {
        const path = normalizeSourcePath(source.$ref);
        const setNames = baseDocumentSets.get(path) ?? new Set<string>();
        setNames.add(setName);
        baseDocumentSets.set(path, setNames);
      }
    }
  }
  const baseDocuments = documentsByPath
    ? order
        .filter((entry) => entry.kind === 'sets')
        .flatMap((entry) =>
          expandSetSources(resolver, entry.name).map((source) =>
            documentsByPath.get(normalizeSourcePath(source.$ref))!,
          ),
        )
    : [];

  const issues = [];
  for (const [position, entry] of order.entries()) {
    if (entry.kind !== 'modifiers') continue;
    const modifier = resolver.modifiers[entry.name];
    if (!modifier) continue;
    for (const [contextName, sources] of Object.entries(modifier.contexts)) {
      const internallyReferencedSetNames = new Set(
        internalSetNames(sources).flatMap((setName) => [...reachableSetNames(resolver, setName)]),
      );
      const referencedSetNames = new Set(internallyReferencedSetNames);
      for (const source of expandContextSources(resolver, entry.name, contextName)) {
        for (const setName of baseDocumentSets.get(normalizeSourcePath(source.$ref)) ?? []) {
          referencedSetNames.add(setName);
        }
      }
      for (const setName of referencedSetNames) {
        const basePosition = basePositions.get(setName);
        if (basePosition === undefined) continue;
        const setTokenPaths = new Set<string>();
        if (documentsByPath) {
          const expandedContextSources = expandContextSources(resolver, entry.name, contextName);
          const contextDocuments = expandedContextSources.map((source) =>
            documentsByPath.get(normalizeSourcePath(source.$ref))!,
          );
          const resetSourcePaths = new Set(
            expandSetSources(resolver, setName).map((source) => normalizeSourcePath(source.$ref)),
          );
          // A set can contain multiple source documents, and a context can
          // re-expand only some of them. Track each token's reset position
          // independently instead of using one last index for the whole set.
          const resetPositions = new Map<string, number>();
          for (const [sourceIndex, source] of expandedContextSources.entries()) {
            const sourcePath = normalizeSourcePath(source.$ref);
            if (!resetSourcePaths.has(sourcePath)) continue;
            const sourcePaths = new Set<string>();
            collectDeclaredTokenPaths(
              mergeAndExpandExtends(
                [documentsByPath.get(sourcePath)!],
                [...baseDocuments, ...contextDocuments.slice(0, sourceIndex + 1)],
              ),
              '',
              sourcePaths,
            );
            for (const tokenPath of sourcePaths) {
              resetPositions.set(tokenPath, sourceIndex);
            }
          }
          const expandedSuffixPaths = (startIndex: number): Set<string> => {
            const suffixPaths = new Set<string>();
            const suffixDocuments = contextDocuments.slice(startIndex);
            if (suffixDocuments.length === 0) return suffixPaths;
            collectDeclaredTokenPaths(
              mergeAndExpandExtends(suffixDocuments, [...baseDocuments, ...contextDocuments]),
              '',
              suffixPaths,
            );
            return suffixPaths;
          };
          for (const [tokenPath, resetIndex] of resetPositions) {
            if (!expandedSuffixPaths(resetIndex + 1).has(tokenPath)) setTokenPaths.add(tokenPath);
          }
        }
        const interveningModifier = order.slice(basePosition + 1, position).find((candidate) => {
          if (candidate.kind !== 'modifiers') return false;
          if (!documentsByPath) return true;
          const candidateModifier = resolver.modifiers[candidate.name];
          if (!candidateModifier) return false;
          return Object.keys(candidateModifier.contexts).some((candidateContext) => {
            const affectedPaths = new Set<string>();
            const candidateDocuments = expandContextSources(
              resolver,
              candidate.name,
              candidateContext,
            ).map((candidateSource) =>
              documentsByPath.get(normalizeSourcePath(candidateSource.$ref))!,
            );
            collectDeclaredTokenPaths(
              mergeAndExpandExtends(candidateDocuments, [...baseDocuments, ...candidateDocuments]),
              '',
              affectedPaths,
            );
            // Resolve this modifier in the scope established by the ordered
            // entries before it. A candidate may reference a token changed by
            // an earlier modifier; comparing against base-only would miss the
            // resulting effective-value reset.
            const precedingModifierNames = order
              .slice(0, order.indexOf(candidate))
              .filter((preceding) => preceding.kind === 'modifiers')
              .map((preceding) => preceding.name);
            const prefixContextCombinations = precedingModifierNames.reduce<
              Array<Map<string, string>>
            >(
              (selections, modifierName) =>
                selections.flatMap((selection) =>
                  Object.keys(resolver.modifiers[modifierName]!.contexts).map(
                    (precedingContextName) => {
                      const next = new Map(selection);
                      next.set(modifierName, precedingContextName);
                      return next;
                    },
                  ),
                ),
              [new Map()],
            );
            return prefixContextCombinations.some((contextSelection) => {
              const precedingDocuments = order
                .slice(0, order.indexOf(candidate))
                .flatMap((preceding) => {
                  if (preceding.kind === 'sets') return expandSetSources(resolver, preceding.name);
                  const precedingContext = contextSelection.get(preceding.name);
                  return precedingContext === undefined
                    ? []
                    : expandContextSources(resolver, preceding.name, precedingContext);
                })
                .map((source) => documentsByPath.get(normalizeSourcePath(source.$ref))!);
              const before = resolveDocuments(precedingDocuments);
              const after = resolveDocuments([...precedingDocuments, ...candidateDocuments]);
              return [...affectedPaths].some(
                (path) =>
                  setTokenPaths.has(path) &&
                  JSON.stringify(canonicalizeJson(before[path])) !==
                    JSON.stringify(canonicalizeJson(after[path])),
              );
            });
          });
        });
        if (!interveningModifier) continue;
        issues.push({
          path: `$.modifiers.${entry.name}.contexts.${contextName}`,
          reason:
            `set "${setName}" is re-expanded after modifier "${interveningModifier.name}" ` +
            'and would reset its intervening overrides',
        });
      }
    }
  }
  if (issues.length > 0) throw new TokenValidationError(issues);
}

export function collectDeclaredTokenPaths(
  value: unknown,
  prefix: string,
  paths: Set<string>,
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  if ('$value' in value || '$ref' in value) {
    paths.add(prefix);
    return;
  }
  for (const [name, child] of Object.entries(value)) {
    if (name.startsWith('$')) {
      if (name === '$root') collectDeclaredTokenPaths(child, prefix, paths);
      continue;
    }
    collectDeclaredTokenPaths(child, prefix ? `${prefix}.${name}` : name, paths);
  }
}

export function collectSemanticGroupMetadataPaths(
  value: unknown,
  prefix: string,
  paths: Set<string>,
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  if ('$value' in value || '$ref' in value) return;
  if ('$type' in value || '$deprecated' in value || '$extensions' in value) paths.add(prefix);
  for (const [name, child] of Object.entries(value)) {
    if (name.startsWith('$')) continue;
    collectSemanticGroupMetadataPaths(child, prefix ? `${prefix}.${name}` : name, paths);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalizeJson(child)]),
  );
}

export function mergeMetadataValue(base: unknown, override: unknown): unknown {
  if (!isRecord(base) || !isRecord(override)) return override;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = mergeMetadataValue(base[key], value);
  }
  return merged;
}

export function semanticGroupMetadataByPath(value: unknown): Map<string, Record<string, unknown>> {
  const metadata = new Map<string, Record<string, unknown>>();
  const visit = (node: unknown, prefix: string, inherited: Record<string, unknown> = {}): void => {
    if (!isRecord(node)) return;
    if ('$value' in node || '$ref' in node) return;
    const effective = {
      $type: node['$type'] ?? inherited['$type'],
      $deprecated: node['$deprecated'] ?? inherited['$deprecated'],
      $extensions: node['$extensions'] ?? inherited['$extensions'],
    };
    metadata.set(prefix, effective);
    for (const [name, child] of Object.entries(node)) {
      if (name.startsWith('$')) continue;
      visit(child, prefix ? `${prefix}.${name}` : name, effective);
    }
  };
  visit(value, '');
  return metadata;
}

/** Validates modifier declarations against the token paths contributed by ordered base sets. */
export function validateModifierTokenPaths(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): void {
  const baseDocuments = parseResolutionOrder(resolver)
    .filter((entry) => entry.kind === 'sets')
    .flatMap((entry) =>
      expandSetSources(resolver, entry.name).map((source) =>
        documentsByPath.get(normalizeSourcePath(source.$ref))!,
      ),
    );
  const basePaths = new Set<string>();
  // Expand the same `$extends` inheritance used by the resolver and generator
  // before collecting paths. Otherwise a modifier that overrides an inherited
  // member is reported as having no matching base token.
  collectDeclaredTokenPaths(mergeAndExpandExtends(baseDocuments), '', basePaths);
  const baseMetadata = semanticGroupMetadataByPath(mergeAndExpandExtends(baseDocuments));
  const issues = [];
  for (const [modifierName, modifier] of Object.entries(resolver.modifiers)) {
    for (const contextName of Object.keys(modifier.contexts)) {
      const declaredPaths = new Set<string>();
      const contextDocuments = expandContextSources(resolver, modifierName, contextName).map(
        (source) => documentsByPath.get(normalizeSourcePath(source.$ref))!,
      );
      const explicitlyDeclaredPaths = new Set<string>();
      const semanticGroupMetadataPaths = new Set<string>();
      const expandedContext = mergeAndExpandExtends(contextDocuments, [
        ...baseDocuments,
        ...contextDocuments,
      ]);
      collectDeclaredTokenPaths(expandedContext, '', declaredPaths);
      // `$extends` can contribute the effective token leaves of an override
      // context. Treat those expanded paths as explicit too, otherwise group
      // metadata validation reports inherited members as unoverridden.
      collectDeclaredTokenPaths(expandedContext, '', explicitlyDeclaredPaths);
      collectSemanticGroupMetadataPaths(expandedContext, '', semanticGroupMetadataPaths);
      const contextMetadata = semanticGroupMetadataByPath(expandedContext);
      for (const tokenPath of declaredPaths) {
        if (basePaths.has(tokenPath)) continue;
        issues.push({
          path: `$.modifiers.${modifierName}.contexts.${contextName}.${tokenPath}`,
          reason: `override token "${tokenPath}" has no matching base token`,
        });
      }
      for (const groupPath of semanticGroupMetadataPaths) {
        const baseEffective = baseMetadata.get(groupPath) ?? {};
        const contextEffective = contextMetadata.get(groupPath) ?? {};
        const overlaidEffective = {
          ...baseEffective,
          ...Object.fromEntries(
            Object.entries(contextEffective)
              .filter(([, metadataValue]) => metadataValue !== undefined)
              .map(([metadataName, metadataValue]) => [
                metadataName,
                mergeMetadataValue(baseEffective[metadataName], metadataValue),
              ]),
          ),
        };
        if (
          JSON.stringify(canonicalizeJson(overlaidEffective)) ===
          JSON.stringify(canonicalizeJson(baseEffective))
        )
          continue;
        const unoverriddenBasePath = [...basePaths].find(
          (basePath) =>
            (groupPath === '' || basePath === groupPath || basePath.startsWith(`${groupPath}.`)) &&
            !explicitlyDeclaredPaths.has(basePath),
        );
        if (unoverriddenBasePath === undefined) continue;
        issues.push({
          path: `$.modifiers.${modifierName}.contexts.${contextName}.${groupPath || '$root'}`,
          reason:
            `group metadata affects base token "${unoverriddenBasePath}" without an explicit override; ` +
            'resolved token semantics would diverge from generated CSS',
        });
      }
    }
  }
  if (issues.length > 0) throw new TokenValidationError(issues);
}
