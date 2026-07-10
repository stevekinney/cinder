import { Glob } from 'bun';
import { relative, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dir, '../../..');
const playgroundRoots = ['packages/playground/src', 'packages/playground/scripts'] as const;

const sourceImportPattern =
  /(?:from\s*|import\s*\(\s*|import\s+)(['"])(?:\.\.\/)+components\/src(?:\/[^'"]*)?\1/g;
const internalSelectorPattern = /\.cinder-[a-z0-9-]+(?:__[a-z0-9_-]+|--[a-z0-9_-]+)/i;
const selectorCallPattern =
  /\b(?:querySelector(?:All)?|closest|matches|locator|waitForSelector)(?:\s*<[^>]+>)?\s*\(\s*(['"`])([^'"`]*\.cinder-[^'"`]*)\1/gs;
const sharedTestHarnessPattern = /components\/src\/test\/happy-dom\.ts/;
const publicSourceBarrelPattern = /components\/src\/index\.ts/;

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
    const matchedImport = match[0];
    if (
      !publicSourceBarrelPattern.test(matchedImport) &&
      !(
        (normalizedFilePath.endsWith('.test.ts') ||
          normalizedFilePath === 'packages/playground/scripts/preload.ts') &&
        sharedTestHarnessPattern.test(matchedImport)
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
    normalizedFilePath.startsWith('packages/playground/src/') &&
    normalizedFilePath.endsWith('.test.ts')
  ) {
    selectorCallPattern.lastIndex = 0;
    for (const match of source.matchAll(selectorCallPattern)) {
      const selector = match[2];
      if (selector !== undefined && internalSelectorPattern.test(selector)) {
        violations.push({
          filePath,
          lineNumber: lineNumberAt(match.index),
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
