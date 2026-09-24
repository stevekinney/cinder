const identifierPattern = '[A-Za-z_$][A-Za-z0-9_$]*';
const exportBlockPattern =
  /export\s*\{([\s\S]*?)\}\s*from\s*'(\.[^']+)'(?:\s+with\s*(\{[^}]*\}))?\s*;/g;
const namedSpecifierPattern = new RegExp(`^(${identifierPattern})$`);
const aliasedSpecifierPattern = new RegExp(
  `^(${identifierPattern})\\s+as\\s+(${identifierPattern})$`,
);
/**
 * Matches `export * from '<path>';`, `export * as <name> from '<path>';`, and their `export type
 * *` counterparts. A synced `src/index.ts` re-exports whole modules this way for
 * `./exports/icons.ts`, the metadata modules and `./exports/utilities.ts` (and, transitively,
 * `./highlighters/shiki/index.ts`); `exportBlockPattern` above only ever matched the brace form,
 * so every name those wildcard lines carry was silently dropped from the generated browser and
 * server entries. There is no fixed set of names to enumerate here the way there is for a `{ ... }`
 * block, so a value wildcard is carried through as its own `export *`/`export * as` statement
 * rather than expanded into named imports — the runtime re-export semantics are identical either
 * way, and the module's own exports are already resolved once it is loaded.
 */
const wildcardExportPattern = new RegExp(
  `export\\s+(type\\s+)?\\*(?:\\s+as\\s+(${identifierPattern}))?\\s*from\\s*'(\\.[^']+)'\\s*;`,
  'g',
);

interface ValueExportSpecifier {
  importSpecifier: string;
  exportName: string;
}

export function parseValueExportSpecifiers(specifiers: string): ValueExportSpecifier[] {
  return specifiers
    .split(',')
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .flatMap((specifier) => {
      if (specifier.startsWith('type ')) return [];

      const aliasedSpecifierMatch = aliasedSpecifierPattern.exec(specifier);
      if (aliasedSpecifierMatch) {
        const [, sourceName, exportName] = aliasedSpecifierMatch;
        if (sourceName && exportName) {
          return [{ importSpecifier: `${sourceName} as ${exportName}`, exportName }];
        }
      }

      const namedSpecifierMatch = namedSpecifierPattern.exec(specifier);
      if (namedSpecifierMatch) {
        const [, exportName] = namedSpecifierMatch;
        if (exportName) return [{ importSpecifier: exportName, exportName }];
      }

      throw new Error(`Unsupported export specifier: ${specifier}`);
    });
}

function createExportBlock(exportNames: string[]): string {
  if (exportNames.length === 0) return 'export {};';

  return `export {\n  ${exportNames.map((name) => `${name}Export as ${name}`).join(',\n  ')},\n};`;
}

export function createServerEntrySource(source: string): string {
  const imports: string[] = [];
  const exportNames: string[] = [];
  const wildcardExports: string[] = [];

  for (const match of source.matchAll(exportBlockPattern)) {
    const [, specifiers, importPath, importAttributes] = match;
    if (!specifiers || !importPath) continue;

    const valueSpecifiers = parseValueExportSpecifiers(specifiers);
    if (valueSpecifiers.length === 0) continue;

    const importAttributesClause = importAttributes ? ` with ${importAttributes}` : '';
    imports.push(
      `import { ${valueSpecifiers
        .map((specifier) => specifier.importSpecifier)
        .join(', ')} } from '${importPath}'${importAttributesClause};`,
    );
    exportNames.push(...valueSpecifiers.map((specifier) => specifier.exportName));
  }

  for (const match of source.matchAll(wildcardExportPattern)) {
    const [, isTypeOnly, namespace, importPath] = match;
    if (isTypeOnly || !importPath) continue;

    wildcardExports.push(
      namespace ? `export * as ${namespace} from '${importPath}';` : `export * from '${importPath}';`,
    );
  }

  const namedExportBlock = createExportBlock(exportNames);
  const exportBlocks =
    wildcardExports.length > 0
      ? `${namedExportBlock}\n${wildcardExports.join('\n')}`
      : namedExportBlock;

  return [
    imports.join('\n'),
    '',
    exportNames.map((name) => `const ${name}Export = ${name};`).join('\n'),
    '',
    exportBlocks,
    '',
  ].join('\n');
}
