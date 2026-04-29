const identifierPattern = '[A-Za-z_$][A-Za-z0-9_$]*';
const defaultExportPattern = new RegExp(
  `^export \\{ default as (${identifierPattern}) \\} from '(\\.[^']+)';$`,
);
const namedExportPattern = /^export \{ ([^}]+) \} from '(\.[^']+)';$/;
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

function toServerImportPath(importPath: string): string {
  return `../../src/${importPath.slice(2)}`;
}

function createExportBlock(exportNames: string[]): string {
  if (exportNames.length === 0) return 'export {};';

  return `export {\n  ${exportNames.map((name) => `${name}Export as ${name}`).join(',\n  ')},\n};`;
}

export function createServerEntrySource(source: string): string {
  const imports: string[] = [];
  const exportNames: string[] = [];

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    const defaultExportMatch = defaultExportPattern.exec(line);
    if (defaultExportMatch) {
      const [, exportName, importPath] = defaultExportMatch;
      if (exportName && importPath) {
        imports.push(`import ${exportName} from '${toServerImportPath(importPath)}';`);
        exportNames.push(exportName);
      }
      continue;
    }

    const namedExportMatch = namedExportPattern.exec(line);
    if (namedExportMatch) {
      const [, specifiers, importPath] = namedExportMatch;
      if (specifiers && importPath) {
        const valueSpecifiers = parseValueExportSpecifiers(specifiers);
        if (valueSpecifiers.length === 0) continue;

        imports.push(
          `import { ${valueSpecifiers
            .map((specifier) => specifier.importSpecifier)
            .join(', ')} } from '${toServerImportPath(importPath)}';`,
        );
        exportNames.push(...valueSpecifiers.map((specifier) => specifier.exportName));
      }
    }
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
