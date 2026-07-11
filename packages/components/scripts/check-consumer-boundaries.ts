import { Glob } from 'bun';
import { posix, relative, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dir, '../../..');
const playgroundRoots = ['packages/playground/src', 'packages/playground/scripts'] as const;

const sourceImportPattern =
  /(?:from\s*|import\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*|import\s+)(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
const internalSelectorPattern =
  /\.cinder-(?:[a-z0-9-]+|\$\{[^}]+\})(?:__[a-z0-9_${}-]+|--[a-z0-9_${}-]+)/i;
const selectorCallPattern =
  /\b(?:querySelector(?:All)?|closest|matches|locator|waitForSelector)(?:\s*<[^>]+>)?\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
const classNameCallPattern = /\bgetElementsByClassName\s*\(\s*(['"`])([^'"`]*cinder-[^'"`]*)\1/gs;
const selectorConstantPattern =
  /\b(?:const|let)\s+([a-z_$][\w$]*)\s*=\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2/g;
const selectorIdentifierCallPattern =
  /\b(?:querySelector(?:All)?|closest|matches|locator|waitForSelector|getElementsByClassName)(?:\s*<[^>]+>)?\s*\(\s*([a-z_$][\w$]*)\s*\)/g;

export type ConsumerBoundaryViolation = {
  filePath: string;
  lineNumber: number;
  message: string;
};

export function findConsumerBoundaryViolations(
  source: string,
  filePath: string,
): ConsumerBoundaryViolation[] {
  const violations: ConsumerBoundaryViolation[] = [];
  const normalizedFilePath = filePath.replaceAll('\\', '/');
  const lineNumberAt = (offset: number): number => source.slice(0, offset).split('\n').length;

  sourceImportPattern.lastIndex = 0;
  for (const match of source.matchAll(sourceImportPattern)) {
    const specifier = match[2];
    if (specifier === undefined || !specifier.startsWith('.')) continue;
    const importTarget = posix.normalize(posix.join(posix.dirname(normalizedFilePath), specifier));
    if (!importTarget.startsWith('packages/components/src')) continue;
    if (
      importTarget !== 'packages/components/src/index.ts' &&
      !(
        (normalizedFilePath.endsWith('.test.ts') ||
          normalizedFilePath === 'packages/playground/scripts/preload.ts') &&
        importTarget === 'packages/components/src/test/happy-dom.ts'
      )
    ) {
      violations.push({
        filePath,
        lineNumber: lineNumberAt(match.index),
        message:
          'Import Cinder through the public source barrel; component source subpaths are private.',
      });
    }
  }

  if (
    normalizedFilePath.startsWith('packages/playground/') &&
    normalizedFilePath.endsWith('.test.ts')
  ) {
    const internalSelectorConstants = new Map<string, number>();
    selectorConstantPattern.lastIndex = 0;
    for (const match of source.matchAll(selectorConstantPattern)) {
      const name = match[1];
      const value = match[3];
      if (name !== undefined && value !== undefined && internalSelectorPattern.test(value)) {
        internalSelectorConstants.set(name, match.index);
      }
    }

    for (const pattern of [selectorCallPattern, classNameCallPattern]) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const selector = match[2];
        const selectorCandidates =
          pattern === classNameCallPattern
            ? (selector?.split(/\s+/).map((className) => `.${className}`) ?? [])
            : [
                selector,
                ...(selector?.match(/cinder-[a-z0-9_-]+/gi)?.map((className) => `.${className}`) ??
                  []),
              ];
        if (
          selectorCandidates.some(
            (candidate) => candidate !== undefined && internalSelectorPattern.test(candidate),
          )
        ) {
          violations.push({
            filePath,
            lineNumber: lineNumberAt(match.index),
            message:
              'Test selectors must use roles, labels, visible text, or app-owned test ids instead of Cinder internal classes.',
          });
        }
      }
    }

    selectorIdentifierCallPattern.lastIndex = 0;
    for (const match of source.matchAll(selectorIdentifierCallPattern)) {
      const identifier = match[1];
      if (identifier !== undefined && internalSelectorConstants.has(identifier)) {
        violations.push({
          filePath,
          lineNumber: lineNumberAt(internalSelectorConstants.get(identifier) ?? match.index),
          message:
            'Test selectors must use roles, labels, visible text, or app-owned test ids instead of Cinder internal classes.',
        });
      }
    }
  }

  return violations;
}

async function main(): Promise<void> {
  const violations: ConsumerBoundaryViolation[] = [];
  const glob = new Glob('**/*.{ts,svelte}');

  for (const root of playgroundRoots) {
    for await (const filePath of glob.scan({ cwd: resolve(workspaceRoot, root), absolute: true })) {
      violations.push(
        ...findConsumerBoundaryViolations(
          await Bun.file(filePath).text(),
          relative(workspaceRoot, filePath),
        ),
      );
    }
  }

  if (violations.length === 0) {
    process.stdout.write(
      'check-consumer-boundaries — OK (no Cinder source imports or internal test selectors).\n',
    );
    return;
  }

  process.stderr.write('check-consumer-boundaries — consumer reach-ins detected.\n\n');
  for (const violation of violations) {
    process.stderr.write(
      `  ${violation.filePath}:${violation.lineNumber}\n    ${violation.message}\n`,
    );
  }
  process.exitCode = 1;
}

if (import.meta.main) await main();
