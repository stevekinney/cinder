import { Glob } from 'bun';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '..', '..');
const documentationPath = 'docs/component-api-conventions.md';

const booleanPrefixPattern = /^(show|allow|use)[A-Z]/;
const nativeDomHandlers = new Set([
  'onclick',
  'onchange',
  'oninput',
  'onkeydown',
  'onkeyup',
  'onfocus',
  'onblur',
  'onsearch',
  'onsubmit',
]);

export const bannedNames = new Map<string, string>([
  ['defaultValue', 'Use bindable `value` plus a private reset target.'],
  ['filterItem', 'Use `filter`.'],
  ['fieldClass', 'Use `fieldClassName`.'],
  ['inputValue', 'Use `textInputValue`.'],
  ['component', 'Use `as`.'],
  ['mono', 'Use `monochrome`.'],
  ['colSpan', 'Use `columnSpan`.'],
  ['lockScroll', 'Use `scrollLocked`.'],
  ['onClick', 'Use Svelte native `onclick`.'],
  ['onLoadmore', 'Use `onLoadMore`.'],
  ['onSelectall', 'Use `onSelectAll`.'],
  ['onFilterchange', 'Use `onFilterChange`.'],
]);

export type PropConventionViolation = {
  filePath: string;
  line: number;
  propName: string;
  message: string;
};

function lineFor(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function checkPropName(
  sourceFile: ts.SourceFile,
  filePath: string,
  name: ts.PropertyName,
): PropConventionViolation[] {
  const propName = propertyNameText(name);
  if (!propName) return [];

  const violations: PropConventionViolation[] = [];
  const line = lineFor(sourceFile, name.getStart(sourceFile));
  const bannedMessage = bannedNames.get(propName);

  if (bannedMessage) {
    violations.push({ filePath, line, propName, message: bannedMessage });
  }

  if (booleanPrefixPattern.test(propName)) {
    violations.push({
      filePath,
      line,
      propName,
      message: 'Boolean props must use adjective/state names, not show*/allow*/use* prefixes.',
    });
  }

  if (propName.startsWith('on')) {
    const isNative = nativeDomHandlers.has(propName);
    const isCustomCamelCase = /^on[A-Z]/.test(propName);
    if (!isNative && !isCustomCamelCase) {
      violations.push({
        filePath,
        line,
        propName,
        message: 'Custom callbacks must use camelCase onNounVerb names.',
      });
    }
  }

  return violations;
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    ? (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
        false)
    : false;
}

function isComponentPropsSurfaceName(name: string): boolean {
  return (name === 'Props' || name.endsWith('Props')) && !name.endsWith('SchemaProps');
}

function collectTypeNodePropViolations(
  sourceFile: ts.SourceFile,
  filePath: string,
  typeNode: ts.TypeNode,
): PropConventionViolation[] {
  if (ts.isTypeLiteralNode(typeNode)) {
    return typeNode.members.flatMap((member) =>
      ts.isPropertySignature(member) ? checkPropName(sourceFile, filePath, member.name) : [],
    );
  }

  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.flatMap((child) =>
      collectTypeNodePropViolations(sourceFile, filePath, child),
    );
  }

  if (ts.isParenthesizedTypeNode(typeNode)) {
    return collectTypeNodePropViolations(sourceFile, filePath, typeNode.type);
  }

  return [];
}

export function collectPropConventionViolations(
  source: string,
  filePath = 'fixture.types.ts',
): PropConventionViolation[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const violations: PropConventionViolation[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isInterfaceDeclaration(statement) &&
      isExported(statement) &&
      isComponentPropsSurfaceName(statement.name.text)
    ) {
      violations.push(
        ...statement.members.flatMap((member) =>
          ts.isPropertySignature(member) ? checkPropName(sourceFile, filePath, member.name) : [],
        ),
      );
    }

    if (
      ts.isTypeAliasDeclaration(statement) &&
      isExported(statement) &&
      isComponentPropsSurfaceName(statement.name.text)
    ) {
      violations.push(...collectTypeNodePropViolations(sourceFile, filePath, statement.type));
    }
  }

  return violations;
}

async function scan(): Promise<PropConventionViolation[]> {
  const glob = new Glob('src/components/**/*.types.ts');
  const violations: PropConventionViolation[] = [];

  for await (const relativePath of glob.scan({ cwd: packageRoot })) {
    const absolutePath = resolve(packageRoot, relativePath);
    const source = await Bun.file(absolutePath).text();
    const filePath = relative(repositoryRoot, absolutePath);
    violations.push(...collectPropConventionViolations(source, filePath));
  }

  return violations;
}

async function main() {
  const violations = await scan();
  if (violations.length > 0) {
    console.error(
      [
        `check-prop-conventions — prop API vocabulary violations. See ${documentationPath}.`,
        ...violations.map(
          (violation) =>
            `${violation.filePath}:${violation.line}: ${violation.propName}: ${violation.message}`,
        ),
      ].join('\n'),
    );
    process.exit(1);
  }

  console.log('check-prop-conventions — OK.');
}

if (import.meta.main) {
  await main();
}
