import { Glob } from 'bun';
import { relative, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dir, '../../..');
const playgroundSourceRoot = resolve(workspaceRoot, 'packages/playground/src');

const sourceImportPattern =
  /(?:from\s*|import\s*\(\s*|import\s+)(['"])(?:\.\.\/)+components\/src(?:\/[^'"]*)?\1/g;
const internalSelectorPattern = /\.cinder-[a-z0-9-]+(?:__[a-z0-9_-]+|--[a-z0-9_-]+)/i;
const selectorCallPattern =
  /\b(?:querySelector(?:All)?|closest|matches|locator|waitForSelector)\s*\(\s*(['"`])([^'"`]*\.cinder-[^'"`]*)\1/g;
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

  for (const [index, line] of source.split('\n').entries()) {
    sourceImportPattern.lastIndex = 0;
    if (
      sourceImportPattern.test(line) &&
      !publicSourceBarrelPattern.test(line) &&
      !(filePath.endsWith('.test.ts') && sharedTestHarnessPattern.test(line))
    ) {
      violations.push({
        filePath,
        lineNumber: index + 1,
        message:
          'Import Cinder through the public source barrel; component source subpaths are private.',
      });
    }

    if (filePath.startsWith('packages/playground/src/') && filePath.endsWith('.test.ts')) {
      selectorCallPattern.lastIndex = 0;
      for (const match of line.matchAll(selectorCallPattern)) {
        const selector = match[2];
        if (selector !== undefined && internalSelectorPattern.test(selector)) {
          violations.push({
            filePath,
            lineNumber: index + 1,
            message:
              'Test selectors must use roles, labels, visible text, or app-owned test ids instead of Cinder internal classes.',
          });
        }
      }
    }
  }

  return violations;
}

async function main(): Promise<void> {
  const violations: ConsumerBoundaryViolation[] = [];
  const glob = new Glob('**/*.{ts,svelte}');

  for await (const filePath of glob.scan({ cwd: playgroundSourceRoot, absolute: true })) {
    violations.push(
      ...findConsumerBoundaryViolations(
        await Bun.file(filePath).text(),
        relative(workspaceRoot, filePath),
      ),
    );
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
