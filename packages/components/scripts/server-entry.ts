const identifierPattern = '[A-Za-z_$][A-Za-z0-9_$]*';
const exportBlockPattern = /export\s*\{([\s\S]*?)\}\s*from\s*'(\.[^']+)';/g;
const namedSpecifierPattern = new RegExp(`^(${identifierPattern})$`);
const aliasedSpecifierPattern = new RegExp(
  `^(${identifierPattern})\\s+as\\s+(${identifierPattern})$`,
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

  for (const match of source.matchAll(exportBlockPattern)) {
    const [, specifiers, importPath] = match;
    if (!specifiers || !importPath) continue;

    const valueSpecifiers = parseValueExportSpecifiers(specifiers);
    if (valueSpecifiers.length === 0) continue;

    imports.push(
      `import { ${valueSpecifiers
        .map((specifier) => specifier.importSpecifier)
        .join(', ')} } from '${importPath}';`,
    );
    exportNames.push(...valueSpecifiers.map((specifier) => specifier.exportName));
  }

  return [
    imports.join('\n'),
    '',
    exportNames.map((name) => `const ${name}Export = ${name};`).join('\n'),
    '',
    createExportBlock(exportNames),
    '',
  ].join('\n');
}
