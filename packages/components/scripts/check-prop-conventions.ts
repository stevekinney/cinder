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

// ---------------------------------------------------------------------------
// Type-aware pass. The syntactic pass above cannot tell a native DOM
// passthrough (`onclick?: (event: MouseEvent) => void`) from a custom value
// callback hiding behind a native name (`onchange?: (value: string) => void`)
// — which is exactly how 20+ components drifted before the 2026-08 sweep.
// One ts.Program over every *.types.ts resolves each exported Props surface's
// properties through aliases, intersections, unions, and indexed accesses,
// then gates every lowercase on* handler on its first parameter structurally
// extending Event. Resolving the SURFACE (not the syntax tree) also closes
// the non-exported-helper blind spot: a violation is attributed to its true
// declaration site even when that declaration lives in an unexported type
// referenced by the exported Props.
// ---------------------------------------------------------------------------

const EVENT_STRUCTURAL_PROBE = ['preventDefault', 'stopPropagation', 'bubbles'] as const;

function isNullishType(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Never)) !== 0;
}

/**
 * A parameter type is Event-like when every non-nullish union constituent
 * structurally exposes `preventDefault`, `stopPropagation`, and `bubbles`.
 * The structural probe passes MouseEvent/KeyboardEvent/SubmitEvent and the
 * event side of `svelte/elements` handler unions, and fails `string`,
 * `number | null`, `File[]`, and detail objects — without depending on
 * lib.dom declaration names.
 */
function isEventLikeParameterType(type: ts.Type): boolean {
  const constituents = type.isUnion() ? type.types : [type];
  const substantive = constituents.filter((constituent) => !isNullishType(constituent));
  if (substantive.length === 0) return false;
  return substantive.every((constituent) =>
    EVENT_STRUCTURAL_PROBE.every((probe) => constituent.getProperty(probe) !== undefined),
  );
}

/**
 * Whether a lowercase native-named handler prop's resolved type is a real
 * DOM passthrough: every call signature takes an Event-like first parameter.
 * An undefined/never-only arm (a discriminated-union fence) passes — there
 * is nothing callable to misuse.
 */
function isNativePassthroughHandlerType(propType: ts.Type, checker: ts.TypeChecker): boolean {
  const constituents = propType.isUnion() ? propType.types : [propType];
  const callable = constituents.filter((constituent) => !isNullishType(constituent));
  if (callable.length === 0) return true;
  const signatures = callable.flatMap((constituent) => constituent.getCallSignatures());
  if (signatures.length === 0) {
    // Not callable at all (e.g. an indexed-access forward that resolved to a
    // non-function) — leave it to the compiler; not this check's concern.
    return true;
  }
  return signatures.every((signature) => {
    const firstParameter = signature.getParameters()[0];
    if (!firstParameter) return false;
    const declaration = firstParameter.valueDeclaration ?? firstParameter.declarations?.[0];
    if (!declaration) return false;
    const parameterType = checker.getTypeOfSymbolAtLocation(firstParameter, declaration);
    return isEventLikeParameterType(parameterType);
  });
}

function propsSurfaceNamesIn(sourceFile: ts.SourceFile): ts.Identifier[] {
  const names: ts.Identifier[] = [];
  for (const statement of sourceFile.statements) {
    if (
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      isExported(statement) &&
      isComponentPropsSurfaceName(statement.name.text)
    ) {
      names.push(statement.name);
    }
  }
  return names;
}

function componentDeclarationSite(
  symbol: ts.Symbol,
): { sourceFile: ts.SourceFile; declaration: ts.Declaration } | undefined {
  for (const declaration of symbol.declarations ?? []) {
    const sourceFile = declaration.getSourceFile();
    const normalized = sourceFile.fileName.replace(/\\/g, '/');
    if (normalized.includes('/src/components/') && !normalized.includes('/node_modules/')) {
      return { sourceFile, declaration };
    }
  }
  // Every declaration lives outside src/components (inherited HTMLAttributes
  // members, svelte helpers) — not ours to police.
  return undefined;
}

export function collectResolvedSurfaceViolations(
  program: ts.Program,
  typesFiles: readonly string[],
): PropConventionViolation[] {
  const checker = program.getTypeChecker();
  const violations = new Map<string, PropConventionViolation>();
  const typesFileSet = new Set(typesFiles.map((file) => resolve(file)));

  const record = (violation: PropConventionViolation) => {
    violations.set(
      `${violation.filePath}:${violation.line}:${violation.propName}:${violation.message}`,
      violation,
    );
  };

  for (const sourceFile of program.getSourceFiles()) {
    if (!typesFileSet.has(resolve(sourceFile.fileName))) continue;

    for (const surfaceName of propsSurfaceNamesIn(sourceFile)) {
      const surfaceType = checker.getTypeAtLocation(surfaceName);
      const arms = surfaceType.isUnion() ? surfaceType.types : [surfaceType];
      for (const arm of arms) {
        for (const property of arm.getProperties()) {
          const propName = property.getName();
          const site = componentDeclarationSite(property);
          if (!site) continue;
          const filePath = relative(repositoryRoot, site.sourceFile.fileName);
          const line = lineFor(
            site.sourceFile,
            site.declaration.getStart(site.sourceFile as ts.SourceFile),
          );

          const bannedMessage = bannedNames.get(propName);
          if (bannedMessage) {
            record({ filePath, line, propName, message: bannedMessage });
          }

          if (booleanPrefixPattern.test(propName)) {
            record({
              filePath,
              line,
              propName,
              message:
                'Boolean props must use adjective/state names, not show*/allow*/use* prefixes.',
            });
          }

          if (/^on[a-z]/.test(propName)) {
            if (!nativeDomHandlers.has(propName)) {
              record({
                filePath,
                line,
                propName,
                message: 'Custom callbacks must use camelCase onNounVerb names.',
              });
              continue;
            }
            const propType = checker.getTypeOfSymbolAtLocation(property, site.declaration);
            if (!isNativePassthroughHandlerType(propType, checker)) {
              record({
                filePath,
                line,
                propName,
                message:
                  'Lowercase on* props are reserved for native DOM passthrough; this ' +
                  "handler's first parameter does not extend Event. Use a camelCase " +
                  'onNounVerb name (e.g. onValueChange).',
              });
            }
          }
        }
      }
    }
  }

  return [...violations.values()].toSorted((left, right) =>
    left.filePath === right.filePath
      ? left.line - right.line
      : left.filePath < right.filePath
        ? -1
        : 1,
  );
}

export function createPropsProgram(typesFiles: readonly string[]): ts.Program {
  const configPath = ts.findConfigFile(packageRoot, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    throw new Error('check-prop-conventions: could not locate a tsconfig.json for the package.');
  }
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(
        `check-prop-conventions: tsconfig parse failed: ${ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n',
        )}`,
      );
    },
  });
  if (!parsed) {
    throw new Error('check-prop-conventions: could not parse the package tsconfig.');
  }
  return ts.createProgram([...typesFiles], { ...parsed.options, noEmit: true });
}

async function scan(): Promise<PropConventionViolation[]> {
  const glob = new Glob('src/components/**/*.types.ts');
  const typesFiles: string[] = [];
  for await (const relativePath of glob.scan({ cwd: packageRoot })) {
    typesFiles.push(resolve(packageRoot, relativePath));
  }
  const program = createPropsProgram(typesFiles);
  return collectResolvedSurfaceViolations(program, typesFiles);
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
